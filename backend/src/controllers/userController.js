const User = require('../models/User');

// @desc    Search users
// @route   GET /api/users/search?q=email
const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, data: [] });

    const users = await User.find({
      $or: [
        { email: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: req.user._id },
      isActive: true
    }).select('name email avatar').limit(10);

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name email avatar createdAt lastSeen');
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard overview
// @route   GET /api/users/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const Task = require('../models/Task');
    const Project = require('../models/Project');

    const [projects, myTasks, overdueTasks] = await Promise.all([
      Project.find({ 'members.user': req.user._id, isArchived: false }).countDocuments(),
      Task.find({ assignees: req.user._id, isArchived: false, status: { $ne: 'done' } })
        .populate('project', 'name color')
        .sort('deadline')
        .limit(5),
      Task.find({
        assignees: req.user._id,
        deadline: { $lt: new Date() },
        status: { $ne: 'done' },
        isArchived: false
      }).countDocuments()
    ]);

    const taskStats = await Task.aggregate([
      { $match: { assignees: req.user._id, isArchived: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stats = { todo: 0, inprogress: 0, done: 0 };
    taskStats.forEach(({ _id, count }) => { stats[_id] = count; });

    res.json({
      success: true,
      data: { projectCount: projects, myTasks, overdueTasks, taskStats: stats }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { searchUsers, getUser, getDashboard };
