const pool = require("../config/db");

// Tìm user theo email (không trả về chính mình)
const searchUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng nhập email" });
    }

    const [rows] = await pool.query(
      "SELECT user_id, username, email, user_photo, email_verified FROM users WHERE email = ? AND user_id != ?",
      [email, req.user.id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error("Lỗi tìm user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Gửi lời mời vào project
const sendInvitation = async (req, res) => {
  try {
    const { project_id, receiver_id } = req.body;
    const sender_id = req.user.id;
    const [senders] = await pool.query(
      "SELECT email_verified FROM users WHERE user_id = ?",
      [sender_id],
    );

    if (senders.length === 0 || !senders[0].email_verified) {
      return res.status(403).json({
        success: false,
        message: "Bạn cần xác thực email trước khi mời người khác vào team.",
      });
    }

    // Không thể mời chính mình
    if (sender_id === receiver_id) {
      return res
        .status(400)
        .json({ success: false, message: "Không thể mời chính mình" });
    }

    // Kiểm tra project tồn tại và thuộc về sender
    const [projects] = await pool.query(
      "SELECT * FROM projects WHERE project_id = ? AND owner_id = ? AND deleted_at IS NULL",
      [project_id, sender_id],
    );

    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project không tồn tại hoặc bạn không phải owner",
      });
    }

    // Kiểm tra receiver tồn tại
    const [receivers] = await pool.query(
      "SELECT user_id, email_verified FROM users WHERE user_id = ?",
      [receiver_id],
    );

    if (receivers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Người nhận không tồn tại" });
    }
    if (!receivers[0].email_verified) {
      return res.status(403).json({
        success: false,
        message: "Người được mời cần xác thực email trước khi vào team.",
      });
    }
    // Kiểm tra đã có lời mời pending chưa
    const [pendingInvites] = await pool.query(
      'SELECT * FROM team_invitations WHERE project_id = ? AND receiver_id = ? AND status = "pending"',
      [project_id, receiver_id],
    );

    if (pendingInvites.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Đã gửi lời mời cho người này rồi" });
    }

    // Kiểm tra đã là member chưa
    const [existingMembers] = await pool.query(
      "SELECT * FROM project_members WHERE project_id = ? AND user_id = ?",
      [project_id, receiver_id],
    );

    if (existingMembers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Người này đã là thành viên của project",
      });
    }

    // Tạo lời mời
    const [result] = await pool.query(
      "INSERT INTO team_invitations (project_id, sender_id, receiver_id) VALUES (?, ?, ?)",
      [project_id, sender_id, receiver_id],
    );

    res.status(201).json({
      success: true,
      message: "Gửi lời mời thành công",
      invitation: {
        invitation_id: result.insertId,
        project_id,
        sender_id,
        receiver_id,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Lỗi gửi lời mời:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy danh sách lời mời của user hiện tại
const getMyInvitations = async (req, res) => {
  try {
    const [invitations] = await pool.query(
      `SELECT ti.invitation_id, ti.project_id, ti.sender_id, ti.status, ti.created_at,
                    p.name AS project_name,
                    u.username AS sender_username, u.email AS sender_email, u.user_photo AS sender_photo
             FROM team_invitations ti
             JOIN projects p ON ti.project_id = p.project_id
             JOIN users u ON ti.sender_id = u.user_id
             WHERE ti.receiver_id = ? AND ti.status = 'pending'
               AND p.deleted_at IS NULL
             ORDER BY ti.created_at DESC`,
      [req.user.id],
    );

    res.json({ success: true, invitations });
  } catch (error) {
    console.error("Lỗi lấy lời mời:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Chấp nhận hoặc từ chối lời mời
const respondInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action phải là accept hoặc decline",
      });
    }

    // Kiểm tra lời mời thuộc về user hiện tại
    const [invitations] = await pool.query(
      `SELECT ti.*
       FROM team_invitations ti
       JOIN projects p ON p.project_id = ti.project_id
       WHERE ti.invitation_id = ?
         AND ti.receiver_id = ?
         AND ti.status = "pending"
         AND p.deleted_at IS NULL`,
      [id, req.user.id],
    );

    if (invitations.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lời mời không tồn tại hoặc đã được xử lý",
      });
    }

    const invitation = invitations[0];

    if (action === "accept") {
      const [receivers] = await pool.query(
        "SELECT email_verified FROM users WHERE user_id = ?",
        [req.user.id],
      );

      if (receivers.length === 0 || !receivers[0].email_verified) {
        return res.status(403).json({
          success: false,
          message:
            "Bạn cần xác thực email trước khi chấp nhận lời mời vào team.",
        });
      }
      // Cập nhật status + thêm vào project_members
      await pool.query(
        'UPDATE team_invitations SET status = "accepted" WHERE invitation_id = ?',
        [id],
      );

      await pool.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, "member")',
        [invitation.project_id, req.user.id],
      );

      res.json({ success: true, message: "Đã chấp nhận lời mời" });
    } else {
      // Từ chối
      await pool.query(
        'UPDATE team_invitations SET status = "declined" WHERE invitation_id = ?',
        [id],
      );

      res.json({ success: true, message: "Đã từ chối lời mời" });
    }
  } catch (error) {
    console.error("Lỗi xử lý lời mời:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy danh sách thành viên của project (bao gồm cả owner)
const getProjectMembers = async (req, res) => {
  try {
    const { id } = req.params;

    // Lấy members từ project_members
    const [members] = await pool.query(
      `SELECT pm.role, pm.joined_at,
                    u.user_id, u.username, u.email, u.user_photo
             FROM project_members pm
             JOIN users u ON pm.user_id = u.user_id
             WHERE pm.project_id = ?`,
      [id],
    );

    // Lấy owner của project
    const [owners] = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.user_photo, 'owner' AS role
             FROM projects p
             JOIN users u ON p.owner_id = u.user_id
             WHERE p.project_id = ?
               AND p.deleted_at IS NULL`,
      [id],
    );

    // Gộp owner + members, tránh trùng
    const ownerIds = owners.map((o) => o.user_id);
    const filteredMembers = members.filter(
      (m) => !ownerIds.includes(m.user_id),
    );
    const allMembers = [...owners, ...filteredMembers];

    res.json({ success: true, members: allMembers });
  } catch (error) {
    console.error("Lỗi lấy members:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

module.exports = {
  searchUserByEmail,
  sendInvitation,
  getMyInvitations,
  respondInvitation,
  getProjectMembers,
};
