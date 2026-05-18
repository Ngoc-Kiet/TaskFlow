require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

// Clear all files
fs.readdirSync(dataDir).forEach(file => {
  if (file.endsWith('.json')) {
    fs.unlinkSync(path.join(dataDir, file));
  }
});
console.log('Cleared all data files.');

const seed = async () => {
  // Initialize db connection
  require('./src/config/db'); // This sets up JsonDB

  const User = require('./src/models/User');

  const hashedPassword = await bcrypt.hash('password123', 12);

  await User.create({
    name: 'Admin',
    email: 'admin@gmail.com',
    password: hashedPassword,
    role: 'admin',
    isActive: true,
    avatar: ''
  });

  console.log('Admin user created successfully.');
  process.exit(0);
};

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
