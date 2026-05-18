/**
 * Offline User Model - dùng khi MongoDB không kết nối được
 */
const bcrypt = require('bcryptjs');
const { createModel } = require('../config/jsonDb');

const UserJsonDB = createModel('users', {
  name: { type: String },
  email: { type: String },
  password: { type: String },
  avatar: { type: String, default: '' },
  role: { type: String, default: 'user' },
  isActive: { type: Boolean, default: true },
  lastSeen: { type: Date, default: () => new Date().toISOString() }
});

// Add methods
UserJsonDB.findByEmailWithPassword = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

UserJsonDB.createWithPassword = async function(data) {
  const hashed = await bcrypt.hash(data.password, 12);
  return this.create({ ...data, email: data.email.toLowerCase(), password: hashed });
};

UserJsonDB.comparePassword = async function(user, candidate) {
  return await bcrypt.compare(candidate, user.password);
};

module.exports = UserJsonDB;
