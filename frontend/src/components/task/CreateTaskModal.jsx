import { useState } from 'react'
import useTaskStore from '../../contexts/useTaskStore'
import useAuthStore from '../../contexts/useAuthStore'
import toast from 'react-hot-toast'
import { calculateWorkingHours } from '../../utils/timeUtils'

const PRIORITIES = [
  { value: 'low', label: '⚪ Low' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'high', label: '🟠 High' },
  { value: 'urgent', label: '🔴 Urgent' }
]

export default function CreateTaskModal({ projectId, defaultStatus = 'todo', members, onClose, onCreated }) {
  const { createTask } = useTaskStore()
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: defaultStatus,
    priority: 'medium',
    assignees: user?._id ? [user._id] : [],
    deadline: '',
    startDate: '',
    tags: '',
    estimatedHours: ''
  })
  const [loading, setLoading] = useState(false)
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)

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
    setAssigneeSearch('')
    setShowAssigneeDropdown(false)
  }

  // Members of this project
  const projectMembers = members || []

  // Filter selected members to display as chips
  const selectedMembers = projectMembers.filter(m => m.user && form.assignees.includes(m.user._id))

  // Filter members matching search, excluding already assigned
  const assigneeDropdownList = projectMembers.filter(m => {
    if (!m.user) return false
    const q = assigneeSearch.trim().toLowerCase()
    if (!q) return !form.assignees.includes(m.user._id)
    return (
      !form.assignees.includes(m.user._id) &&
      (m.user.name?.toLowerCase().includes(q) || m.user.email?.toLowerCase().includes(q))
    )
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Tiêu đề task không được để trống'); return }

    if (!form.startDate || !form.deadline) {
      toast.error('Ngày bắt đầu và deadline là 2 điều kiện bắt buộc phải điền!')
      return
    }

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
                <label className="block text-sm font-medium text-slate-400 mb-1.5">🚀 Ngày bắt đầu *</label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={e => handleDateChange('startDate', e.target.value)}
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">📅 Deadline *</label>
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-400">👥 Được giao cho</label>
                <button
                  type="button"
                  onClick={() => setShowAssigneeDropdown(v => !v)}
                  className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
                >
                  + Thêm người
                </button>
              </div>

              {/* Current assignees chips */}
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedMembers.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">Chưa có người thực hiện</p>
                ) : (
                  selectedMembers.map(m => (
                    <div
                      key={m.user._id}
                      className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/50 rounded-full pl-1.5 pr-2 py-1 group"
                    >
                      <img
                        src={m.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name)}&background=6366f1&color=fff&size=20`}
                        alt=""
                        className="w-5 h-5 rounded-full flex-shrink-0"
                      />
                      <span className="text-sm text-slate-300">{m.user.name}</span>
                      {m.user._id === user?._id && (
                        <span className="text-[10px] bg-primary-500/20 text-primary-400 px-1 rounded ml-0.5">Bạn</span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleAssignee(m.user._id)}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all ml-0.5"
                        title="Bỏ assign"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Search + dropdown to add members */}
              {showAssigneeDropdown && (
                <div className="relative">
                  <input
                    autoFocus
                    type="text"
                    value={assigneeSearch}
                    onChange={e => setAssigneeSearch(e.target.value)}
                    placeholder="Tìm theo tên hoặc email..."
                    className="input-base text-sm w-full"
                  />
                  {projectMembers.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-dark-800 border border-slate-700 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto">
                      {assigneeDropdownList.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-600 text-center">
                          {assigneeSearch ? 'Không tìm thấy thành viên' : 'Tất cả thành viên đã được thêm'}
                        </div>
                      ) : (
                        assigneeDropdownList.map(m => (
                          <button
                            key={m.user._id}
                            type="button"
                            onClick={() => toggleAssignee(m.user._id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-colors text-left"
                          >
                            <img
                              src={m.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name)}&background=6366f1&color=fff&size=32`}
                              alt=""
                              className="w-7 h-7 rounded-full flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm text-slate-200 font-medium truncate">{m.user.name}</p>
                              <p className="text-xs text-slate-500 truncate">{m.user.email}</p>
                            </div>
                            <span className="ml-auto text-xs text-slate-600 capitalize">{m.role}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowAssigneeDropdown(false); setAssigneeSearch('') }}
                    className="text-xs text-slate-600 hover:text-slate-400 mt-1.5 block"
                  >
                    Đóng
                  </button>
                </div>
              )}
            </div>

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
