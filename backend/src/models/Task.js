const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
    // e.g. 'status_changed', 'title_changed', 'checklist_added',
    //      'checklist_renamed', 'checklist_status_changed',
    //      'checklist_removed', 'priority_changed', 'assignee_added',
    //      'assignee_removed', 'description_changed', 'deadline_changed',
    //      'comment_added', 'task_created'
  },
  field: String,
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  meta: mongoose.Schema.Types.Mixed  // extra context (e.g. checklist title)
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }]
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  status: {
    type: String,
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deadline: Date,
  startDate: Date,
  estimatedHours: Number,
  actualHours: Number,
  tags: [String],
  labels: [{
    name: String,
    color: String
  }],
  comments: [commentSchema],
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  checklist: [{
    title: String,
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'done', 'cancel'],
      default: 'todo'
    },
    actualHours: {
      type: Number,
      default: 0
    }
  }],
  order: {
    type: Number,
    default: 0
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  history: [historySchema],
  completedAt: Date,
  notificationSent: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Update completedAt when status changes to done
taskSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'done' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'done') {
      this.completedAt = undefined;
    }
  }
  next();
});

// Virtual: is overdue
taskSchema.virtual('isOverdue').get(function() {
  if (!this.deadline) return false;
  return this.status !== 'done' && new Date() > this.deadline;
});

// Virtual: days until deadline
taskSchema.virtual('daysUntilDeadline').get(function() {
  if (!this.deadline) return null;
  const diff = this.deadline - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

taskSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);
