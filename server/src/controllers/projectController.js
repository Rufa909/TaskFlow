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
    const value = formatDateOnly(deadline);
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return value;
}

function isPastProjectDeadline(deadline) {
    if (!deadline) return false;
    const today = new Date().toISOString().slice(0, 10);
    return deadline < today;
}

function validateWorkflowStageDates(stages, projectDeadline) {
    const normalizedProjectDeadline = normalizeProjectDeadline(projectDeadline);
    for (const stage of stages) {
        const stageName = stage.name || stage.stage_name || 'Stage';
        const startDate = normalizeProjectDeadline(stage.start_date || stage.startDate);
        const endDate = normalizeProjectDeadline(stage.end_date || stage.endDate || stage.deadline);

        if ((stage.start_date || stage.startDate) && startDate === undefined) {
            return `Ngày bắt đầu của stage "${stageName}" không hợp lệ!`;
        }
        if ((stage.end_date || stage.endDate || stage.deadline) && endDate === undefined) {
            return `Ngày kết thúc của stage "${stageName}" không hợp lệ!`;
        }
        if (startDate && endDate && startDate > endDate) {
            return `Ngày bắt đầu của stage "${stageName}" không được sau ngày kết thúc!`;
        }
        if (normalizedProjectDeadline && endDate && endDate > normalizedProjectDeadline) {
            return `Ngày kết thúc của stage "${stageName}" không được vượt quá hạn project!`;
        }
        if (normalizedProjectDeadline && startDate && startDate > normalizedProjectDeadline) {
            return `Ngày bắt đầu của stage "${stageName}" không được sau hạn project!`;
        }
    }

    return null;
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

    const value = formatDateOnly(deadline);
    if (!value) {
        return {
            date: null,
            status: "invalid",
            days_remaining: null,
            is_overdue: false,
            is_due_soon: false,
        };
    }
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

function formatDateOnly(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
            await ProjectStage.ensureProjectStagesTable();
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const [result] = await connection.query(
                    'INSERT INTO projects (owner_id, name) VALUES (?, ?)',
                    [req.user.id, 'Project1']
                );
                await ProjectStage.createDefaultStages(result.insertId, ProjectStage.DEFAULT_WORKFLOW_STAGES, connection);
                [rows] = await connection.query(
                    "SELECT p.*, 'owner' AS user_role FROM projects p WHERE p.project_id = ? AND p.deleted_at IS NULL",
                    [result.insertId]
                );
                await connection.commit();
            } catch (createErr) {
                await connection.rollback();
                throw createErr;
            } finally {
                connection.release();
            }
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
    if (!deadline) {
        return res.status(400).json({ success: false, message: 'Vui long chon han project!' });
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
        const stagesToCreate = ProjectStage.normalizeWorkflowStages(workflow_stages);
        const stageDateError = validateWorkflowStageDates(stagesToCreate, normalizedDeadline);
        if (stageDateError) {
            return res.status(400).json({ success: false, message: stageDateError });
        }
        await ProjectStage.ensureProjectStagesTable();
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query(
                'INSERT INTO projects (owner_id, name, deadline) VALUES (?, ?, ?)',
                [req.user.id, name.trim(), normalizedDeadline]
            );
            const projectId = result.insertId;
            await ProjectStage.createDefaultStages(projectId, stagesToCreate, connection);

            const [rows] = await connection.query(
                'SELECT * FROM projects WHERE project_id = ? AND deleted_at IS NULL',
                [projectId]
            );
            await connection.commit();
            res.status(201).json({ success: true, project: attachDeadlineProject(rows[0]) });
        } catch (createErr) {
            await connection.rollback();
            throw createErr;
        } finally {
            connection.release();
        }
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
            'SELECT * FROM projects WHERE project_id = ? AND deleted_at IS NULL',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project khong ton tai!' });
        }
        if (Number(rows[0].owner_id) !== Number(req.user.id)) {
            return res.status(403).json({ success: false, message: 'Ban khong phai owner cua project nay!' });
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
        if (normalizedDeadline) {
            await ProjectStage.ensureProjectStagesTable();
            const [[blockingStage]] = await pool.query(
                `SELECT stage_name, COALESCE(end_date, deadline) AS end_date
                 FROM project_stages
                 WHERE project_id = ?
                   AND COALESCE(end_date, deadline) IS NOT NULL
                   AND COALESCE(end_date, deadline) > ?
                 ORDER BY COALESCE(end_date, deadline) DESC
                 LIMIT 1`,
                [id, normalizedDeadline]
            );
            if (blockingStage) {
                return res.status(409).json({
                    success: false,
                    message: `Không thể đặt hạn project trước ngày kết thúc stage "${blockingStage.stage_name}"!`
                });
            }

            const [[blockingTask]] = await pool.query(
                `SELECT title, deadline
                 FROM tasks
                 WHERE project_id = ?
                   AND deleted_at IS NULL
                   AND deadline IS NOT NULL
                   AND DATE(deadline) > ?
                 ORDER BY deadline DESC
                 LIMIT 1`,
                [id, normalizedDeadline]
            );
            if (blockingTask) {
                return res.status(409).json({
                    success: false,
                    message: `Không thể đặt hạn project trước deadline của task "${blockingTask.title}"!`
                });
            }
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
