import { useState, useEffect } from 'react'
import useTaskStore from '../../contexts/useTaskStore'
import useAuthStore from '../../contexts/useAuthStore'
import { format, isAfter, differenceInDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { calculateWorkingHours } from '../../utils/timeUtils'

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/15' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/15' },
  medium: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  low: { label: 'Low', color: 'text-slate-400', bg: 'bg-slate-500/15' }
}

const STATUS_OPTIONS = [
  { value: 'todo', label: '📋 To Do' },
  { value: 'inprogress', label: '⚡ In Progress' },
  { value: 'review', label: '👀 Review' },
  { value: 'done', label: '✅ Done' }
]

export default function TaskModal({ task: initialTask, project, onClose, onUpdate }) {
  const { fetchTask, updateTask, deleteTask, addComment, deleteComment } = useTaskStore()
  const { user } = useAuthStore()
  const [task, setTask] = useState(initialTask)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details') // details | comments | checklist

  useEffect(() => {
    loadTask()
  }, [initialTask._id])

  const loadTask = async () => {
    const t = await fetchTask(initialTask._id)
    if (t) setTask(t)
  }

  const handleDateChange = (field, value) => {
    setEditForm(f => {
      const newForm = { ...f, [field]: value }
      if (newForm.startDate && newForm.deadline) {
        if (new Date(newForm.startDate) < new Date(newForm.deadline)) {
          newForm.estimatedHours = calculateWorkingHours(newForm.startDate, newForm.deadline)
        }
      }
      return newForm
    })
  }

  const startEdit = () => {
    setEditForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      priority: task.priority,
      startDate: task.startDate ? format(new Date(task.startDate), "yyyy-MM-dd'T'HH:mm") : '',
      deadline: task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
      estimatedHours: task.estimatedHours || '',
      actualHours: task.actualHours || '',
      tags: task.tags || []
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (editForm.startDate && editForm.deadline && new Date(editForm.startDate) >= new Date(editForm.deadline)) {
      toast.error('Ngày bắt đầu phải nhỏ hơn ngày kết thúc (Deadline)')
      return
    }

    setLoading(true)
    const updated = await updateTask(task._id, {
      ...editForm,
      startDate: editForm.startDate ? new Date(editForm.startDate).toISOString() : undefined,
      deadline: editForm.deadline ? new Date(editForm.deadline).toISOString() : undefined,
      estimatedHours: editForm.estimatedHours ? Number(editForm.estimatedHours) : undefined,
      actualHours: editForm.actualHours ? Number(editForm.actualHours) : undefined,
      tags: editForm.tags || []
    })
    if (updated) {
      setTask(updated)
      setEditing(false)
      toast.success('Đã cập nhật task!')
      onUpdate?.()
    }
    setLoading(false)
  }

  // Tag helpers
  const [tagInput, setTagInput] = useState('')
  const addTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9\-_àáâãèéêìíòóôõùúýăđơư]/g, '')
      if (t && !editForm.tags?.includes(t)) {
        setEditForm(f => ({ ...f, tags: [...(f.tags || []), t] }))
      }
      setTagInput('')
    }
  }
  const removeTag = (tag) => setEditForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc muốn xóa task này?')) return
    const ok = await deleteTask(task._id)
    if (ok) {
      onClose()
      onUpdate?.()
    }
  }

  const handleStatusChange = async (status) => {
    const updated = await updateTask(task._id, { status })
    if (updated) {
      setTask(updated)
      onUpdate?.()
    }
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    const comment = await addComment(task._id, newComment)
    if (comment) {
      setTask(t => ({ ...t, comments: [...t.comments, comment] }))
      setNewComment('')
    }
  }

  const handleDeleteComment = async (commentId) => {
    await deleteComment(task._id, commentId)
    setTask(t => ({ ...t, comments: t.comments.filter(c => c._id !== commentId) }))
  }

  const [newChecklistItem, setNewChecklistItem] = useState('')

  const handleAddChecklist = async (e) => {
    e.preventDefault()
    if (!newChecklistItem.trim()) return
    const newChecklist = [...(task.checklist || []), { title: newChecklistItem.trim(), status: 'todo' }]
    const updated = await updateTask(task._id, { checklist: newChecklist })
    if (updated) {
      setTask(updated)
      setNewChecklistItem('')
    }
  }

  const toggleChecklist = async (index) => {
    const statusCycle = { 'todo': 'in-progress', 'in-progress': 'done', 'done': 'cancel', 'cancel': 'todo' };
    const newChecklist = task.checklist.map((item, i) =>
      i === index ? { ...item, status: statusCycle[item.status || 'todo'] } : item
    )
    const updated = await updateTask(task._id, { checklist: newChecklist })
    if (updated) setTask(updated)
  }

  const isOverdue = task.deadline && task.status !== 'done' && isAfter(new Date(), new Date(task.deadline))
  const daysLeft = task.deadline ? differenceInDays(new Date(task.deadline), new Date()) : null

  const completedChecklist = task.checklist?.filter(c => c.status === 'done').length || 0
  const totalChecklist = task.checklist?.length || 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-dark-900 border border-slate-700/50 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex-1">
            {editing ? (
              <input
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                className="input-base text-lg font-bold"
                autoFocus
              />
            ) : (
              <h2 className={`text-xl font-bold ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                {task.title}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Status dropdown */}
              <select
                value={task.status}
                onChange={e => handleStatusChange(e.target.value)}
                className="input-base py-1 text-xs w-36"
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {/* Priority */}
              <span className={`badge ${PRIORITY_CONFIG[task.priority]?.bg} ${PRIORITY_CONFIG[task.priority]?.color} border border-current/30`}>
                {PRIORITY_CONFIG[task.priority]?.label}
              </span>

              {/* Start Date */}
              {task.startDate && (
                <span className="badge bg-blue-500/15 text-blue-400 border border-current/30">
                  🚀 {format(new Date(task.startDate), 'dd/MM/yyyy HH:mm')}
                </span>
              )}

              {/* Deadline */}
              {task.deadline && (
                <span className={`badge ${isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                  {isOverdue ? '⚠️ Quá hạn' : `📅 ${format(new Date(task.deadline), 'dd/MM/yyyy HH:mm')}`}
                  {!isOverdue && daysLeft !== null && daysLeft <= 3 && (
                    <span className="ml-1 text-orange-400">({daysLeft}d còn lại)</span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!editing ? (
              <button onClick={startEdit} className="btn-secondary text-sm px-3 py-1.5">✏️ Sửa</button>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="btn-secondary text-sm px-3 py-1.5">Hủy</button>
                <button onClick={saveEdit} disabled={loading} className="btn-primary text-sm px-3 py-1.5">
                  {loading ? <span className="spinner w-4 h-4" /> : '💾 Lưu'}
                </button>
              </>
            )}
            <button onClick={handleDelete} className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10">
              🗑️
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-2 rounded-lg hover:bg-slate-800 transition-all">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6">
          {[
            { id: 'details', label: '📋 Chi tiết' },
            { id: 'comments', label: `💬 Bình luận (${task.comments?.length || 0})` },
            { id: 'checklist', label: `✓ Checklist (${completedChecklist}/${totalChecklist})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' && (
            <div className="p-6 space-y-4">
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">📝 Mô tả</label>
                {editing ? (
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    className="input-base h-32 resize-none"
                    placeholder="Mô tả task..."
                  />
                ) : (
                  <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3 min-h-[60px]">
                    {task.description || <span className="text-slate-600">Chưa có mô tả</span>}
                  </p>
                )}
              </div>

              {/* Edit fields */}
              {editing && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Độ ưu tiên</label>
                      <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} className="input-base">
                        <option value="low">⚪ Low</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="high">🟠 High</option>
                        <option value="urgent">🔴 Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Ngày bắt đầu</label>
                      <input
                        type="datetime-local"
                        value={editForm.startDate}
                        onChange={e => handleDateChange('startDate', e.target.value)}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Deadline</label>
                      <input
                        type="datetime-local"
                        value={editForm.deadline}
                        onChange={e => handleDateChange('deadline', e.target.value)}
                        className="input-base"
                      />
                    </div>
                  </div>

                  {/* Time Tracking */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">⏱️ Giờ làm việc</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editForm.estimatedHours}
                          onChange={e => setEditForm(f => ({ ...f, estimatedHours: e.target.value }))}
                          className="input-base pr-8"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">h ước</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editForm.actualHours}
                          onChange={e => setEditForm(f => ({ ...f, actualHours: e.target.value }))}
                          className="input-base pr-12"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">h thực</span>
                      </div>
                    </div>
                    {editForm.estimatedHours > 0 && editForm.actualHours > 0 && (
                      <p className={`text-xs mt-1 ${Number(editForm.actualHours) > Number(editForm.estimatedHours) * 1.2
                        ? 'text-red-400' : 'text-green-400'
                        }`}>
                        {Number(editForm.actualHours) > Number(editForm.estimatedHours) * 1.2
                          ? `⚠️ Vượt ${Math.round((editForm.actualHours / editForm.estimatedHours - 1) * 100)}% ước tính`
                          : `✓ Trong kế hoạch (${Math.round(editForm.actualHours / editForm.estimatedHours * 100)}%)`
                        }
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">🏷️ Tags</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(editForm.tags || []).map(tag => (
                        <span key={tag} className="flex items-center gap-1 text-xs bg-primary-500/15 text-primary-400 px-2 py-0.5 rounded-full border border-primary-500/30">
                          #{tag}
                          <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">×</button>
                        </span>
                      ))}
                    </div>
                    <input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={addTag}
                      className="input-base text-sm"
                      placeholder="Nhập tag + Enter (vd: bug, feature, design)"
                    />
                  </div>
                </div>
              )}

              {/* Assignees */}
              {task.assignees?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">👥 Được giao cho</label>
                  <div className="flex flex-wrap gap-2">
                    {task.assignees.map(a => (
                      <div key={a._id} className="flex items-center gap-2 bg-slate-800 rounded-full px-3 py-1.5">
                        <img
                          src={a.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=6366f1&color=fff&size=20`}
                          alt=""
                          className="w-5 h-5 rounded-full"
                        />
                        <span className="text-sm text-slate-300">{a.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {task.tags?.length > 0 && !editing && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">🏷️ Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {task.tags.map(tag => (
                      <span key={tag} className="text-xs bg-primary-500/10 text-primary-400 px-3 py-1 rounded-full border border-primary-500/20">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 pt-2 border-t border-slate-800">
                <div>
                  <span>Tạo bởi: </span>
                  <span className="text-slate-400">{task.creator?.name}</span>
                </div>
                <div>
                  <span>Ngày tạo: </span>
                  <span className="text-slate-400">{format(new Date(task.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                {/* Time tracking display */}
                {(task.estimatedHours || task.actualHours) && (
                  <div className="col-span-2">
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-slate-500">⏱️ Giờ làm:</span>
                      <span className="text-slate-400">
                        {task.actualHours || 0}h thực tế
                        {task.estimatedHours ? ` / ${task.estimatedHours}h ước tính` : ''}
                      </span>
                      {task.estimatedHours > 0 && task.actualHours > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${task.actualHours > task.estimatedHours * 1.2
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-green-500/15 text-green-400'
                          }`}>
                          {task.actualHours > task.estimatedHours * 1.2 ? '⚠️ Vượt' : '✓ OK'}
                        </span>
                      )}
                    </div>
                    {task.estimatedHours > 0 && (
                      <div className="mt-1.5">
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden w-full">
                          <div
                            className={`h-full rounded-full transition-all ${task.actualHours > task.estimatedHours ? 'bg-red-500' : 'bg-primary-500'
                              }`}
                            style={{ width: `${Math.min(100, Math.round((task.actualHours || 0) / task.estimatedHours * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {task.completedAt && (
                  <div>
                    <span>Hoàn thành: </span>
                    <span className="text-green-400">{format(new Date(task.completedAt), 'dd/MM/yyyy')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="p-6 space-y-4">
              {task.comments?.map(comment => (
                <div key={comment._id} className="flex gap-3">
                  <img
                    src={comment.author?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author?.name || 'U')}&background=6366f1&color=fff&size=32`}
                    alt=""
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-200">{comment.author?.name}</span>
                      <span className="text-xs text-slate-500">
                        {format(new Date(comment.createdAt), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <div className="bg-slate-800 rounded-xl rounded-tl-sm p-3 text-sm text-slate-300">
                      {comment.content}
                    </div>
                    {comment.author?._id === user?._id && (
                      <button
                        onClick={() => handleDeleteComment(comment._id)}
                        className="text-xs text-slate-600 hover:text-red-400 mt-1 transition-colors"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {(!task.comments || task.comments.length === 0) && (
                <div className="text-center py-8 text-slate-600">
                  <span className="text-3xl block mb-2">💬</span>
                  <p className="text-sm">Chưa có bình luận nào</p>
                </div>
              )}

              {/* Comment form */}
              <form onSubmit={handleComment} className="flex gap-3 pt-2 border-t border-slate-800">
                <img
                  src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=6366f1&color=fff&size=32`}
                  alt=""
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div className="flex-1 flex gap-2">
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="input-base flex-1 text-sm"
                    placeholder="Viết bình luận..."
                  />
                  <button type="submit" disabled={!newComment.trim()} className="btn-primary px-4 py-2 text-sm">
                    Gửi
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="p-6">
              {totalChecklist > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400">{completedChecklist}/{totalChecklist} hoàn thành</span>
                    <span className="text-sm font-semibold text-slate-200">
                      {totalChecklist > 0 ? Math.round(completedChecklist / totalChecklist * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${totalChecklist > 0 ? (completedChecklist / totalChecklist) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-4">
                {task.checklist?.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => toggleChecklist(i)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer group transition-colors"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.status === 'done' ? 'bg-green-500 border-green-500'
                      : item.status === 'in-progress' ? 'border-orange-500 bg-orange-500/20'
                        : item.status === 'cancel' ? 'bg-red-500/20 border-red-500/50'
                          : 'border-slate-600 group-hover:border-primary-500'
                      }`}>
                      {item.status === 'done' && <span className="text-xs text-white">✓</span>}
                      {item.status === 'in-progress' && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                      {item.status === 'cancel' && <span className="text-xs text-red-500">✗</span>}
                    </div>
                    <span className={`text-sm flex-1 ${item.status === 'done' ? 'line-through text-slate-500'
                      : item.status === 'cancel' ? 'line-through text-red-400/50'
                        : item.status === 'in-progress' ? 'text-orange-100'
                          : 'text-slate-200'
                      }`}>
                      {item.title}
                    </span>
                  </div>
                ))}

                {(!task.checklist || task.checklist.length === 0) && (
                  <div className="text-center py-8 text-slate-600">
                    <span className="text-3xl block mb-2">✅</span>
                    <p className="text-sm">Chưa có checklist nào</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleAddChecklist} className="flex gap-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={e => setNewChecklistItem(e.target.value)}
                  placeholder="Thêm mục checklist mới..."
                  className="input-base flex-1"
                />
                <button type="submit" disabled={!newChecklistItem.trim()} className="btn-primary px-4 py-2 text-sm">
                  Thêm
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
