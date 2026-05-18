import { useState } from 'react'
import useProjectStore from '../../contexts/useProjectStore'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#3b82f6', '#f59e0b', '#14b8a6']
const ICONS = ['📋', '🚀', '💡', '🎯', '📱', '🌐', '🔥', '⚡', '🎨', '📊', '🛡️', '🏆']

export default function CreateProjectModal({ onClose }) {
  const { createProject } = useProjectStore()
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    icon: '📋',
    dueDate: ''
  })
  const [loading, setLoading] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    const project = await createProject({ ...form, dueDate: form.dueDate || undefined })
    setLoading(false)
    if (project) onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-100">🚀 Tạo dự án mới</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 transition-all">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Preview */}
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: `${form.color}15`, border: `1px solid ${form.color}30` }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl" style={{ backgroundColor: `${form.color}25` }}>
                {form.icon}
              </div>
              <div>
                <p className="font-semibold text-slate-200">{form.name || 'Tên dự án'}</p>
                <p className="text-sm text-slate-400">{form.description || 'Mô tả dự án...'}</p>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Tên dự án *</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className="input-base"
                placeholder="Tên dự án của bạn..."
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Mô tả</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className="input-base h-20 resize-none"
                placeholder="Mô tả ngắn về dự án..."
              />
            </div>

            {/* Icon picker */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => set('icon', icon)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                      form.icon === icon
                        ? 'bg-primary-500/30 border-2 border-primary-500 scale-110'
                        : 'bg-slate-800 border border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Màu sắc</label>
              <div className="flex gap-2">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => set('color', color)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      form.color === color ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-dark-900' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">📅 Ngày hoàn thành (tuỳ chọn)</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
                className="input-base"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Hủy</button>
              <button type="submit" disabled={loading || !form.name} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <span className="spinner w-4 h-4" /> : '🚀 Tạo dự án'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
