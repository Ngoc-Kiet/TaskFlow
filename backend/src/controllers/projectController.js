const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Create project
// @route   POST /api/projects
const createProject = async (req, res, next) => {
  try {
    const { name, description, color, icon, dueDate } = req.body;
    const project = await Project.create({
      name, description, color, icon, dueDate,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }]
    });

    const populatedProject = await Project.findById(project._id).populate('members.user', 'name email avatar');

    res.status(201).json({ success: true, message: 'Tạo dự án thành công!', data: populatedProject });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all projects for current user
// @route   GET /api/projects
const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({
      'members.user': req.user._id,
      isArchived: false
    })
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .sort('-createdAt');

    // Add task counts
    const projectsWithCounts = await Promise.all(
      projects.map(async (p) => {
        const taskCounts = await Task.aggregate([
          { $match: { project: p._id, isArchived: false } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const counts = { total: 0, todo: 0, inprogress: 0, done: 0 };
        taskCounts.forEach(({ _id, count }) => {
          counts[_id] = count;
          counts.total += count;
        });
        return { ...p.toObject(), taskCounts: counts };
      })
    );

    res.json({ success: true, data: projectsWithCounts });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single project
// @route   GET /api/projects/:id
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });
    }

    const isMember = project.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem dự án này.' });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });

    const memberRole = project.members.find(m => m.user.toString() === req.user._id.toString())?.role;
    if (!['admin'].includes(memberRole) && project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa dự án.' });
    }

    const { name, description, color, icon, dueDate, columns } = req.body;
    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      { name, description, color, icon, dueDate, columns },
      { new: true, runValidators: true }
    ).populate('members.user', 'name email avatar');

    res.json({ success: true, message: 'Cập nhật dự án thành công!', data: updated });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ dự án mới có thể xóa.' });
    }

    await Task.deleteMany({ project: project._id });
    await project.deleteOne();

    res.json({ success: true, message: 'Xóa dự án thành công!' });
  } catch (error) {
    next(error);
  }
};

// @desc    Add member to project
// @route   POST /api/projects/:id/members
const addMember = async (req, res, next) => {
  try {
    const { email: rawEmail, role = 'member' } = req.body;
    const email = rawEmail.toLowerCase();
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });

    console.log('addMember request:', req.params.id, email);
    const userToAdd = await User.findOne({ email });
    if (!userToAdd) {
      console.log('User not found for email:', email);
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng với email này.' });
    }

    const alreadyMember = project.members.some(m => m.user.toString() === userToAdd._id.toString());
    if (alreadyMember) return res.status(400).json({ success: false, message: 'Người dùng đã là thành viên.' });

    project.members.push({ user: userToAdd._id, role });
    await project.save();

    // Send notification
    await Notification.create({
      recipient: userToAdd._id,
      type: 'project_invitation',
      title: 'Bạn được thêm vào dự án',
      message: `${req.user.name} đã thêm bạn vào dự án "${project.name}"`,
      relatedProject: project._id,
      sender: req.user._id
    });

    const updatedProject = await Project.findById(project._id).populate('members.user', 'name email avatar');
    res.json({ success: true, message: 'Thêm thành viên thành công!', data: updatedProject });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from project
// @route   DELETE /api/projects/:id/members/:userId
const removeMember = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ dự án mới có thể xóa thành viên.' });
    }

    if (req.params.userId === project.owner.toString()) {
      return res.status(400).json({ success: false, message: 'Không thể xóa chủ dự án.' });
    }

    project.members = project.members.filter(m => m.user.toString() !== req.params.userId);
    await project.save();
    const updatedProject = await Project.findById(project._id).populate('members.user', 'name email avatar');
    res.json({ success: true, message: 'Xóa thành viên thành công!', data: updatedProject });
  } catch (error) {
    next(error);
  }
};

// @desc    Get project statistics
// @route   GET /api/projects/:id/stats
const getProjectStats = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });

    const tasks = await Task.find({ project: project._id, isArchived: false })
      .populate('assignees', 'name avatar');

    const total = tasks.length;
    const byStatus = {};
    const byPriority = {};
    const overdue = [];
    const byMember = {};

    tasks.forEach(task => {
      // By status
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      // By priority
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
      // Overdue
      if (task.deadline && task.status !== 'done' && new Date() > task.deadline) {
        overdue.push(task);
      }
      // By member
      task.assignees.forEach(a => {
        const key = a._id.toString();
        if (!byMember[key]) byMember[key] = { user: a, total: 0, done: 0 };
        byMember[key].total++;
        if (task.status === 'done') byMember[key].done++;
      });
    });

    // Weekly progress (last 7 days)
    const weeklyProgress = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const completed = tasks.filter(t =>
        t.completedAt && t.completedAt >= date && t.completedAt < nextDate
      ).length;

      weeklyProgress.push({
        date: date.toLocaleDateString('vi-VN', { weekday: 'short', month: 'short', day: 'numeric' }),
        completed
      });
    }

    res.json({
      success: true,
      data: {
        total,
        byStatus,
        byPriority,
        overdueCount: overdue.length,
        byMember: Object.values(byMember),
        weeklyProgress,
        completionRate: total > 0 ? Math.round(((byStatus.done || 0) / total) * 100) : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export project to Excel
// @route   POST /api/projects/:id/export
const exportExcel = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });

    const tasks = await Task.find({ project: project._id, isArchived: false })
      .populate('assignees', 'name email avatar')
      .sort({ order: 1 });

    const exportData = {
      columns: project.columns,
      tasks: tasks
    };

    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    
    const tempDir = path.join(require('os').tmpdir(), `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    const jsonPath = path.join(tempDir, 'data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(exportData));
    
    const scriptPath = path.join(__dirname, '../utils/export_excel.py');
    const templatePath = path.join(__dirname, '../utils/template.xlsx');
    const outPath = path.join(tempDir, 'out.xlsx');
    
    exec(`python3 "${scriptPath}" "${jsonPath}" "${templatePath}" "${outPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Export error:', error, stderr);
        return res.status(500).json({ success: false, message: 'Lỗi khi tạo file Excel.' });
      }
      
      res.download(outPath, `${project.name}_Timeline.xlsx`, (err) => {
        // Cleanup temp dir
        fs.rmSync(tempDir, { recursive: true, force: true });
      });
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { createProject, getProjects, getProject, updateProject, deleteProject, addMember, removeMember, getProjectStats, exportExcel };
