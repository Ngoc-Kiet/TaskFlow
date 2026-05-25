const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  color: {
    type: String,
    default: '#6366f1'
  },
  icon: {
    type: String,
    default: '📋'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'viewer'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  columns: [{
    id: String,
    title: String,
    color: String,
    order: Number
  }],
  isArchived: {
    type: Boolean,
    default: false
  },
  dueDate: Date,
  tags: [String]
}, { timestamps: true });

// Ensure owner is always in members
projectSchema.pre('save', function(next) {
  const ownerInMembers = this.members.some(
    m => m.user.toString() === this.owner.toString()
  );
  if (!ownerInMembers) {
    this.members.push({ user: this.owner, role: 'admin' });
  }
  next();
});

// Default columns
projectSchema.pre('save', function(next) {
  if (this.isNew && (!this.columns || this.columns.length === 0)) {
    this.columns = [
      { id: 'todo', title: 'To Do', color: '#64748b', order: 0 },
      { id: 'inprogress', title: 'In Progress', color: '#3b82f6', order: 1 },
      { id: 'pending', title: 'Pending', color: '#f97316', order: 2 },
      { id: 'done', title: 'Done', color: '#22c55e', order: 3 }
    ];
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);
