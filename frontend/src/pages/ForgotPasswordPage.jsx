import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services'
import toast from 'react-hot-toast'

// Step 1: Nhập email
function StepEmail({ onNext }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return toast.error('Vui lòng nhập email')
    setLoading(true)
    try {
      // Interceptor đã unwrap: res = { success, message, demo }
      const res = await authService.forgotPassword(email.trim())
      if (res?.demo?.code) {
        // Demo mode: hiện mã trực tiếp trên màn hình
        onNext({ email: email.trim(), code: res.demo.code, expiry: res.demo.expiry })
      } else {
        toast.success('Nếu email tồn tại, mã xác nhận đã được gửi.')
      }
    } catch {
      toast.error('Có lỗi xảy ra, thử lại sau.')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Email đã đăng ký</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="input-base"
          placeholder="email@example.com"
          autoFocus
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {loading ? <span className="spinner w-5 h-5" /> : '📨 Gửi mã xác nhận'}
      </button>
    </form>
  )
}

// Step 2: Nhập mã + mật khẩu mới
function StepReset({ email, demoCode, expiry, onSuccess }) {
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const expiryTime = expiry ? new Date(expiry).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!code.trim()) return toast.error('Vui lòng nhập mã xác nhận')
    if (newPassword.length < 6) return toast.error('Mật khẩu tối thiểu 6 ký tự')
    if (newPassword !== confirmPassword) return toast.error('Mật khẩu xác nhận không khớp')
    setLoading(true)
    try {
      await authService.resetPassword({ email, code: code.trim(), newPassword })
      toast.success('Đặt lại mật khẩu thành công!')
      onSuccess()
    } catch (err) {
      toast.error(err?.message || err?.response?.data?.message || 'Mã không đúng hoặc đã hết hạn')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Demo code box */}
      {demoCode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-xs text-amber-400 font-medium mb-1">🔔 Demo Mode — Mã của bạn</p>
          <div className="flex items-center justify-between">
            <span className="text-3xl font-mono font-bold text-amber-300 tracking-widest">{demoCode}</span>
            <div className="text-right">
              <p className="text-xs text-amber-500/70">Hết hạn lúc</p>
              <p className="text-xs text-amber-400 font-medium">{expiryTime}</p>
            </div>
          </div>
          <p className="text-xs text-amber-500/60 mt-2">
            Trong môi trường thực, mã này được gửi qua email.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Mã xác nhận (6 số)</label>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="input-base text-center text-2xl font-mono tracking-widest"
          placeholder="000000"
          maxLength={6}
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Mật khẩu mới</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="input-base pr-10"
            placeholder="Tối thiểu 6 ký tự"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        {/* Strength indicator */}
        {newPassword && (
          <div className="mt-1.5 flex gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                newPassword.length >= [6, 8, 10, 12][i]
                  ? ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'][i]
                  : 'bg-slate-800'
              }`} />
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Xác nhận mật khẩu</label>
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className={`input-base ${confirmPassword && confirmPassword !== newPassword ? 'border-red-500' : ''}`}
          placeholder="Nhập lại mật khẩu mới"
        />
        {confirmPassword && confirmPassword !== newPassword && (
          <p className="text-xs text-red-400 mt-1">Mật khẩu không khớp</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || code.length !== 6 || newPassword.length < 6 || newPassword !== confirmPassword}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50"
      >
        {loading ? <span className="spinner w-5 h-5" /> : '🔐 Đặt lại mật khẩu'}
      </button>
    </form>
  )
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: nhập email, 2: nhập mã + pass mới
  const [resetInfo, setResetInfo] = useState(null)

  const handleEmailSubmit = (info) => {
    setResetInfo(info)
    setStep(2)
  }

  const handleSuccess = () => {
    setTimeout(() => navigate('/login'), 1500)
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl mb-4 shadow-xl shadow-primary-500/30">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">Quên mật khẩu</h1>
          <p className="text-slate-400 mt-1">
            {step === 1 ? 'Nhập email để nhận mã xác nhận' : `Đặt mật khẩu mới cho ${resetInfo?.email}`}
          </p>
        </div>

        <div className="glass-card p-8 shadow-2xl">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map(s => (
              <div key={s} className={`flex items-center gap-2 ${s < 2 ? 'flex-1' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                {s < 2 && (
                  <div className={`flex-1 h-0.5 rounded transition-colors ${step > s ? 'bg-primary-500' : 'bg-slate-800'}`} />
                )}
              </div>
            ))}
            <div className="text-xs text-slate-500 ml-2">
              {step === 1 ? 'Xác minh email' : 'Đặt mật khẩu mới'}
            </div>
          </div>

          {step === 1 ? (
            <StepEmail onNext={handleEmailSubmit} />
          ) : (
            <StepReset
              email={resetInfo?.email}
              demoCode={resetInfo?.code}
              expiry={resetInfo?.expiry}
              onSuccess={handleSuccess}
            />
          )}

          {/* Back link */}
          <div className="mt-6 text-center">
            {step === 2 ? (
              <button onClick={() => setStep(1)} className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
                ← Dùng email khác
              </button>
            ) : (
              <Link to="/login" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
                ← Quay lại đăng nhập
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
