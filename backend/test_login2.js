require('dotenv').config();
require('./src/config/db');
const User = require('./src/models/User');

async function test() {
  const user = await User.findOne({ email: 'admin@gmail.com' }).select('+password');
  console.log('User password:', user.password);
  if (user) {
    const isMatch = await user.comparePassword('password123');
    console.log('Password match:', isMatch);
  }
}

test();
