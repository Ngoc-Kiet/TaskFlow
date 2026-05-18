# ⚡ TaskFlow - Quản lý Công việc Nhóm

> Ứng dụng quản lý công việc nhóm hiện đại, tương tự Trello/Notion, với đầy đủ tính năng cho doanh nghiệp.

![TaskFlow Banner](https://via.placeholder.com/1200x400/6366f1/ffffff?text=TaskFlow+%E2%80%93+Team+Task+Manager)

## ✨ Tính năng chính

- 🔐 **Xác thực**: Đăng ký / Đăng nhập với JWT
- 📁 **Dự án**: Tạo, sửa, xóa dự án với màu sắc và icon tùy chỉnh
- 👥 **Thành viên**: Mời thành viên qua email, phân quyền (Admin/Member/Viewer)
- 📋 **Kanban Board**: Drag & drop task giữa các cột
- ✅ **Quản lý Task**: Tạo/sửa/xóa task với đầy đủ thông tin
- 🎯 **Giao task**: Assign task cho nhiều thành viên
- 📅 **Deadline**: Đặt deadline, cảnh báo quá hạn
- 🔴 **Độ ưu tiên**: Urgent / High / Medium / Low
- 💬 **Bình luận**: Comment trong từng task
- 📎 **File đính kèm**: Upload file vào task
- ✓ **Checklist**: Danh sách công việc nhỏ trong task
- 🔍 **Tìm kiếm & Lọc**: Theo thành viên, trạng thái, deadline, priority
- 📊 **Dashboard**: Thống kê tổng quan với biểu đồ
- 🔔 **Thông báo**: Real-time + cron job deadline reminder
- 🌙 **Dark Mode**: Giao diện tối hiện đại

---

## 🏗️ Kiến trúc

```
quanLy/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js           # MongoDB connection
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── projectController.js
│   │   │   ├── taskController.js
│   │   │   ├── notificationController.js
│   │   │   └── userController.js
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT middleware
│   │   │   └── errorHandler.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Project.js
│   │   │   ├── Task.js
│   │   │   └── Notification.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── projects.js
│   │   │   ├── tasks.js
│   │   │   └── misc.js
│   │   ├── seeds/
│   │   │   └── seed.js         # Seed data mẫu
│   │   ├── utils/
│   │   │   └── cronJobs.js     # Deadline notifications
│   │   └── server.js           # Entry point
│   ├── .env                    # Environment variables
│   └── package.json
│
├── frontend/                   # React + TailwindCSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── common/
│   │   │   │   ├── PrivateRoute.jsx
│   │   │   │   └── NotificationPanel.jsx
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   ├── project/
│   │   │   │   ├── CreateProjectModal.jsx
│   │   │   │   ├── MembersPanel.jsx
│   │   │   │   └── ProjectStats.jsx
│   │   │   └── task/
│   │   │       ├── TaskCard.jsx
│   │   │       ├── TaskModal.jsx
│   │   │       ├── CreateTaskModal.jsx
│   │   │       └── TaskFilters.jsx
│   │   ├── contexts/
│   │   │   ├── useAuthStore.js
│   │   │   ├── useProjectStore.js
│   │   │   └── useTaskStore.js
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── ProjectPage.jsx
│   │   │   └── ProfilePage.jsx
│   │   ├── services/
│   │   │   ├── api.js          # Axios instance
│   │   │   └── index.js        # Service functions
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Hướng dẫn cài đặt & chạy

### Yêu cầu hệ thống
- Node.js >= 18
- MongoDB >= 6 (hoặc MongoDB Atlas)
- npm hoặc yarn

---

### 🔧 Cách 1: Chạy Local (Development)

#### Bước 1: Clone & cài đặt Backend
```bash
cd backend
cp .env.example .env   # Chỉnh sửa file .env nếu cần
npm install
```

#### Bước 2: Cài đặt Frontend
```bash
cd frontend
npm install
```

#### Bước 3: Seed database (dữ liệu mẫu)
```bash
cd backend
npm run seed
```

Output khi seed thành công:
```
✅ Connected to MongoDB
🗑️  Cleared existing data
👥 Created 5 users
📁 Created 3 projects
✅ Created all tasks with comments

📊 Seed Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Users:
   admin@taskflow.com / password123 (Admin)
   an@taskflow.com / password123
   binh@taskflow.com / password123
   cuong@taskflow.com / password123
   dung@taskflow.com / password123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Projects: 3 created
📋 Tasks: 15 created
🎉 Database seeded successfully!
```

#### Bước 4: Khởi động servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server chạy tại: http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App chạy tại: http://localhost:3000
```

---

### 🐳 Cách 2: Docker Compose

```bash
# Build và khởi động tất cả services
docker-compose up --build -d

# Seed data (lần đầu)
docker exec taskflow-backend node src/seeds/seed.js

# Xem logs
docker-compose logs -f

# Dừng
docker-compose down
```

App sẽ chạy tại: `http://localhost`

---

## 🌐 API Endpoints

### Authentication
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/me` | Thông tin cá nhân |
| PUT | `/api/auth/profile` | Cập nhật profile |
| PUT | `/api/auth/change-password` | Đổi mật khẩu |

### Projects
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects` | Danh sách dự án |
| POST | `/api/projects` | Tạo dự án |
| GET | `/api/projects/:id` | Chi tiết dự án |
| PUT | `/api/projects/:id` | Cập nhật dự án |
| DELETE | `/api/projects/:id` | Xóa dự án |
| GET | `/api/projects/:id/stats` | Thống kê dự án |
| POST | `/api/projects/:id/members` | Thêm thành viên |
| DELETE | `/api/projects/:id/members/:userId` | Xóa thành viên |

### Tasks
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects/:id/tasks` | Danh sách tasks |
| POST | `/api/projects/:id/tasks` | Tạo task |
| GET | `/api/tasks/:id` | Chi tiết task |
| PUT | `/api/tasks/:id` | Cập nhật task |
| DELETE | `/api/tasks/:id` | Xóa task |
| PUT | `/api/projects/:id/tasks/reorder` | Sắp xếp task (DnD) |
| POST | `/api/tasks/:id/comments` | Thêm bình luận |
| DELETE | `/api/tasks/:id/comments/:cId` | Xóa bình luận |

### Notifications & Users
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/notifications` | Danh sách thông báo |
| PUT | `/api/notifications/read-all` | Đọc tất cả |
| PUT | `/api/notifications/:id/read` | Đánh dấu đã đọc |
| GET | `/api/users/search?q=` | Tìm kiếm user |
| GET | `/api/users/dashboard` | Dữ liệu dashboard |

---

## 🗄️ Database Schema

### User
```json
{
  "name": "string",
  "email": "string (unique)",
  "password": "string (hashed)",
  "avatar": "string (url)",
  "role": "user | admin",
  "isActive": "boolean",
  "lastSeen": "Date"
}
```

### Project
```json
{
  "name": "string",
  "description": "string",
  "color": "string (#hex)",
  "icon": "string (emoji)",
  "owner": "ObjectId(User)",
  "members": [{ "user": "ObjectId", "role": "admin|member|viewer" }],
  "columns": [{ "id": "string", "title": "string", "color": "string", "order": "number" }],
  "isArchived": "boolean",
  "dueDate": "Date"
}
```

### Task
```json
{
  "title": "string",
  "description": "string",
  "project": "ObjectId(Project)",
  "status": "string (column id)",
  "priority": "low | medium | high | urgent",
  "assignees": ["ObjectId(User)"],
  "creator": "ObjectId(User)",
  "deadline": "Date",
  "tags": ["string"],
  "comments": [{ "content": "string", "author": "ObjectId" }],
  "attachments": [{ "name": "string", "url": "string", "type": "string" }],
  "checklist": [{ "title": "string", "completed": "boolean" }],
  "order": "number",
  "isArchived": "boolean"
}
```

---

## 🌍 Deploy lên VPS (Ubuntu)

```bash
# 1. Cài Docker
curl -fsSL https://get.docker.com | sh

# 2. Clone project
git clone <your-repo> && cd quanLy

# 3. Cập nhật .env trong backend (đặt JWT_SECRET mạnh)
nano backend/.env

# 4. Cập nhật JWT_SECRET trong docker-compose.yml

# 5. Build và chạy
docker-compose up --build -d

# 6. Seed data
docker exec taskflow-backend node src/seeds/seed.js

# 7. Xem logs
docker-compose logs -f backend
```

## Deploy lên Vercel + Railway

**Backend → Railway:**
1. Push code lên GitHub
2. Tạo project mới trên Railway
3. Chọn `Deploy from GitHub`, chọn thư mục `backend`
4. Add environment variables từ `.env`
5. Add MongoDB plugin hoặc dùng MongoDB Atlas

**Frontend → Vercel:**
1. Tạo project mới trên Vercel
2. Chọn thư mục `frontend`
3. Thêm env: `VITE_API_URL=https://your-railway-url.railway.app/api`
4. Deploy!

---

## 🔧 Biến môi trường Backend (.env)

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/taskflow
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000

# Cloudinary (optional - để upload file)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 👤 Tài khoản demo (sau khi seed)

| Email | Mật khẩu | Vai trò |
|-------|----------|--------|
| admin@taskflow.com | password123 | Admin |
| an@taskflow.com | password123 | User |
| binh@taskflow.com | password123 | User |
| cuong@taskflow.com | password123 | User |
| dung@taskflow.com | password123 | User |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS 3 |
| State | Zustand |
| Routing | React Router v6 |
| Drag & Drop | @dnd-kit |
| Charts | Recharts |
| HTTP Client | Axios |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Auth | JWT, bcryptjs |
| Real-time | Socket.io |
| Scheduler | node-cron |
| Container | Docker, Docker Compose |
| Web Server | Nginx |

---

Made with ❤️ by TaskFlow Team
