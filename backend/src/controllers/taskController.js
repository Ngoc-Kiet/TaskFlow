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

// Helper: build history entries from diff between old task and new body
const buildHistoryEntries = (actorId, oldTask, newBody) => {
  const entries = [];

  // Simple scalar fields
  const scalarFields = [
    { field: 'title',       action: 'title_changed' },
    { field: 'description', action: 'description_changed' },
    { field: 'status',      action: 'status_changed' },
    { field: 'priority',    action: 'priority_changed' },
    { field: 'deadline',    action: 'deadline_changed' },
    { field: 'startDate',   action: 'start_date_changed' },
    { field: 'estimatedHours', action: 'estimated_hours_changed' },
    { field: 'actualHours',    action: 'actual_hours_changed' },
  ];

  for (const { field, action } of scalarFields) {
    if (newBody[field] === undefined) continue;
    const oldVal = oldTask[field];
    const newVal = newBody[field];
    // Compare as string to handle Date objects
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      const entry = { actor: actorId, action, field, oldValue: oldVal, newValue: newVal };
      if (field === 'status' && newVal === 'pending' && newBody.pendingReason) {
        entry.meta = { reason: newBody.pendingReason };
      }
      entries.push(entry);
    }
  }

  // Assignees diff
  if (newBody.assignees !== undefined) {
    const oldIds = (oldTask.assignees || []).map(a => a._id ? a._id.toString() : a.toString());
    const newIds = (newBody.assignees || []).map(a => a.toString());
    for (const id of newIds.filter(id => !oldIds.includes(id))) {
      entries.push({ actor: actorId, action: 'assignee_added', field: 'assignees', newValue: id });
    }
    for (const id of oldIds.filter(id => !newIds.includes(id))) {
      entries.push({ actor: actorId, action: 'assignee_removed', field: 'assignees', oldValue: id });
    }
  }

  // Checklist diff
  if (newBody.checklist !== undefined) {
    const oldList = oldTask.checklist || [];
    const newList = newBody.checklist || [];

    // Added items (by position beyond old length or new titles not in old)
    for (let i = oldList.length; i < newList.length; i++) {
      entries.push({
        actor: actorId,
        action: 'checklist_added',
        field: 'checklist',
        newValue: newList[i].title,
        meta: { index: i }
      });
    }

    // Removed items
    for (let i = newList.length; i < oldList.length; i++) {
      entries.push({
        actor: actorId,
        action: 'checklist_removed',
        field: 'checklist',
        oldValue: oldList[i].title,
        meta: { index: i }
      });
    }

    // Changed items within overlap
    const overlapLen = Math.min(oldList.length, newList.length);
    for (let i = 0; i < overlapLen; i++) {
      const oldItem = oldList[i];
      const newItem = newList[i];
      if (oldItem.title !== newItem.title) {
        entries.push({
          actor: actorId,
          action: 'checklist_renamed',
          field: 'checklist',
          oldValue: oldItem.title,
          newValue: newItem.title,
          meta: { index: i }
        });
      }
      if (oldItem.status !== newItem.status) {
        entries.push({
          actor: actorId,
          action: 'checklist_status_changed',
          field: 'checklist',
          oldValue: oldItem.status,
          newValue: newItem.status,
          meta: { index: i, title: newItem.title }
        });
      }
    }
  }

  return entries;
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
      query.status = { $nin: ['done', 'pending'] };
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

    if (!startDate || !deadline) {
      return res.status(400).json({ success: false, message: 'Ngày bắt đầu và deadline là 2 điều kiện bắt buộc phải điền!' });
    }

    if (new Date(startDate) >= new Date(deadline)) {
      return res.status(400).json({ success: false, message: 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc (Deadline)' });
    }

    if (status === 'pending') {
      if (!req.body.pendingReason || !req.body.pendingReason.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do tạm hoãn (pending reason)!' });
      }
    }

    // Get max order in the column
    const maxOrderTask = await Task.findOne({ project: req.params.projectId, status: status || 'todo' })
      .sort({ order: -1 });
    const order = maxOrderTask ? maxOrderTask.order + 1 : 0;

    // Default assignees to creator if none provided
    const finalAssignees = (assignees && assignees.length > 0) ? assignees : [req.user._id];

    const task = await Task.create({
      title, description,
      status: status || 'todo',
      pendingReason: status === 'pending' ? req.body.pendingReason.trim() : undefined,
      priority: priority || 'medium',
      assignees: finalAssignees,
      deadline, startDate, tags, checklist, estimatedHours, order,
      project: req.params.projectId,
      creator: req.user._id,
      history: [{
        actor: req.user._id,
        action: 'task_created',
        newValue: title,
        meta: status === 'pending' ? { reason: req.body.pendingReason.trim() } : undefined
      }]
    });

    const updatedTask = await Task.findById(task._id)
      .populate('assignees', 'name email avatar')
      .populate('creator', 'name email avatar')
      .populate('history.actor', 'name avatar');

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

    // Capture old status before mutating (needed for notification logic)
    const oldStatus = task.status;

    const newStartDate = req.body.hasOwnProperty('startDate') ? req.body.startDate : task.startDate;
    const newDeadline = req.body.hasOwnProperty('deadline') ? req.body.deadline : task.deadline;

    if (req.body.hasOwnProperty('startDate') && !req.body.startDate) {
      return res.status(400).json({ success: false, message: 'Ngày bắt đầu là bắt buộc và không được để trống!' });
    }
    if (req.body.hasOwnProperty('deadline') && !req.body.deadline) {
      return res.status(400).json({ success: false, message: 'Deadline là bắt buộc và không được để trống!' });
    }

    if (newStartDate && newDeadline && new Date(newStartDate) >= new Date(newDeadline)) {
      return res.status(400).json({ success: false, message: 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc (Deadline)' });
    }

    // --- Checklist gate: prevent marking done if checklist is incomplete ---
    if (req.body.status === 'done' && oldStatus !== 'done') {
      const checklist = task.checklist || [];
      if (checklist.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Task cần có ít nhất 1 checklist item trước khi hoàn thành!'
        });
      }
      const notDone = checklist.filter(item => item.status !== 'done' && item.status !== 'cancel');
      if (notDone.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Còn ${notDone.length} checklist chưa hoàn thành! Hoàn tất checklist trước khi đóng task.`
        });
      }
      const noEffortItems = checklist.filter(item => item.status !== 'cancel' && (!item.actualHours || item.actualHours <= 0));
      if (noEffortItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Còn ${noEffortItems.length} mục checklist chưa điền thời gian thực tế (effort)! Vui lòng điền effort trước khi hoàn thành task.`
        });
      }
    }

    // --- Pending validation: require a reason when moving to pending ---
    if (req.body.status === 'pending' && oldStatus !== 'pending') {
      if (!req.body.pendingReason || !req.body.pendingReason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp lý do tạm hoãn (pending reason)!'
        });
      }
    }

    // Build history entries before mutating
    const historyEntries = buildHistoryEntries(req.user._id, task, req.body);


    const allowedFields = ['title', 'description', 'status', 'priority', 'assignees', 'deadline', 'startDate', 'tags', 'checklist', 'estimatedHours', 'actualHours', 'order', 'isArchived', 'pendingReason'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    // Clear pendingReason if moving away from pending status
    if (req.body.status && req.body.status !== 'pending') {
      task.pendingReason = undefined;
    }

    if (historyEntries.length > 0) {
      task.history.push(...historyEntries);
    }
    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignees', 'name email avatar')
      .populate('creator', 'name email avatar')
      .populate('comments.author', 'name avatar')
      .populate('history.actor', 'name avatar');

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
    task.history.push({ actor: req.user._id, action: 'comment_added', newValue: content.substring(0, 100) });
    await task.save();
    const updatedTask = await Task.findById(task._id)
      .populate('comments.author', 'name email avatar')
      .populate('history.actor', 'name avatar');

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

const reorderTasks = async (req, res, next) => {
  try {
    const { updates } = req.body; // [{ id, status, order, pendingReason }]
    const project = await checkMember(req.params.projectId, req.user._id);
    if (!project) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    await Promise.all(
      updates.map(async ({ id, status, order, pendingReason }) => {
        const task = await Task.findById(id);
        if (!task) return;

        let changed = false;

        if (status !== undefined && status !== task.status) {
          if (status === 'pending') {
            if (!pendingReason || !pendingReason.trim()) {
              throw new Error('Vui lòng cung cấp lý do tạm hoãn (pending reason)!');
            }
            task.pendingReason = pendingReason.trim();
          } else if (status === 'done') {
            const checklist = task.checklist || [];
            if (checklist.length === 0) {
              throw new Error('Task cần có ít nhất 1 checklist item trước khi hoàn thành!');
            }
            const notDone = checklist.filter(item => item.status !== 'done' && item.status !== 'cancel');
            if (notDone.length > 0) {
              throw new Error(`Còn ${notDone.length} checklist chưa hoàn thành! Hoàn tất checklist trước khi đóng task.`);
            }
            const noEffortItems = checklist.filter(item => item.status !== 'cancel' && (!item.actualHours || item.actualHours <= 0));
            if (noEffortItems.length > 0) {
              throw new Error(`Còn ${noEffortItems.length} mục checklist chưa điền thời gian thực tế (effort)! Vui lòng điền effort trước khi hoàn thành task.`);
            }
            task.pendingReason = undefined;
          } else {
            task.pendingReason = undefined;
          }

          // Push status changed history log
          task.history.push({
            actor: req.user._id,
            action: 'status_changed',
            field: 'status',
            oldValue: task.status,
            newValue: status,
            meta: status === 'pending' ? { reason: pendingReason.trim() } : undefined
          });

          task.status = status;
          changed = true;
        }

        if (order !== undefined && order !== task.order) {
          task.order = order;
          changed = true;
        }

        if (changed) {
          await task.save();
        }
      })
    );

    res.json({ success: true, message: 'Cập nhật thứ tự task thành công!' });
  } catch (error) {
    if (error.message && (error.message.includes('lý do tạm hoãn') || error.message.includes('checklist') || error.message.includes('hoàn thành'))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Get task history
// @route   GET /api/tasks/:id/history
const getTaskHistory = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .select('history project')
      .populate('history.actor', 'name avatar');

    if (!task) return res.status(404).json({ success: false, message: 'Không tìm thấy task.' });

    const project = await checkMember(task.project, req.user._id);
    if (!project) return res.status(403).json({ success: false, message: 'Không có quyền xem lịch sử.' });

    // Return in reverse chronological order
    const history = [...task.history].reverse();
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

// @desc    Import tasks from Excel
// @route   POST /api/projects/:projectId/tasks/import
const importTasks = async (req, res, next) => {
  const XLSX = require('xlsx');
  const fs = require('fs');
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId).populate('members.user');
    if (!project) return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });

    // Check if the current user is a member
    const isMember = project.members.some(m => m.user && m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện import cho dự án này.' });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng upload file Excel!' });
    }

    const filePath = req.file.path;
    let workbook;
    try {
      workbook = XLSX.readFile(filePath, { cellDates: true });
    } catch (err) {
      console.error('Error reading excel:', err);
      try { fs.unlinkSync(filePath); } catch (e) {}
      return res.status(400).json({ success: false, message: 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.' });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets['Timeline'] || workbook.Sheets[sheetName];
    if (!sheet) {
      try { fs.unlinkSync(filePath); } catch (e) {}
      return res.status(400).json({ success: false, message: 'Không tìm thấy trang tính phù hợp để import.' });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    try { fs.unlinkSync(filePath); } catch (e) {}

    if (rows.length <= 1) {
      return res.status(400).json({ success: false, message: 'File Excel rỗng hoặc không chứa dữ liệu.' });
    }

    const cleanString = (val) => typeof val === 'string' ? val.trim() : (val != null ? String(val).trim() : '');

    const mapTaskStatus = (statusStr) => {
      const s = cleanString(statusStr).toLowerCase();
      if (s === 'backlog') return 'backlog';
      if (s === 'to do' || s === 'todo') return 'todo';
      if (s === 'in progress' || s === 'inprogress' || s === 'in-progress') return 'inprogress';
      if (s === 'pending') return 'pending';
      if (s === 'done') return 'done';
      return 'todo';
    };

    const mapChecklistStatus = (statusStr) => {
      const s = cleanString(statusStr).toLowerCase();
      if (s === 'to do' || s === 'todo') return 'todo';
      if (s === 'in progress' || s === 'inprogress' || s === 'in-progress') return 'in-progress';
      if (s === 'done') return 'done';
      if (s === 'cancel') return 'cancel';
      return 'todo';
    };

    const mapPriority = (prioStr) => {
      const p = cleanString(prioStr).toLowerCase();
      if (p === 'low' || p === 'thấp') return 'low';
      if (p === 'medium' || p === 'trung bình' || p === 'vừa') return 'medium';
      if (p === 'high' || p === 'cao') return 'high';
      if (p === 'urgent' || p === 'khẩn cấp') return 'urgent';
      return 'medium';
    };

    const tasksToCreate = [];
    const checklistItemsMap = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const wbs = cleanString(row[0]);
      const title = cleanString(row[1]);

      if (!title) continue;

      const isChecklist = wbs.includes('.');

      if (isChecklist) {
        const parentWbs = wbs.split('.')[0];
        if (!checklistItemsMap[parentWbs]) {
          checklistItemsMap[parentWbs] = [];
        }

        const checklistStatus = mapChecklistStatus(row[3]);
        const effort = row[8] ? Number(row[8]) : 0;

        checklistItemsMap[parentWbs].push({
          title,
          status: checklistStatus,
          actualHours: isNaN(effort) ? 0 : effort
        });
      } else {
        // Main task
        const rawStatus = row[3];
        const status = mapTaskStatus(rawStatus);

        const rowAssigneesStr = cleanString(row[2]);
        const rowAssigneeNames = rowAssigneesStr ? rowAssigneesStr.split(',').map(n => n.trim().toLowerCase()) : [];
        const assignees = [];
        for (const name of rowAssigneeNames) {
          const member = project.members.find(m => 
            m.user && (
              (m.user.name && m.user.name.toLowerCase() === name) || 
              (m.user.email && m.user.email.toLowerCase() === name)
            )
          );
          if (member) {
            assignees.push(member.user._id);
          }
        }
        if (assignees.length === 0) {
          assignees.push(req.user._id);
        }

        let startDate = row[5] instanceof Date ? row[5] : (row[5] ? new Date(row[5]) : null);
        let deadline = row[6] instanceof Date ? row[6] : (row[6] ? new Date(row[6]) : null);

        if (!startDate || isNaN(startDate.getTime())) {
          startDate = new Date();
        }
        if (!deadline || isNaN(deadline.getTime())) {
          deadline = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
        if (startDate >= deadline) {
          deadline = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        }

        const estimate = row[7] ? Number(row[7]) : undefined;
        const actualHours = row[8] ? Number(row[8]) : undefined;
        const description = cleanString(row[9]);
        const priority = mapPriority(row[11] || row[3]);

        tasksToCreate.push({
          wbs,
          title,
          description,
          project: projectId,
          status,
          priority,
          assignees,
          creator: req.user._id,
          deadline,
          startDate,
          estimatedHours: isNaN(estimate) ? undefined : estimate,
          actualHours: isNaN(actualHours) ? undefined : actualHours,
          checklist: []
        });
      }
    }

    const columnOrderMap = {};
    const createdTasks = [];

    for (const taskData of tasksToCreate) {
      const wbs = taskData.wbs;
      taskData.checklist = checklistItemsMap[wbs] || [];
      delete taskData.wbs;

      const status = taskData.status;
      if (columnOrderMap[status] === undefined) {
        const maxOrderTask = await Task.findOne({ project: projectId, status }).sort({ order: -1 });
        columnOrderMap[status] = maxOrderTask ? maxOrderTask.order + 1 : 0;
      } else {
        columnOrderMap[status]++;
      }
      taskData.order = columnOrderMap[status];

      taskData.history = [{
        actor: req.user._id,
        action: 'task_created',
        newValue: taskData.title
      }];

      const created = await Task.create(taskData);
      createdTasks.push(created);
    }

    res.status(201).json({
      success: true,
      message: `Import thành công ${createdTasks.length} tasks!`,
      data: createdTasks
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTasks, createTask, getTask, updateTask, deleteTask, addComment, deleteComment, reorderTasks, getTaskHistory, importTasks };
