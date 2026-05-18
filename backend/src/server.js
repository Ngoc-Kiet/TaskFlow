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
connectDB();

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
