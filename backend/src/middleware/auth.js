const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Không có quyền truy cập. Vui lòng đăng nhập.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc tài khoản đã bị khóa.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('authorize middleware - req.user.role:', req.user.role, 'expected roles:', roles);
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này.'
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
