const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');

// Helper: check project member
const checkMember = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return null;
  const member = project.members.find(m => m.user.toString() === userId.toString());
  return member ? project : null;
};

// @desc    Get tasks for a project
// @route   GET /api/projects/:projectId/tasks
const getTasks = async (req, res, next) => {
  try {
    const { status, priority, assignee, search, deadline, page = 1, limit = 100 } = req.query;

    const project = await checkMember(req.params.projectId, req.user._id);
    if (!project) return res.status(403).json({ success: false, message: 'Không có quyền truy cập dự án.' });

    const query = { project: req.params.projectId, isArchived: false };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignee) query.assignees = assignee;
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
    if (deadline === 'overdue') {
      query.deadline = { $lt: new Date() };
      query.status = { $ne: 'done' };
    } else if (deadline === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      query.deadline = { $gte: today, $lt: tomorrow };
    } else if (deadline === 'week') {
      const now = new Date();
      const weekLater = new Date();
      weekLater.setDate(weekLater.getDate() + 7);
      query.deadline = { $gte: now, $lte: weekLater };
    }

    const tasks = await Task.find(query)
      .populate('assignees', 'name email avatar')
      .populate('creator', 'name email avatar')
      .populate('comments.author', 'name avatar')
      .sort({ order: 1, createdAt: -1 });

    res.json({ success: true, data: tasks, total: tasks.length });
  } catch (error) {
    next(error);
  }
};

