const pool = require('../config/db');
const ProjectStage = require('../models/ProjectStage');

let removedMembersTableReady;
let projectDeadlineColumnReady;

async function ensureProjectDeadlineColumn() {
    if (!projectDeadlineColumnReady) {
        projectDeadlineColumnReady = (async () => {
            const connection = await pool.getConnection();
            try {
                await connection.query("SELECT GET_LOCK('taskflow_projects_deadline_column', 10)");
                const [columns] = await connection.query("SHOW COLUMNS FROM projects WHERE Field = 'deadline'");
                if (columns.length === 0) {
                    try {
                        await connection.query("ALTER TABLE projects ADD COLUMN deadline DATE NULL");
                    } catch (err) {
                        if (err.code !== "ER_DUP_FIELDNAME" && err.errno !== 1060) throw err;
                    }
                }
            } finally {
                await connection.query("SELECT RELEASE_LOCK('taskflow_projects_deadline_column')").catch(() => {});
                connection.release();
            }
        })().catch((err) => {
            projectDeadlineColumnReady = null;
            throw err;
        });
    }

    return projectDeadlineColumnReady;
}

function normalizeProjectDeadline(deadline) {
    if (!deadline) return null;
    const value = String(deadline).slice(0, 10);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return value;
}

function isPastProjectDeadline(deadline) {
    if (!deadline) return false;
    const today = new Date().toISOString().slice(0, 10);
    return deadline < today;
}

