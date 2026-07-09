require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { startDeadlineChecker } = require('./utils/cronJobs');

// Connect Database
connectDB().then(() => {
  // Run migration after a short delay to ensure jsonDb is initialized if offline
  setTimeout(migrateProjects, 1000);
});

// Migration: add backlog and review columns to existing projects if missing
const migrateProjects = async () => {
  try {
    const Project = require('./models/Project');
    const projects = await Project.find({});
    for (const project of projects) {
      const cols = project.columns.map(c => c.toObject ? c.toObject() : c);
      
      let changed = false;

      // Check backlog
      const hasBacklog = cols.some(c => c.id === 'backlog');
      if (!hasBacklog) {
        cols.unshift({ id: 'backlog', title: 'Backlog', color: '#a855f7', order: 0 });
        changed = true;
      }

      // Check review
      const hasReview = cols.some(c => c.id === 'review');
      if (!hasReview) {
        const inprogIndex = cols.findIndex(c => c.id === 'inprogress');
        if (inprogIndex !== -1) {
          cols.splice(inprogIndex + 1, 0, { id: 'review', title: 'Review', color: '#f59e0b', order: 0 });
          changed = true;
        } else {
          const doneIndex = cols.findIndex(c => c.id === 'done');
          if (doneIndex !== -1) {
            cols.splice(doneIndex, 0, { id: 'review', title: 'Review', color: '#f59e0b', order: 0 });
            changed = true;
          }
        }
      }

      if (changed) {
        // Re-assign order values 0, 1, 2, ...
        const updatedColumns = cols.map((c, idx) => ({
          id: c.id,
          title: c.title,
          color: c.color,
          order: idx
        }));

        project.columns = updatedColumns;
        await project.save();
        console.log(`🔧 Auto-migrated columns for project: ${project.name}`);
      }
    }
  } catch (error) {
    console.error('❌ Project migration failed:', error);
  }
};

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Make io available in controllers
app.set('io', io);

// Socket events
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    console.log(`📁 User joined project room: ${projectId}`);
  });

  socket.on('leave-project', (projectId) => {
    socket.leave(`project-${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Tạm thời: Route để fix lỗi password (xóa admin cũ và tạo lại đúng cách)
app.get('/api/fix-admin', async (req, res) => {
  try {
    const User = require('./models/User');
    await User.deleteOne({ email: 'admin@gmail.com' }); // Xóa account bị lỗi
    
    // TRUYỀN RAW PASSWORD vì trong User.js đã có hook pre('save') tự động mã hóa!
    await User.create({
      name: 'Admin',
      email: 'admin@gmail.com',
      password: 'password123', // Truyền raw, hook sẽ tự mã hóa!
      role: 'admin',
      isActive: true,
      avatar: ''
    });
    res.json({ message: '✅ Đã sửa và tạo lại admin@gmail.com thành công!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/misc'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error handler
app.use(errorHandler);

// Start cron jobs
startDeadlineChecker();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