// @desc    Create task
// @route   POST /api/projects/:projectId/tasks
const createTask = async (req, res, next) => {
  try {
    const project = await checkMember(req.params.projectId, req.user._id);
    if (!project) return res.status(403).json({ success: false, message: 'Không có quyền truy cập dự án.' });

    const { title, description, status, priority, assignees, deadline, startDate, tags, checklist, estimatedHours } = req.body;

    // Get max order in the column
    const maxOrderTask = await Task.findOne({ project: req.params.projectId, status: status || 'todo' })
      .sort({ order: -1 });
    const order = maxOrderTask ? maxOrderTask.order + 1 : 0;

    const task = await Task.create({
      title, description,
      status: status || 'todo',
      priority: priority || 'medium',
      assignees: assignees || [],
      deadline, startDate, tags, checklist, estimatedHours, order,
      project: req.params.projectId,
      creator: req.user._id
    });

    const updatedTask = await Task.findById(task._id)
      .populate('assignees', 'name email avatar')
      .populate('creator', 'name email avatar');

    // Notify assignees
    if (assignees && assignees.length > 0) {
      const notifications = assignees
        .filter(a => a.toString() !== req.user._id.toString())
        .map(assigneeId => ({
          recipient: assigneeId,
          type: 'task_assigned',
          title: 'Bạn được giao task mới',
          message: `${req.user.name} đã giao task "${title}" cho bạn trong dự án "${project.name}"`,
          relatedTask: task._id,
          relatedProject: project._id,
          sender: req.user._id
        }));
      if (notifications.length > 0) await Notification.insertMany(notifications);
    }

    res.status(201).json({ success: true, message: 'Tạo task thành công!', data: updatedTask });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignees', 'name email avatar')
      .populate('creator', 'name email avatar')
      .populate('comments.author', 'name email avatar')
      .populate('attachments.uploadedBy', 'name avatar');

    if (!task) return res.status(404).json({ success: false, message: 'Không tìm thấy task.' });

    const project = await checkMember(task.project, req.user._id);
    if (!project) return res.status(403).json({ success: false, message: 'Không có quyền xem task này.' });

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Không tìm thấy task.' });

    const project = await checkMember(task.project, req.user._id);
    if (!project) return res.status(403).json({ success: false, message: 'Không có quyền cập nhật task này.' });

    const oldStatus = task.status;
    const allowedFields = ['title', 'description', 'status', 'priority', 'assignees', 'deadline', 'startDate', 'tags', 'checklist', 'estimatedHours', 'actualHours', 'order', 'isArchived'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });
    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignees', 'name email avatar')
      .populate('creator', 'name email avatar')
      .populate('comments.author', 'name avatar');

    // Notify if status changed to done
    if (req.body.status && req.body.status !== oldStatus && req.body.status === 'done') {
      const notifications = project.members
        .filter(m => m.user.toString() !== req.user._id.toString())
        .map(m => ({
          recipient: m.user,
          type: 'task_completed',
          title: 'Task đã hoàn thành',
          message: `${req.user.name} đã hoàn thành task "${task.title}"`,
          relatedTask: task._id,
          relatedProject: project._id,
          sender: req.user._id
        }));
      if (notifications.length > 0) await Notification.insertMany(notifications);
    }

    // Notify new assignees
    if (req.body.assignees) {
      const newAssignees = req.body.assignees.filter(a => !task.assignees.some(ea => ea._id.toString() === a.toString()));
      const notifications = newAssignees
        .filter(a => a.toString() !== req.user._id.toString())
        .map(assigneeId => ({
          recipient: assigneeId,
          type: 'task_assigned',
          title: 'Bạn được giao task',
          message: `${req.user.name} đã giao task "${task.title}" cho bạn`,
          relatedTask: task._id,
          relatedProject: project._id,
          sender: req.user._id
        }));
      if (notifications.length > 0) await Notification.insertMany(notifications);
    }

    res.json({ success: true, message: 'Cập nhật task thành công!', data: updatedTask });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Không tìm thấy task.' });

    const project = await checkMember(task.project, req.user._id);
    if (!project) return res.status(403).json({ success: false, message: 'Không có quyền xóa task này.' });

    await task.deleteOne();
    res.json({ success: true, message: 'Xóa task thành công!' });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to task
// @route   POST /api/tasks/:id/comments
const addComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Không tìm thấy task.' });

    const project = await checkMember(task.project, req.user._id);
    if (!project) return res.status(403).json({ success: false, message: 'Không có quyền bình luận.' });

    if (!task.comments) task.comments = [];
    task.comments.push({ content, author: req.user._id, createdAt: new Date() });
    await task.save();
    const updatedTask = await Task.findById(task._id).populate('comments.author', 'name email avatar');

    const newComment = updatedTask.comments[updatedTask.comments.length - 1];

    // Notify task creator and assignees (excluding commenter)
    const notifyUsers = [...new Set([
      task.creator.toString(),
      ...task.assignees.map(a => a.toString())
    ])].filter(uid => uid !== req.user._id.toString());

    if (notifyUsers.length > 0) {
      const notifications = notifyUsers.map(uid => ({
        recipient: uid,
        type: 'task_comment',
        title: 'Bình luận mới trong task',
        message: `${req.user.name} đã bình luận trong task "${task.title}": "${content.substring(0, 50)}..."`,
        relatedTask: task._id,
        relatedProject: task.project,
        sender: req.user._id
      }));
      await Notification.insertMany(notifications);
    }

    res.status(201).json({ success: true, message: 'Thêm bình luận thành công!', data: newComment });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/tasks/:id/comments/:commentId
const deleteComment = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Không tìm thấy task.' });

    const comment = task.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận.' });

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa bình luận này.' });
    }

    comment.deleteOne();
    await task.save();
    res.json({ success: true, message: 'Xóa bình luận thành công!' });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task order (drag & drop)
// @route   PUT /api/projects/:projectId/tasks/reorder
const reorderTasks = async (req, res, next) => {
  try {
    const { updates } = req.body; // [{ id, status, order }]
    const project = await checkMember(req.params.projectId, req.user._id);
    if (!project) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    await Promise.all(
      updates.map(({ id, status, order }) =>
        Task.findByIdAndUpdate(id, { status, order })
      )
    );

    res.json({ success: true, message: 'Cập nhật thứ tự task thành công!' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTasks, createTask, getTask, updateTask, deleteTask, addComment, deleteComment, reorderTasks };
