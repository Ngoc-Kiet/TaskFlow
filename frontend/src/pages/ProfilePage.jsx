import { useState, useEffect } from 'react'
import useAuthStore from '../contexts/useAuthStore'
import { authService } from '../services'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [form, setForm] = useState({ name: user?.name || '', avatar: user?.avatar || '' })
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  const [tab, setTab] = useState('profile')

  const handleProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authService.updateProfile(form)
      updateUser(res.data.user)
      toast.success('Cập nhật thông tin thành công!')
    } catch {}
    setLoading(false)
  }

  const handlePassword = async (e) => {
    e.preventDefault()
    if (passForm.newPassword !== passForm.confirm) {
      toast.error('Mật khẩu xác nhận không khớp'); return
    }
    setPassLoading(true)
    try {
      await authService.changePassword({
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      })
      toast.success('Đổi mật khẩu thành công!')
      setPassForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch {}
    setPassLoading(false)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 mb-6">⚙️ Cài đặt tài khoản</h1>

        {/* Profile card */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <img
              src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=6366f1&color=fff&size=80`}
              alt=""
              className="w-20 h-20 rounded-2xl"
            />
            <div>
              <h2 className="text-xl font-bold text-slate-100">{user?.name}</h2>
              <p className="text-slate-400">{user?.email}</p>
              <span className="badge bg-primary-500/20 text-primary-400 border border-primary-500/30 mt-1">
                {user?.role === 'admin' ? '👑 Admin' : '👤 Thành viên'}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-800 mb-6">
            {[{ id: 'profile', label: '👤 Thông tin' }, { id: 'password', label: '🔑 Mật khẩu' }].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id ? 'border-primary-500 text-primary-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'profile' && (
            <form onSubmit={handleProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Họ và tên</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-base"
                  placeholder="Họ và tên..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">URL Avatar (tuỳ chọn)</label>
                <input
                  type="url"
                  value={form.avatar}
                  onChange={e => setForm(f => ({ ...f, avatar: e.target.value }))}
                  className="input-base"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
                <input type="email" value={user?.email} className="input-base opacity-50 cursor-not-allowed" disabled />
              </div>
              <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2">
                {loading ? <span className="spinner w-4 h-4" /> : '💾 Lưu thay đổi'}
              </button>
            </form>
          )}

          {tab === 'password' && (
            <form onSubmit={handlePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={passForm.currentPassword}
                  onChange={e => setPassForm(f => ({ ...f, currentPassword: e.target.value }))}
                  className="input-base"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Mật khẩu mới</label>
                <input
                  type="password"
                  value={passForm.newPassword}
                  onChange={e => setPassForm(f => ({ ...f, newPassword: e.target.value }))}
                  className="input-base"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={passForm.confirm}
                  onChange={e => setPassForm(f => ({ ...f, confirm: e.target.value }))}
                  className="input-base"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
              <button type="submit" disabled={passLoading} className="btn-primary flex items-center justify-center gap-2">
                {passLoading ? <span className="spinner w-4 h-4" /> : '🔑 Đổi mật khẩu'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
