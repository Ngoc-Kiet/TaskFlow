import { useState } from 'react'
import useTaskStore from '../../contexts/useTaskStore'
import toast from 'react-hot-toast'
import { calculateWorkingHours } from '../../utils/timeUtils'

const PRIORITIES = [
  { value: 'low', label: '⚪ Thấp' },
  { value: 'medium', label: '🟡 Trung bình' },
  { value: 'high', label: '🟠 Cao' },
  { value: 'urgent', label: '🔴 Khẩn cấp' }
]

export default function CreateTaskModal({ projectId, defaultStatus = 'todo', members, onClose, onCreated }) {
  const { createTask } = useTaskStore()
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: defaultStatus,
    priority: 'medium',
    assignees: [],
    deadline: '',
    startDate: '',
    tags: '',
    estimatedHours: ''
  })
  const [loading, setLoading] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handleDateChange = (field, value) => {
    setForm(f => {
      const newForm = { ...f, [field]: value }
      if (newForm.startDate && newForm.deadline) {
        if (new Date(newForm.startDate) < new Date(newForm.deadline)) {
          newForm.estimatedHours = calculateWorkingHours(newForm.startDate, newForm.deadline)
        }
      }
      return newForm
    })
  }

  const toggleAssignee = (userId) => {
    setForm(f => ({
      ...f,
      assignees: f.assignees.includes(userId)
        ? f.assignees.filter(id => id !== userId)
        : [...f.assignees, userId]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Tiêu đề task không được để trống'); return }
    
    if (form.startDate && form.deadline && new Date(form.startDate) >= new Date(form.deadline)) {
      toast.error('Ngày bắt đầu phải nhỏ hơn ngày kết thúc (Deadline)')
      return
    }
    
    setLoading(true)
    const data = {
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined
    }
    const task = await createTask(projectId, data)
    setLoading(false)
    if (task) {
      onCreated?.()
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-100">✨ Tạo task mới</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded hover:bg-slate-800">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Tiêu đề *</label>
              <input
                autoFocus
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                className="input-base"
                placeholder="Tên task..."
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Mô tả</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className="input-base h-24 resize-none"
                placeholder="Chi tiết task..."
              />
            </div>

            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Trạng thái</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="input-base">
                  <option value="todo">📋 To Do</option>
                  <option value="inprogress">⚡ In Progress</option>
                  <option value="done">✅ Done</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Độ ưu tiên</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input-base">
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Dates & Hours */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">🚀 Ngày bắt đầu</label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={e => handleDateChange('startDate', e.target.value)}
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">📅 Deadline</label>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={e => handleDateChange('deadline', e.target.value)}
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">⏱️ Giờ ước tính</label>
                <input
                  type="number"
                  min="0"
                  value={form.estimatedHours}
                  onChange={e => set('estimatedHours', e.target.value)}
                  className="input-base"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Assignees */}
            {members.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">👥 Giao cho</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => {
                    const isSelected = form.assignees.includes(m.user._id)
                    return (
                      <button
                        key={m.user._id}
                        type="button"
                        onClick={() => toggleAssignee(m.user._id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                          isSelected
                            ? 'bg-primary-500/20 border border-primary-500/50 text-primary-400'
                            : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <img
                          src={m.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name)}&background=6366f1&color=fff&size=20`}
                          alt=""
                          className="w-5 h-5 rounded-full"
                        />
                        {m.user.name}
                        {isSelected && <span>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">🏷️ Tags (cách nhau bởi dấu phẩy)</label>
              <input
                type="text"
                value={form.tags}
                onChange={e => set('tags', e.target.value)}
                className="input-base"
                placeholder="frontend, design, urgent..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Hủy
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <span className="spinner w-4 h-4" /> : '✨ Tạo task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
