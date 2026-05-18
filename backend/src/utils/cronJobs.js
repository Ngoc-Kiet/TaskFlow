const cron = require('node-cron');
const Task = require('../models/Task');
const Notification = require('../models/Notification');

// Run every day at 8:00 AM
const startDeadlineChecker = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Checking deadline notifications...');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Tasks due within 24 hours
      const urgentTasks = await Task.find({
        deadline: { $gte: today, $lte: tomorrow },
        status: { $ne: 'done' },
        isArchived: false,
        notificationSent: false
      }).populate('assignees', 'name').populate('project', 'name');

      for (const task of urgentTasks) {
        if (!task.assignees.length) continue;

        const notifications = task.assignees.map(assignee => ({
          recipient: assignee._id,
          type: 'task_deadline',
          title: '⚠️ Task sắp đến hạn',
          message: `Task "${task.title}" trong dự án "${task.project?.name}" sẽ đến hạn vào ${new Date(task.deadline).toLocaleDateString('vi-VN')}`,
          relatedTask: task._id,
          relatedProject: task.project?._id
        }));

        await Notification.insertMany(notifications);
        await Task.findByIdAndUpdate(task._id, { notificationSent: true });
        console.log(`📧 Sent deadline notification for task: ${task.title}`);
      }
    } catch (error) {
      console.error('Cron error:', error);
    }
  });

  console.log('⏰ Deadline checker cron job started');
};

module.exports = { startDeadlineChecker };
