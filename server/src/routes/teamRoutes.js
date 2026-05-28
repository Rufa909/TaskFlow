const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
    searchUserByEmail,
    sendInvitation,
    getMyInvitations,
    respondInvitation,
    getProjectMembers,
    updateMemberRole,
    removeMember,
} = require('../controllers/teamController');

// Tất cả route đều cần đăng nhập
router.get('/search', auth, searchUserByEmail);
router.post('/invite', auth, sendInvitation);
router.get('/invitations', auth, getMyInvitations);
router.put('/invitations/:id', auth, respondInvitation);
router.get('/projects/:id/members', auth, getProjectMembers);
router.put('/projects/:id/members/:userId/role', auth, updateMemberRole);
router.delete('/projects/:id/members/:userId', auth, removeMember);

module.exports = router;
