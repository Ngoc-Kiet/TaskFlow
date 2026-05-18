const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const res = await User.updateMany({ $or: [{ name: /admin/i }, { email: /admin/i }] }, { role: 'admin' });
  console.log('Updated users to admin:', res.modifiedCount);
  process.exit(0);
}).catch(console.error);
