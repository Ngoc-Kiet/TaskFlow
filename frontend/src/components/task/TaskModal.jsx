import { useState, useEffect } from 'react'
import useTaskStore from '../../contexts/useTaskStore'
import useAuthStore from '../../contexts/useAuthStore'
import { taskService } from '../../services'
import { format, isAfter, differenceInDays, formatDistanceToNow } from 'date-fns'
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
  { value: 'pending', label: '⏳ Pending' },
  { value: 'done', label: '✅ Done' }
]

const STATUS_LABELS = { todo: 'To Do', inprogress: 'In Progress', review: 'Review', pending: 'Pending', done: 'Done', 'in-progress': 'Đang làm', cancel: 'Đã hủy' }
const PRIORITY_LABELS = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', urgent: 'Khẩn cấp' }

const HISTORY_ACTION_CONFIG = {
  task_created:             { icon: '🌟', dotBg: 'bg-primary-500',  color: 'text-primary-400',  showValues: false, label: () => 'đã tạo task này' },
  status_changed:           { icon: '🔀', dotBg: 'bg-blue-500',     color: 'text-blue-400',     showValues: true,  label: e => e.newValue === 'pending' && e.meta?.reason ? `đã tạm hoãn task (Lý do: ${e.meta.reason})` : 'đã đổi trạng thái', formatValue: v => STATUS_LABELS[v] || v },
  title_changed:            { icon: '✏️', dotBg: 'bg-yellow-500',   color: 'text-yellow-400',   showValues: true,  label: () => 'đã đổi tên task' },
  description_changed:      { icon: '📝', dotBg: 'bg-slate-500',    color: 'text-slate-400',    showValues: false, label: () => 'đã cập nhật mô tả' },
  priority_changed:         { icon: '⚡', dotBg: 'bg-orange-500',   color: 'text-orange-400',   showValues: true,  label: () => 'đã đổi độ ưu tiên', formatValue: v => PRIORITY_LABELS[v] || v },
  deadline_changed:         { icon: '📅', dotBg: 'bg-red-500',      color: 'text-red-400',      showValues: true,  label: () => 'đã đổi deadline', formatValue: v => { try { return format(new Date(v), 'dd/MM/yyyy HH:mm') } catch { return v } } },
  start_date_changed:       { icon: '🚀', dotBg: 'bg-cyan-500',     color: 'text-cyan-400',     showValues: true,  label: () => 'đã đổi ngày bắt đầu', formatValue: v => { try { return format(new Date(v), 'dd/MM/yyyy HH:mm') } catch { return v } } },
  estimated_hours_changed:  { icon: '⏱️', dotBg: 'bg-purple-500',  color: 'text-purple-400',   showValues: true,  label: () => 'đã đổi giờ ước tính', formatValue: v => `${v}h` },
  actual_hours_changed:     { icon: '⏱️', dotBg: 'bg-indigo-500',  color: 'text-indigo-400',   showValues: true,  label: () => 'đã đổi giờ thực tế', formatValue: v => `${v}h` },
  checklist_added:          { icon: '➕', dotBg: 'bg-green-500',    color: 'text-green-400',    showValues: true,  label: () => 'đã thêm checklist', formatValue: v => v },
  checklist_removed:        { icon: '➖', dotBg: 'bg-red-400',      color: 'text-red-400',      showValues: true,  label: () => 'đã xóa checklist', formatValue: v => v },
  checklist_renamed:        { icon: '✏️', dotBg: 'bg-yellow-400',  color: 'text-yellow-300',   showValues: true,  label: () => 'đã đổi tên checklist', formatValue: v => v },
  checklist_status_changed: { icon: '✓',  dotBg: 'bg-teal-500',    color: 'text-teal-400',     showValues: true,  label: e => `đã đổi trạng thái checklist "${e.meta?.title || ''}"`, formatValue: v => STATUS_LABELS[v] || v },
  assignee_added:           { icon: '👤', dotBg: 'bg-violet-500',   color: 'text-violet-400',   showValues: false, label: () => 'đã thêm người thực hiện' },
  assignee_removed:         { icon: '👤', dotBg: 'bg-rose-500',     color: 'text-rose-400',     showValues: false, label: () => 'đã xóa người thực hiện' },
  comment_added:            { icon: '💬', dotBg: 'bg-sky-500',      color: 'text-sky-400',      showValues: false, label: () => 'đã thêm bình luận' },
  _default:                 { icon: '🔧', dotBg: 'bg-slate-600',    color: 'text-slate-400',    showValues: true,  label: e => e.action?.replace(/_/g, ' ') || 'đã thay đổi' }
}

