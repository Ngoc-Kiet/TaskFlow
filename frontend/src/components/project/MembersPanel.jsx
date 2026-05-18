import { useState } from 'react'
import useProjectStore from '../../contexts/useProjectStore'
import useAuthStore from '../../contexts/useAuthStore'

const ROLE_LABELS = { admin: '👑 Admin', member: '👤 Thành viên', viewer: '👁️ Xem' }

export default function MembersPanel({ project, onClose }) {
  const { addMember, removeMember } = useProjectStore()
  const { user } = useAuthStore()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [loading, setLoading] = useState(false)

  const isAdmin = user?.role === 'admin'

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    const res = await addMember(project._id, { email: email.trim(), role })
    setLoading(false)
    if (res) setEmail('')
  }

  const handleRemove = async (userId) => {
    if (!confirm('Xóa thành viên này?')) return
    await removeMember(project._id, userId)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-100">👥 Quản lý thành viên</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 transition-all">✕</button>
          </div>

          {/* Add member form */}
          {isAdmin && (
            <form onSubmit={handleAdd} className="flex gap-2 mb-6">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email thành viên..."
                className="input-base flex-1"
              />
              <select value={role} onChange={e => setRole(e.target.value)} className="input-base w-36">
                <option value="member">Thành viên</option>
                <option value="admin">Admin</option>
                <option value="viewer">Xem</option>
              </select>
              <button type="submit" disabled={loading} className="btn-primary px-4">
                {loading ? <span className="spinner w-4 h-4" /> : '+ Thêm'}
              </button>
            </form>
          )}

          {/* Members list */}
          <div className="space-y-3">
            {project.members?.map(m => {
              if (!m.user) return null;
              const isProjectOwner = project.owner && (project.owner._id === m.user._id || project.owner === m.user._id);
              
              return (
              <div key={m.user._id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors">
                <img
                  src={m.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name || 'User')}&background=6366f1&color=fff&size=40`}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-200">{m.user.name}</p>
                    {isProjectOwner && (
                      <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full">Chủ dự án</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{ROLE_LABELS[m.role] || m.role}</span>
                  {isAdmin && m.user._id !== user?._id && !isProjectOwner && (
                    <button
                      onClick={() => handleRemove(m.user._id)}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>
    </div>
  )
}
