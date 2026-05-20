const pool = require('../config/db');

// GET /api/projects → lấy tất cả project của user đang đăng nhập
exports.getProjects = async (req, res) => {
    try {
        let [rows] = await pool.query(
            `SELECT p.* 
             FROM projects p
             LEFT JOIN project_members pm ON p.project_id = pm.project_id
             WHERE p.owner_id = ? OR pm.user_id = ?
             GROUP BY p.project_id
             ORDER BY p.created_at ASC`,
            [req.user.id, req.user.id]
        );
        // Nếu user chưa có project nào → tự động tạo "Project1"
        if (rows.length === 0) {
            const [result] = await pool.query(
                'INSERT INTO projects (owner_id, name) VALUES (?, ?)',
                [req.user.id, 'Project1']
            );
            [rows] = await pool.query('SELECT * FROM projects WHERE project_id = ?', [result.insertId]);
        }
        res.json({ success: true, projects: rows });
    } catch (err) {
        console.error('Loi getProjects:', err);
        res.status(500).json({ success: false, message: 'Co loi xay ra!' });
    }
};

// POST /api/projects → tạo project mới
exports.createProject = async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Ten project khong duoc de trong!' });
    }
    try {
        const [result] = await pool.query(
            'INSERT INTO projects (owner_id, name) VALUES (?, ?)',
            [req.user.id, name.trim()]
        );
        const [rows] = await pool.query('SELECT * FROM projects WHERE project_id = ?', [result.insertId]);
        res.status(201).json({ success: true, project: rows[0] });
    } catch (err) {
        console.error('Loi createProject:', err);
        res.status(500).json({ success: false, message: 'Co loi xay ra!' });
    }
};

// DELETE /api/projects/:id → xóa project
exports.deleteProject = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM projects WHERE project_id = ? AND owner_id = ?',
            [id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project khong ton tai!' });
        }
        await pool.query('DELETE FROM projects WHERE project_id = ?', [id]);
        res.json({ success: true, message: 'Da xoa project!' });
    } catch (err) {
        console.error('Loi deleteProject:', err);
        res.status(500).json({ success: false, message: 'Co loi xay ra!' });
    }
};

// PUT /api/projects/:id → update project name
exports.updateProject = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Ten project khong duoc de trong!' });
    }
    try {
        const [rows] = await pool.query(
            'SELECT * FROM projects WHERE project_id = ? AND owner_id = ?',
            [id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project khong ton tai!' });
        }
        await pool.query('UPDATE projects SET name = ? WHERE project_id = ?', [name.trim(), id]);
        const [updated] = await pool.query('SELECT * FROM projects WHERE project_id = ?', [id]);
        res.json({ success: true, project: updated[0] });
    } catch (err) {
        console.error('Loi updateProject:', err);
        res.status(500).json({ success: false, message: 'Co loi xay ra!' });
    }
};
