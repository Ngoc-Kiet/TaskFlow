const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getNotifications, markAsRead, markAllAsRead, deleteNotification } = require('../controllers/notificationController');
const { searchUsers, getUser, getDashboard } = require('../controllers/userController');

// Notification routes
router.use(protect);
router.get('/notifications', getNotifications);
router.put('/notifications/read-all', markAllAsRead);
router.put('/notifications/:id/read', markAsRead);
router.delete('/notifications/:id', deleteNotification);

// User routes
router.get('/users/search', searchUsers);
router.get('/users/dashboard', getDashboard);
router.get('/users/:id', getUser);

module.exports = router;
