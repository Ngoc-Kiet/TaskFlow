require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const seedMongo = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Khai báo schema tạm để seed
    const userSchema = new mongoose.Schema({
      name: String,
      email: String,
      password: { type: String, select: false },
      role: { type: String, default: 'user' },
      isActive: { type: Boolean, default: true },
      avatar: String,
    }, { timestamps: true });

    // Tránh lỗi nếu model đã tồn tại
    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // Xoá DB cũ
    await mongoose.connection.db.dropDatabase();
    console.log('🗑️ Xoá toàn bộ dữ liệu MongoDB cũ...');

    const pass = await bcrypt.hash('password123', 12);
    await User.create({
      name: 'Admin',
      email: 'admin@gmail.com',
      password: pass,
      role: 'admin',
      isActive: true,
      avatar: ''
    });

    console.log('✅ Đã tạo tài khoản admin@gmail.com thành công trên MongoDB Atlas!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
};

seedMongo();