export default function TaskModal({ task: initialTask, project, onClose, onUpdate }) {
  const { fetchTask, updateTask, deleteTask, addComment, deleteComment } = useTaskStore()
  const { user } = useAuthStore()
  const [task, setTask] = useState(initialTask)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details') // details | comments | checklist | history
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)

  useEffect(() => {
    loadTask()
  }, [initialTask._id])

  const loadTask = async () => {
    const t = await fetchTask(initialTask._id)
    if (t) setTask(t)
  }

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await taskService.getHistory(initialTask._id)
      setHistory(res.data || [])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  // Validate checklist before marking task as done
  const checkCanMarkDone = (targetStatus, currentTask = task) => {
    if (targetStatus !== 'done') return true // only validate when moving to done
    const checklist = currentTask.checklist || []
    if (checklist.length === 0) {
      toast.error(
        'Task cần có ít nhất 1 checklist item trước khi hoàn thành! ✅',
        { duration: 4000, icon: '📋' }
      )
      setActiveTab('checklist')
      return false
    }
    const notDone = checklist.filter(item => item.status !== 'done' && item.status !== 'cancel')
    if (notDone.length > 0) {
      toast.error(
        `Còn ${notDone.length} checklist chưa hoàn thành! Hoàn tất checklist trước khi đóng task.`,
        { duration: 4000, icon: '⚠️' }
      )
      setActiveTab('checklist')
      return false
    }
    const noEffortItems = checklist.filter(item => item.status !== 'cancel' && (!item.actualHours || item.actualHours <= 0))
    if (noEffortItems.length > 0) {
      toast.error(
        `Còn ${noEffortItems.length} mục checklist chưa điền thời gian thực tế (effort)! Vui lòng điền effort trước khi hoàn thành task.`,
        { duration: 4000, icon: '⏱️' }
      )
      setActiveTab('checklist')
      return false
    }
    return true
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
      startDate: task.startDate ? format(new Date(task.startDate), "yyyy-MM-dd'T'HH:mm") : '',
      deadline: task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
      estimatedHours: task.estimatedHours || '',
      actualHours: task.actualHours || '',
      tags: task.tags || []
    })
    setEditing(true)
  }

  // Assignee helpers — work directly on task (immediate save, no edit mode needed)
  const currentAssigneeIds = (task.assignees || []).map(a => a._id || a)

  const toggleAssignee = async (memberId) => {
    const alreadyAssigned = currentAssigneeIds.includes(memberId)
    const newIds = alreadyAssigned
      ? currentAssigneeIds.filter(id => id !== memberId)
      : [...currentAssigneeIds, memberId]
    const updated = await updateTask(task._id, { assignees: newIds })
    if (updated) {
      setTask(updated)
      setAssigneeSearch('')
      setShowAssigneeDropdown(false)
    }
  }

  // Members of this project (from prop)
  const projectMembers = project?.members || []

  // Filter members matching search (by name or email), excluding already-assigned
  const assigneeDropdownList = projectMembers.filter(m => {
    if (!m.user) return false
    const q = assigneeSearch.trim().toLowerCase()
    if (!q) return !currentAssigneeIds.includes(m.user._id)
    return (
      !currentAssigneeIds.includes(m.user._id) &&
      (m.user.name?.toLowerCase().includes(q) || m.user.email?.toLowerCase().includes(q))
    )
  })

  const saveEdit = async () => {
    if (!editForm.startDate || !editForm.deadline) {
      toast.error('Ngày bắt đầu và deadline là 2 điều kiện bắt buộc phải điền!')
      return
    }

    if (editForm.startDate && editForm.deadline && new Date(editForm.startDate) >= new Date(editForm.deadline)) {
      toast.error('Ngày bắt đầu phải nhỏ hơn ngày kết thúc (Deadline)')
      return
    }

    // Validate checklist completeness when changing to done
    if (editForm.status === 'done' && editForm.status !== task.status) {
      if (!checkCanMarkDone('done')) return
    }

    let pendingReason = undefined
    if (editForm.status === 'pending' && task.status !== 'pending') {
      const reason = window.prompt('Nhập lý do tạm hoãn task (Pending):')
      if (reason === null) return // User cancelled
      if (!reason.trim()) {
        toast.error('Bạn phải nhập lý do mới có thể chuyển trạng thái sang Pending!')
        return
      }
      pendingReason = reason.trim()
    }

    setLoading(true)
    const updated = await updateTask(task._id, {
      ...editForm,
      pendingReason: editForm.status === 'pending' ? (pendingReason || task.pendingReason) : undefined,
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
    if (!checkCanMarkDone(status)) return

    let pendingReason = undefined
    if (status === 'pending') {
      const reason = window.prompt('Nhập lý do tạm hoãn task (Pending):')
      if (reason === null) return // User cancelled
      if (!reason.trim()) {
        toast.error('Bạn phải nhập lý do mới có thể chuyển trạng thái sang Pending!')
        return
      }
      pendingReason = reason.trim()
    }

    const updated = await updateTask(task._id, { status, pendingReason })
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

  const updateChecklistHours = async (index, hours) => {
    const newChecklist = [...task.checklist]
    newChecklist[index].actualHours = Number(hours)
    
    const totalChecklistHours = newChecklist.reduce((sum, item) => sum + (Number(item.actualHours) || 0), 0)
    if (task.estimatedHours && totalChecklistHours > task.estimatedHours) {
      toast.error(`Tổng thời gian checklist (${totalChecklistHours}h) vượt thời gian estimate (${task.estimatedHours}h)!`)
      return
    }

    const updated = await updateTask(task._id, { checklist: newChecklist, actualHours: totalChecklistHours })
    if (updated) setTask(updated)
  }

  const isOverdue = task.deadline && task.status !== 'done' && task.status !== 'pending' && isAfter(new Date(), new Date(task.deadline))
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
            { id: 'checklist', label: `✓ Checklist (${completedChecklist}/${totalChecklist})` },
            { id: 'history', label: '📜 Lịch sử' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                if (tab.id === 'history' && history.length === 0) fetchHistory()
              }}
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
              {/* Pending Reason Banner */}
              {task.status === 'pending' && task.pendingReason && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3.5 flex items-start gap-2.5 animate-pulse">
                  <span className="text-orange-400 text-lg">⏳</span>
                  <div>
                    <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider">Lý do tạm hoãn (Pending)</p>
                    <p className="text-sm text-slate-200 mt-0.5">{task.pendingReason}</p>
                  </div>
                </div>
              )}

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
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Ngày bắt đầu *</label>
                      <input
                        type="datetime-local"
                        value={editForm.startDate}
                        onChange={e => handleDateChange('startDate', e.target.value)}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Deadline *</label>
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

              {/* Assignees — always visible, always editable */}
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
                  {(task.assignees || []).length === 0 ? (
                    <p className="text-xs text-slate-600 italic">Chưa có người thực hiện</p>
                  ) : (
                    task.assignees.map(a => (
                      <div
                        key={a._id}
                        className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/50 rounded-full pl-1.5 pr-2 py-1 group"
                      >
                        <img
                          src={a.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=6366f1&color=fff&size=20`}
                          alt=""
                          className="w-5 h-5 rounded-full flex-shrink-0"
                        />
                        <span className="text-sm text-slate-300">{a.name}</span>
                        {/* Creator badge */}
                        {task.creator?._id === a._id && (
                          <span className="text-[10px] bg-primary-500/20 text-primary-400 px-1 rounded ml-0.5">Tạo</span>
                        )}
                        <button
                          onClick={() => toggleAssignee(a._id)}
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
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 group transition-colors"
                  >
                    <div 
                      onClick={() => toggleChecklist(i)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${item.status === 'done' ? 'bg-green-500 border-green-500'
                      : item.status === 'in-progress' ? 'border-orange-500 bg-orange-500/20'
                        : item.status === 'cancel' ? 'bg-red-500/20 border-red-500/50'
                          : 'border-slate-600 group-hover:border-primary-500'
                      }`}>
                      {item.status === 'done' && <span className="text-xs text-white">✓</span>}
                      {item.status === 'in-progress' && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                      {item.status === 'cancel' && <span className="text-xs text-red-500">✗</span>}
                    </div>
                    <span 
                      onClick={() => toggleChecklist(i)}
                      className={`text-sm flex-1 cursor-pointer ${item.status === 'done' ? 'line-through text-slate-500'
                      : item.status === 'cancel' ? 'line-through text-red-400/50'
                        : item.status === 'in-progress' ? 'text-orange-100'
                          : 'text-slate-200'
                      }`}>
                      {item.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="0" 
                        step="0.5"
                        placeholder="0"
                        className="input-base py-1 px-2 w-16 text-center text-sm" 
                        value={item.actualHours || ''}
                        onChange={(e) => {
                          const val = [...task.checklist];
                          val[i].actualHours = e.target.value;
                          setTask(t => ({...t, checklist: val}));
                        }}
                        onBlur={(e) => updateChecklistHours(i, e.target.value)}
                      />
                      <span className="text-xs text-slate-500">h</span>
                    </div>
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
          {activeTab === 'history' && (
            <div className="p-6">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <span className="spinner w-6 h-6" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-slate-600">
                  <span className="text-4xl block mb-3">📜</span>
                  <p className="text-sm">Chưa có lịch sử thay đổi nào</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-800" />
                  <div className="space-y-1">
                    {history.map((entry, idx) => {
                      const cfg = HISTORY_ACTION_CONFIG[entry.action] || HISTORY_ACTION_CONFIG._default
                      return (
                        <div key={entry._id || idx} className="relative flex gap-4 pl-10 py-2 group">
                          {/* Dot */}
                          <div className={`absolute left-2 top-3 w-4 h-4 rounded-full flex items-center justify-center text-xs ${cfg.dotBg} border-2 border-slate-900 z-10`}>
                            {cfg.icon}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap">
                              <img
                                src={entry.actor?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.actor?.name || 'U')}&background=6366f1&color=fff&size=20`}
                                alt=""
                                className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5"
                              />
                              <span className="text-sm font-medium text-slate-300">{entry.actor?.name || 'Người dùng'}</span>
                              <span className={`text-sm ${cfg.color}`}>{cfg.label(entry)}</span>
                            </div>
                            {/* Old → New value */}
                            {(entry.oldValue !== undefined || entry.newValue !== undefined) && cfg.showValues && (
                              <div className="mt-1 ml-7 flex items-center gap-2 flex-wrap">
                                {entry.oldValue !== undefined && entry.oldValue !== null && entry.oldValue !== '' && (
                                  <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded line-through">
                                    {cfg.formatValue ? cfg.formatValue(entry.oldValue) : String(entry.oldValue)}
                                  </span>
                                )}
                                {entry.oldValue !== undefined && entry.newValue !== undefined && (
                                  <span className="text-slate-600 text-xs">→</span>
                                )}
                                {entry.newValue !== undefined && entry.newValue !== null && entry.newValue !== '' && (
                                  <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">
                                    {cfg.formatValue ? cfg.formatValue(entry.newValue) : String(entry.newValue)}
                                  </span>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-slate-600 mt-0.5 ml-7">
                              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: vi })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Refresh button */}
              <div className="flex justify-end mt-4 pt-3 border-t border-slate-800">
                <button
                  onClick={fetchHistory}
                  disabled={historyLoading}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  🔄 Làm mới
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
