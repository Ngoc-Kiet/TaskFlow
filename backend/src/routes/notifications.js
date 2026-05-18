const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');

// GET /api/notifications - lấy danh sách thông báo của user hiện tại
router.get('/', protect, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/:id/read - đánh dấu đã đọc
router.put('/:id/read', protect, async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    res.json({ success: true, data: notif });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/read-all - đánh dấu tất cả đã đọc
router.put('/read-all', protect, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, message: 'Đã đọc tất cả thông báo' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/:id - xóa thông báo
router.delete('/:id', protect, async (req, res, next) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Helper: tạo thông báo (dùng nội bộ từ các controller khác)
router.createNotification = async ({ recipient, sender, type, title, message, relatedTask, relatedProject }) => {
  try {
    if (String(recipient) === String(sender)) return; // Không tự thông báo cho mình
    await Notification.create({ recipient, sender, type, title, message, relatedTask, relatedProject });
  } catch (e) {
    console.error('Notification create error:', e.message);
  }
};

module.exports = router;
