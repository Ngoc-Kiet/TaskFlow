const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// @desc    Register user
// @route   POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email đã được sử dụng.' });
    }

    const user = await User.create({ name, email, password, role: 'user', isActive: true });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.getAvatarUrl(),
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    // Chỉ chặn nếu account bị EXPLICIT disable (isActive === false)
    if (user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Tài khoản đã bị khóa.' });
    }

    // Cập nhật lastSeen trực tiếp — KHÔNG dùng save() để tránh ghi đè password
    await User.findByIdAndUpdate(user._id, { lastSeen: new Date() }, { new: false }).catch(() => {});

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.getAvatarUrl(),
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.getAvatarUrl(),
          role: user.role,
          createdAt: user.createdAt
        },
        unreadNotifications: unreadCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, avatar },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Cập nhật thông tin thành công!',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.getAvatarUrl(),
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Forgot password - tạo mã reset 6 số
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Vui lòng nhập email.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Trả về success để không lộ email có tồn tại hay không
      return res.json({ success: true, message: 'Nếu email tồn tại, mã reset đã được gửi.', demo: null });
    }

    // Tạo mã 6 số ngẫu nhiên
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    // Lưu vào user
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpiry = resetExpiry;
    await user.save();

    res.json({
      success: true,
      message: 'Mã reset đã được tạo.',
      demo: {
        // DEMO MODE: trả về thẳng vì không có email server
        code: resetCode,
        expiry: resetExpiry,
        note: 'Trong môi trường production, mã này sẽ được gửi qua email.'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password - xác minh mã và đổi mật khẩu
// @route   POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới tối thiểu 6 ký tự.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password +resetPasswordCode +resetPasswordExpiry');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Email không tồn tại.' });
    }
    if (!user.resetPasswordCode || user.resetPasswordCode !== code) {
      return res.status(400).json({ success: false, message: 'Mã xác nhận không đúng.' });
    }
    if (!user.resetPasswordExpiry || new Date() > new Date(user.resetPasswordExpiry)) {
      return res.status(400).json({ success: false, message: 'Mã xác nhận đã hết hạn. Vui lòng thử lại.' });
    }

    // Cập nhật mật khẩu mới và xóa mã reset
    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword, forgotPassword, resetPassword };

