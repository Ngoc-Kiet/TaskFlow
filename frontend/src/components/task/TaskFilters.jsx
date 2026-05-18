import { useState } from 'react'
import useTaskStore from '../../contexts/useTaskStore'
import useAuthStore from '../../contexts/useAuthStore'

const PRIORITY_OPTIONS = [
  { value: '', label: 'Tất cả độ ưu tiên' },
  { value: 'urgent', label: '🔴 Khẩn cấp' },
  { value: 'high', label: '🟠 Cao' },
  { value: 'medium', label: '🟡 Trung bình' },
  { value: 'low', label: '⚪ Thấp' }
]

const DEADLINE_OPTIONS = [
  { value: '', label: 'Tất cả deadline' },
  { value: 'overdue', label: '⚠️ Quá hạn' },
  { value: 'today', label: '📅 Hôm nay' },
  { value: 'week', label: '📆 Tuần này' }
]

export default function TaskFilters({ projectId, members }) {
  const { filters, setFilters, clearFilters, fetchTasks } = useTaskStore()
  const { user: currentUser } = useAuthStore()
  const [search, setSearch] = useState(filters.search || '')
  const hasFilters = Object.values(filters).some(v => v)
  const isMyTasksActive = filters.assignee === currentUser?._id

  const handleFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    fetchTasks(projectId, newFilters)
  }

  const handleSearch = (e) => {
    setSearch(e.target.value)
    clearTimeout(window._searchTimeout)
    window._searchTimeout = setTimeout(() => {
      handleFilter('search', e.target.value)
    }, 400)
  }

  const handleClear = () => {
    setSearch('')
    clearFilters()
    fetchTasks(projectId, {})
  }

  const toggleMyTasks = () => {
    if (isMyTasksActive) {
      handleFilter('assignee', '') // bỏ filter
    } else {
      handleFilter('assignee', currentUser?._id) // filter theo mình
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* My Tasks quick filter */}
      <button
        onClick={toggleMyTasks}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-all ${
          isMyTasksActive
            ? 'bg-primary-600/20 border-primary-500/50 text-primary-400'
            : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
      >
        👤 <span>Task của tôi</span>
        {isMyTasksActive && <span className="text-xs">✓</span>}
      </button>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Tìm kiếm task..."
          className="input-base pl-8 py-1.5 text-sm w-48"
        />
      </div>

      {/* Priority filter */}
      <select
        value={filters.priority}
        onChange={e => handleFilter('priority', e.target.value)}
        className="input-base py-1.5 text-sm w-40"
      >
        {PRIORITY_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Member filter */}
      <select
        value={filters.assignee}
        onChange={e => handleFilter('assignee', e.target.value)}
        className="input-base py-1.5 text-sm w-44"
      >
        <option value="">Tất cả thành viên</option>
        {members.map(m => m.user && (
          <option key={m.user._id} value={m.user._id}>
            {m.user._id === currentUser?._id ? `👤 ${m.user.name} (Tôi)` : m.user.name}
          </option>
        ))}
      </select>

      {/* Deadline filter */}
      <select
        value={filters.deadline}
        onChange={e => handleFilter('deadline', e.target.value)}
        className="input-base py-1.5 text-sm w-36"
      >
        {DEADLINE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={handleClear}
          className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
        >
          ✕ Xóa lọc
        </button>
      )}
    </div>
  )
}
