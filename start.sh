#!/bin/bash
# TaskFlow - Script khởi động nhanh
# Chạy: bash start.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}⚡ TaskFlow - Khởi động ứng dụng${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo -e "${RED}❌ Node.js chưa được cài. Tải tại: https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"

# Check MongoDB
MONGO_RUNNING=false
if mongod --version &>/dev/null 2>&1; then
  echo -e "${GREEN}✅ MongoDB đã cài${NC}"
  # Try to start if not running
  if ! pgrep mongod > /dev/null; then
    mkdir -p ~/data/db
    mongod --dbpath ~/data/db --fork --logpath /tmp/mongod.log
    sleep 2
  fi
  MONGO_RUNNING=true
elif brew services list 2>/dev/null | grep -q "mongodb.*started"; then
  echo -e "${GREEN}✅ MongoDB đang chạy (brew)${NC}"
  MONGO_RUNNING=true
fi

if [ "$MONGO_RUNNING" = false ]; then
  echo -e "${YELLOW}⚠️  MongoDB không tìm thấy locally.${NC}"
  echo ""
  echo -e "${YELLOW}Lựa chọn:${NC}"
  echo "  1. Cài MongoDB: https://www.mongodb.com/try/download/community"
  echo "  2. Dùng MongoDB Atlas (cloud free): https://www.mongodb.com/cloud/atlas"
  echo "     → Sau khi tạo Atlas cluster, cập nhật MONGODB_URI trong backend/.env"
  echo ""
  echo -e "${YELLOW}Tiếp tục với cấu hình hiện tại...${NC}"
fi

# Install backend dependencies
echo ""
echo -e "${BLUE}📦 Cài đặt backend dependencies...${NC}"
cd backend
if [ ! -d "node_modules" ]; then
  npm install
fi

# Seed database
echo ""
echo -e "${BLUE}🌱 Seed dữ liệu mẫu...${NC}"
npm run seed 2>&1 | grep -E "✅|❌|━|👤|📁|📋|🎉"

# Start backend
echo ""
echo -e "${BLUE}🚀 Khởi động Backend API...${NC}"
npm run dev &
BACKEND_PID=$!
sleep 2

# Install frontend dependencies
cd ../frontend
echo ""
echo -e "${BLUE}📦 Cài đặt frontend dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  npm install
fi

# Start frontend
echo ""
echo -e "${BLUE}🎨 Khởi động Frontend...${NC}"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 TaskFlow đang chạy!${NC}"
echo ""
echo -e "  🌐 Frontend:  ${BLUE}http://localhost:3000${NC}"
echo -e "  🔌 Backend:   ${BLUE}http://localhost:5000${NC}"
echo -e "  🏥 Health:    ${BLUE}http://localhost:5000/health${NC}"
echo ""
echo -e "${YELLOW}Demo login: admin@taskflow.com / password123${NC}"
echo ""
echo "Nhấn Ctrl+C để dừng..."

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
