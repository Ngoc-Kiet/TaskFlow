require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ---- JsonDB minimal (không cần mongoose) ----
const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const newId = () => crypto.randomBytes(12).toString('hex');
const now = new Date();
const addDays = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString(); };

const saveCol = (name, docs) => {
  fs.writeFileSync(path.join(DB_DIR, `${name}.json`), JSON.stringify(docs, null, 2));
};

const seed = async () => {
  try {
    console.log('🌱 Seeding JsonDB (offline mode)...');

    // Create users
    const pass = await bcrypt.hash('password123', 12);
    const adminId = newId(), anId = newId(), binhId = newId(), cuongId = newId(), dungId = newId();

    const users = [
      { _id: adminId, name: 'Admin User', email: 'admin@taskflow.com', password: pass, role: 'admin', isActive: true, avatar: '', createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: anId,    name: 'Nguyễn Văn An', email: 'an@taskflow.com', password: pass, role: 'user', isActive: true, avatar: '', createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: binhId,  name: 'Trần Thị Bình', email: 'binh@taskflow.com', password: pass, role: 'user', isActive: true, avatar: '', createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: cuongId, name: 'Lê Văn Cường', email: 'cuong@taskflow.com', password: pass, role: 'user', isActive: true, avatar: '', createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: dungId,  name: 'Phạm Thị Dung', email: 'dung@taskflow.com', password: pass, role: 'user', isActive: true, avatar: '', createdAt: now.toISOString(), updatedAt: now.toISOString() },
    ];
    saveCol('users', users);
    console.log(`👥 Created ${users.length} users`);

    // Create projects
    const p1Id = newId(), p2Id = newId(), p3Id = newId();
    const defaultCols = [
      { id: 'todo', title: 'To Do', color: '#64748b', order: 0 },
      { id: 'inprogress', title: 'In Progress', color: '#3b82f6', order: 1 },
      { id: 'pending', title: 'Pending', color: '#f97316', order: 2 },
      { id: 'done', title: 'Done', color: '#22c55e', order: 3 }
    ];
    const projects = [
      {
        _id: p1Id, name: 'TaskFlow Website Redesign',
        description: 'Thiết kế lại giao diện website TaskFlow với trải nghiệm người dùng tốt hơn.',
        color: '#6366f1', icon: '🎨', owner: adminId,
        members: [
          { user: adminId, role: 'admin', joinedAt: now.toISOString() },
          { user: anId, role: 'member', joinedAt: now.toISOString() },
          { user: binhId, role: 'member', joinedAt: now.toISOString() },
          { user: cuongId, role: 'viewer', joinedAt: now.toISOString() }
        ],
        columns: [
          { id: 'todo', title: 'To Do', color: '#64748b', order: 0 },
          { id: 'inprogress', title: 'In Progress', color: '#3b82f6', order: 1 },
          { id: 'review', title: 'Review', color: '#f59e0b', order: 2 },
          { id: 'pending', title: 'Pending', color: '#f97316', order: 3 },
          { id: 'done', title: 'Done', color: '#22c55e', order: 4 }
        ],
        isArchived: false, tags: [], createdAt: now.toISOString(), updatedAt: now.toISOString()
      },
      {
        _id: p2Id, name: 'Mobile App Development',
        description: 'Phát triển ứng dụng di động cho iOS và Android.',
        color: '#8b5cf6', icon: '📱', owner: anId,
        members: [
          { user: anId, role: 'admin', joinedAt: now.toISOString() },
          { user: binhId, role: 'member', joinedAt: now.toISOString() },
          { user: dungId, role: 'member', joinedAt: now.toISOString() }
        ],
        columns: defaultCols, isArchived: false, tags: [], createdAt: now.toISOString(), updatedAt: now.toISOString()
      },
      {
        _id: p3Id, name: 'Marketing Campaign Q2',
        description: 'Chiến dịch marketing cho quý 2 năm 2024.',
        color: '#ec4899', icon: '📢', owner: binhId,
        members: [
          { user: binhId, role: 'admin', joinedAt: now.toISOString() },
          { user: adminId, role: 'member', joinedAt: now.toISOString() },
          { user: cuongId, role: 'member', joinedAt: now.toISOString() },
          { user: dungId, role: 'member', joinedAt: now.toISOString() }
        ],
        columns: defaultCols, isArchived: false, tags: [], createdAt: now.toISOString(), updatedAt: now.toISOString()
      }
    ];
    saveCol('projects', projects);
    console.log(`📁 Created ${projects.length} projects`);

    // Create tasks
    const tasks = [
      // Project 1
      { _id: newId(), title: 'Phân tích yêu cầu và wireframe', description: 'Thu thập yêu cầu từ stakeholder và vẽ wireframe.', project: p1Id, status: 'done', priority: 'high', assignees: [anId], creator: adminId, deadline: addDays(-5), order: 0, completedAt: addDays(-6), tags: ['design', 'planning'], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Thiết kế UI/UX hệ thống', description: 'Tạo design system với màu sắc, typography và components.', project: p1Id, status: 'done', priority: 'high', assignees: [binhId, anId], creator: adminId, deadline: addDays(-2), order: 1, completedAt: addDays(-3), tags: ['design'], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Phát triển trang Landing Page', description: 'Code trang landing page theo design đã được duyệt.', project: p1Id, status: 'inprogress', priority: 'urgent', assignees: [anId], creator: adminId, deadline: addDays(3), order: 0, tags: ['frontend'], comments: [
        { _id: newId(), content: 'Tôi đang làm phần header và navigation.', author: anId, createdAt: now.toISOString() },
        { _id: newId(), content: 'Nhớ kiểm tra responsive trên mobile nhé!', author: adminId, createdAt: now.toISOString() }
      ], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Phát triển trang Dashboard', description: 'Tạo dashboard với các biểu đồ thống kê.', project: p1Id, status: 'inprogress', priority: 'high', assignees: [binhId], creator: adminId, deadline: addDays(5), order: 1, tags: ['frontend', 'charts'], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Setup CI/CD pipeline', description: 'Cấu hình GitHub Actions.', project: p1Id, status: 'todo', priority: 'medium', assignees: [cuongId], creator: adminId, deadline: addDays(7), order: 0, tags: ['devops'], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Testing & QA toàn bộ website', description: 'Kiểm tra tất cả chức năng.', project: p1Id, status: 'todo', priority: 'high', assignees: [anId, binhId], creator: adminId, deadline: addDays(14), order: 1, tags: ['testing'], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Viết tài liệu kỹ thuật', description: 'Tài liệu API, hướng dẫn cài đặt.', project: p1Id, status: 'todo', priority: 'low', assignees: [], creator: adminId, deadline: addDays(20), order: 2, tags: ['documentation'], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      // Project 2
      { _id: newId(), title: 'Setup React Native project', description: 'Khởi tạo project React Native.', project: p2Id, status: 'done', priority: 'high', assignees: [anId], creator: anId, deadline: addDays(-10), order: 0, completedAt: addDays(-11), tags: [], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Màn hình đăng nhập & đăng ký', description: 'Tạo UI cho authentication.', project: p2Id, status: 'inprogress', priority: 'urgent', assignees: [binhId], creator: anId, deadline: addDays(2), order: 0, tags: [], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Tích hợp Push Notifications', description: 'Setup Firebase Cloud Messaging.', project: p2Id, status: 'todo', priority: 'medium', assignees: [dungId], creator: anId, deadline: addDays(10), order: 0, tags: [], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Màn hình danh sách task', description: 'Hiển thị và quản lý task.', project: p2Id, status: 'todo', priority: 'high', assignees: [anId, binhId], creator: anId, deadline: addDays(8), order: 1, tags: [], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      // Project 3
      { _id: newId(), title: 'Nghiên cứu thị trường', description: 'Phân tích chiến lược marketing đối thủ.', project: p3Id, status: 'done', priority: 'high', assignees: [binhId], creator: binhId, deadline: addDays(-8), order: 0, completedAt: addDays(-9), tags: [], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Tạo nội dung Social Media', description: 'Viết và thiết kế content.', project: p3Id, status: 'inprogress', priority: 'high', assignees: [dungId, cuongId], creator: binhId, deadline: addDays(4), order: 0, tags: [], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Chạy quảng cáo Google Ads', description: 'Setup và tối ưu chiến dịch Google Ads.', project: p3Id, status: 'todo', priority: 'urgent', assignees: [cuongId], creator: binhId, deadline: addDays(1), order: 0, tags: [], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
      { _id: newId(), title: 'Báo cáo hiệu quả chiến dịch', description: 'Tổng hợp số liệu và ROI.', project: p3Id, status: 'todo', priority: 'medium', assignees: [adminId], creator: binhId, deadline: addDays(30), order: 1, tags: [], comments: [], checklist: [], attachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() },
    ];
    saveCol('tasks', tasks);
    saveCol('notifications', []);
    console.log(`📋 Created ${tasks.length} tasks`);

    console.log('\n📊 Seed Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Users:');
    console.log('   admin@taskflow.com / password123 (Admin)');
    console.log('   an@taskflow.com / password123');
    console.log('   binh@taskflow.com / password123');
    console.log('   cuong@taskflow.com / password123');
    console.log('   dung@taskflow.com / password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📁 Projects: ${projects.length} created`);
    console.log(`📋 Tasks: ${tasks.length} created`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 JsonDB seeded successfully!');
    console.log(`📂 Data saved to: ${DB_DIR}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seed();