function buildDeadlineProject(deadline, progressPercent = 0) {
    if (!deadline) {
        return {
            date: null,
            status: "none",
            days_remaining: null,
            is_overdue: false,
            is_due_soon: false,
        };
    }

    const value = String(deadline).slice(0, 10);
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) {
        return {
            date: null,
            status: "invalid",
            days_remaining: null,
            is_overdue: false,
            is_due_soon: false,
        };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const daysRemaining = Math.ceil((deadlineDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const completed = Number(progressPercent || 0) >= 100;
    const isOverdue = !completed && daysRemaining < 0;
    const isDueSoon = !completed && daysRemaining >= 0 && daysRemaining <= 3;

    return {
        date: value,
        status: completed ? "completed" : isOverdue ? "overdue" : isDueSoon ? "due_soon" : "active",
        days_remaining: daysRemaining,
        is_overdue: isOverdue,
        is_due_soon: isDueSoon,
    };
}

function attachDeadlineProject(project) {
    return {
        ...project,
        deadlineProject: buildDeadlineProject(project.deadline),
    };
}

async function ensureRemovedMembersTable() {
    if (!removedMembersTableReady) {
        removedMembersTableReady = pool.query(`
            CREATE TABLE IF NOT EXISTS project_removed_members (
                project_id INT NOT NULL,
                user_id INT NOT NULL,
                removed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (project_id, user_id),
                INDEX idx_project_removed_members_user (user_id),
                CONSTRAINT fk_project_removed_members_project
                    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
                CONSTRAINT fk_project_removed_members_user
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);
    }

    return removedMembersTableReady;
}

// GET /api/projects → lấy tất cả project của user đang đăng nhập
exports.getProjects = async (req, res) => {
    try {
        await ensureProjectDeadlineColumn();
        await ensureRemovedMembersTable();
        let [rows] = await pool.query(
            `SELECT DISTINCT p.*,
                    CASE
                        WHEN p.owner_id = ? THEN 'owner'
                        WHEN pm.user_id IS NOT NULL THEN pm.role
                        WHEN prm.user_id IS NOT NULL THEN 'removed'
                        ELSE NULL
                    END AS user_role,
                    prm.removed_at AS project_removed_at
             FROM projects p
             LEFT JOIN project_members pm
               ON p.project_id = pm.project_id
              AND pm.user_id = ?
             LEFT JOIN project_removed_members prm
               ON prm.project_id = p.project_id
              AND prm.user_id = ?
              WHERE (p.owner_id = ? OR pm.user_id IS NOT NULL OR prm.user_id IS NOT NULL)
               AND p.deleted_at IS NULL
             ORDER BY p.created_at ASC`,
            [req.user.id, req.user.id, req.user.id, req.user.id]
        );
        // Nếu user chưa có project nào → tự động tạo "Project1"
        if (rows.length === 0) {
            const [result] = await pool.query(
                'INSERT INTO projects (owner_id, name) VALUES (?, ?)',
                [req.user.id, 'Project1']
            );
            [rows] = await pool.query(
                "SELECT p.*, 'owner' AS user_role FROM projects p WHERE p.project_id = ? AND p.deleted_at IS NULL",
                [result.insertId]
            );
        }
        res.json({ success: true, projects: rows.map(attachDeadlineProject) });
    } catch (err) {
        console.error('Loi getProjects:', err);
        res.status(500).json({ success: false, message: 'Co loi xay ra!' });
    }
};

// POST /api/projects → tạo project mới
exports.createProject = async (req, res) => {
    const { name, workflow_stages, deadline } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Ten project khong duoc de trong!' });
    }
    const normalizedDeadline = normalizeProjectDeadline(deadline);
    if (deadline && normalizedDeadline === undefined) {
        return res.status(400).json({ success: false, message: 'Ngay hoan thanh project khong hop le!' });
    }
    if (isPastProjectDeadline(normalizedDeadline)) {
        return res.status(400).json({ success: false, message: 'Ngay hoan thanh project khong duoc o qua khu!' });
    }
    try {
        await ensureProjectDeadlineColumn();
        const [result] = await pool.query(
            'INSERT INTO projects (owner_id, name, deadline) VALUES (?, ?, ?)',
            [req.user.id, name.trim(), normalizedDeadline]
        );
        const projectId = result.insertId;

        // Use custom workflow stages or defaults
        const stagesToCreate = workflow_stages || [
            {
                name: '📋 Planning',
                description: 'Requirement analysis & planning phase'
            },
            {
                name: '💻 Development',
                description: 'Implementation & coding phase'
            },
            {
                name: '🧪 Testing',
                description: 'QA & testing phase'
            },
            {
                name: '🚀 Deployment',
                description: 'Release to production'
            }
        ];

        try {
            await ProjectStage.createDefaultStages(projectId, stagesToCreate);
        } catch (stageErr) {
            console.warn('Could not create workflow stages:', stageErr.message);
            // Không báo lỗi, project vẫn được tạo
        }

        const [rows] = await pool.query(
            'SELECT * FROM projects WHERE project_id = ? AND deleted_at IS NULL',
            [projectId]
        );
        res.status(201).json({ success: true, project: attachDeadlineProject(rows[0]) });
    } catch (err) {
        console.error('Loi createProject:', err);
        res.status(500).json({ success: false, message: 'Co loi xay ra!' });
    }
};

// DELETE /api/projects/:id → xóa project
exports.deleteProject = async (req, res) => {
    const { id } = req.params;
    try {
        await ensureProjectDeadlineColumn();
        const [rows] = await pool.query(
            'SELECT * FROM projects WHERE project_id = ? AND owner_id = ? AND deleted_at IS NULL',
            [id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project khong ton tai!' });
        }
        await pool.query('UPDATE projects SET deleted_at = NOW() WHERE project_id = ?', [id]);
        res.json({ success: true, message: 'Da an project!' });
    } catch (err) {
        console.error('Loi deleteProject:', err);
        res.status(500).json({ success: false, message: 'Co loi xay ra!' });
    }
};

// PUT /api/projects/:id → update project name
exports.updateProject = async (req, res) => {
    const { id } = req.params;
    const { name, deadline } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Ten project khong duoc de trong!' });
    }
    try {
        await ensureProjectDeadlineColumn();
        const normalizedDeadline = normalizeProjectDeadline(deadline);
        if (deadline && normalizedDeadline === undefined) {
            return res.status(400).json({ success: false, message: 'Ngay hoan thanh project khong hop le!' });
        }
        if (isPastProjectDeadline(normalizedDeadline)) {
            return res.status(400).json({ success: false, message: 'Ngay hoan thanh project khong duoc o qua khu!' });
        }
        const [rows] = await pool.query(
            'SELECT * FROM projects WHERE project_id = ? AND owner_id = ? AND deleted_at IS NULL',
            [id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project khong ton tai!' });
        }
        await pool.query('UPDATE projects SET name = ?, deadline = ? WHERE project_id = ?', [name.trim(), normalizedDeadline, id]);
        const [updated] = await pool.query(
            'SELECT * FROM projects WHERE project_id = ? AND deleted_at IS NULL',
            [id]
        );
        res.json({ success: true, project: attachDeadlineProject(updated[0]) });
    } catch (err) {
        console.error('Loi updateProject:', err);
        res.status(500).json({ success: false, message: 'Co loi xay ra!' });
    }
};
