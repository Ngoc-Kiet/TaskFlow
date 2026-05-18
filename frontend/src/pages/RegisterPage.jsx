import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../contexts/useAuthStore'

// ⚠️ Field phải nằm NGOÀI RegisterPage để tránh re-mount mỗi lần setState → mất focus
function Field({ label, id, type = 'text', placeholder, value, onChange, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-400 mb-1.5">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        className={`input-base ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
        placeholder={placeholder}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()

  const validate = () => {
    const errs = {}
    if (!form.name || form.name.length < 2) errs.name = 'Tên phải có ít nhất 2 ký tự'
    if (!form.email) errs.email = 'Email không được để trống'
    if (!form.password || form.password.length < 6) errs.password = 'Mật khẩu tối thiểu 6 ký tự'
    if (form.password !== form.confirm) errs.confirm = 'Mật khẩu xác nhận không khớp'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    const ok = await register(form.name, form.email, form.password)
    if (ok) navigate('/dashboard')
  }

  const handleChange = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl mb-4 shadow-xl shadow-primary-500/30">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">TaskFlow</h1>
          <p className="text-slate-400 mt-1">Tạo tài khoản miễn phí</p>
        </div>

        <div className="glass-card p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-100 mb-6">Đăng ký tài khoản</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Họ và tên" id="name" placeholder="Nguyễn Văn A"
              value={form.name} onChange={handleChange('name')} error={errors.name} />
            <Field label="Email" id="email" type="email" placeholder="email@example.com"
              value={form.email} onChange={handleChange('email')} error={errors.email} />
            <Field label="Mật khẩu" id="password" type="password" placeholder="Tối thiểu 6 ký tự"
              value={form.password} onChange={handleChange('password')} error={errors.password} />
            <Field label="Xác nhận mật khẩu" id="confirm" type="password" placeholder="Nhập lại mật khẩu"
              value={form.confirm} onChange={handleChange('confirm')} error={errors.confirm} />

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
            >
              {loading ? <span className="spinner w-5 h-5" /> : '🎉 Tạo tài khoản'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Đã có tài khoản?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
