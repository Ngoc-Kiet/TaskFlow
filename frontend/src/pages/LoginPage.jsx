import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../contexts/useAuthStore'

const DEMO_ACCOUNTS = [
  { name: 'Admin User', email: 'admin@taskflow.com', password: 'password123', role: 'Admin', color: '#6366f1' },
  { name: 'Nguyễn Văn An', email: 'an@taskflow.com', password: 'password123', role: 'Member', color: '#8b5cf6' },
  { name: 'Trần Thị Bình', email: 'binh@taskflow.com', password: 'password123', role: 'Member', color: '#ec4899' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showDemoList, setShowDemoList] = useState(false)
  const { login, loading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await login(email, password)
    if (ok) navigate('/dashboard')
  }

  const fillDemo = (account) => {
    setEmail(account.email)
    setPassword(account.password)
    setShowDemoList(false)
  }

  const loginDemo = async (account = DEMO_ACCOUNTS[0]) => {
    const ok = await login(account.email, account.password)
    if (ok) navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-900/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl mb-4 shadow-xl shadow-primary-500/30">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">TaskFlow</h1>
          <p className="text-slate-400 mt-1">Quản lý công việc nhóm hiệu quả</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-100 mb-6">Đăng nhập tài khoản</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-base"
                placeholder="email@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-base pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? (
                <span className="spinner w-5 h-5" />
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-3 relative">
            <button
              onClick={() => setShowDemoList(v => !v)}
              disabled={loading}
              className="w-full btn-secondary py-2.5 flex items-center justify-center gap-2 text-sm"
            >
              🚀 <span>Dùng tài khoản demo</span>
              <span className="ml-auto opacity-60">{showDemoList ? '▲' : '▼'}</span>
            </button>

            {showDemoList && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-dark-800 border border-dark-600 rounded-xl shadow-xl overflow-hidden z-20 animate-fade-in">
                {DEMO_ACCOUNTS.map(acc => (
                  <div
                    key={acc.email}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700 cursor-pointer transition-colors group"
                    onClick={() => fillDemo(acc)}
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: acc.color }}
                    >
                      {acc.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200">{acc.name}</div>
                      <div className="text-xs text-slate-500 truncate">{acc.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-dark-600 text-slate-400">{acc.role}</span>
                      <span className="text-slate-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        Điền →
                      </span>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2 bg-dark-900/50 border-t border-dark-700">
                  <p className="text-xs text-slate-600 text-center">Mật khẩu tất cả: <span className="text-slate-500 font-mono">password123</span></p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3 text-center">
            <p className="text-slate-400 text-sm">
              <Link to="/forgot-password" className="text-slate-500 hover:text-primary-400 transition-colors text-sm">
                🔐 Quên mật khẩu?
              </Link>
            </p>
            <p className="text-slate-400 text-sm">
              Chưa có tài khoản?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
