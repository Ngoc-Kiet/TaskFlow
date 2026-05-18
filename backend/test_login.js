require('dotenv').config();
require('./src/config/db');
const User = require('./src/models/User');

async function test() {
  const user = await User.findOne({ email: 'admin@gmail.com' }).select('+password');
  console.log('User found:', user ? user.email : 'No user');
  if (user) {
    const isMatch = await user.comparePassword('password123');
    console.log('Password match:', isMatch);
  }
}

test();
