import { useMemo, useState } from 'react'
import { taskService } from '../../services'
import { useEffect } from 'react'

const STATUS_LABEL = { todo: 'To Do', inprogress: 'In Progress', done: 'Xong' }
const STATUS_COLOR = { todo: '#64748b', inprogress: '#3b82f6', done: '#22c55e' }
const STATUS_BG = { todo: 'bg-slate-700/40 text-slate-400', inprogress: 'bg-blue-500/20 text-blue-400', done: 'bg-green-500/20 text-green-400' }

function getWeekBounds(weeksAgo = 0) {
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay() // 1=Mon … 7=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek - 1) - weeksAgo * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

export default function WeeklyTeamReport({ project, onClose }) {
  const [allTasks, setAllTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [weeksAgo, setWeeksAgo] = useState(0) // 0 = tuần này, 1 = tuần trước
  const [expandedMember, setExpandedMember] = useState(null)

  useEffect(() => {
    loadAllTasks()
  }, [project._id])

  const loadAllTasks = async () => {
    setLoading(true)
    try {
      const res = await taskService.getAll(project._id, {})
      setAllTasks(res.data || [])
    } catch {}
    setLoading(false)
  }

  const { start, end } = getWeekBounds(weeksAgo)

  // Lọc tasks trong tuần được chọn
  const weekTasks = useMemo(() => {
    return allTasks.filter(t => {
      const date = new Date(t.updatedAt || t.createdAt)
      return date >= start && date <= end
    })
  }, [allTasks, weeksAgo])

  // Group by member
  const memberStats = useMemo(() => {
    const map = {}

    // Init từ members của project
    ;(project.members || []).forEach(m => {
      const u = m.user
      if (!u || !u._id) return
      map[u._id] = {
        user: u,
        tasks: [],
        todo: 0, inprogress: 0, done: 0, total: 0
      }
    })

    weekTasks.forEach(task => {
      const assignees = task.assignees || []
      assignees.forEach(a => {
        const uid = typeof a === 'object' ? a._id : a
        const uObj = typeof a === 'object' ? a : { _id: uid, name: uid }
        if (!map[uid]) {
          map[uid] = { user: uObj, tasks: [], todo: 0, inprogress: 0, done: 0, total: 0 }
        }
        map[uid].tasks.push(task)
        map[uid].total++
        if (task.status === 'done') map[uid].done++
        else if (task.status === 'inprogress') map[uid].inprogress++
        else map[uid].todo++
      })
    })

    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [weekTasks, project.members])

  const totalThisWeek = weekTasks.length
  const totalDone = weekTasks.filter(t => t.status === 'done').length
  const unassigned = weekTasks.filter(t => !t.assignees?.length)

  const weekLabel = weeksAgo === 0 ? 'Tuần này' : weeksAgo === 1 ? 'Tuần trước' : `${weeksAgo} tuần trước`
  const dateRange = `${start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-dark-900 border border-slate-700/50 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-slide-up flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              📅 Báo cáo tuần
              <span className="text-sm font-normal text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full">{weekLabel}</span>
            </h2>
            <p className="text-slate-500 text-xs mt-1">{project.name} · {dateRange}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Week selector */}
            <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1">
              <button
                onClick={() => setWeeksAgo(v => v + 1)}
                className="px-2 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-all text-sm"
              >‹</button>
              <span className="text-xs text-slate-400 min-w-[70px] text-center">{weekLabel}</span>
              <button
                onClick={() => setWeeksAgo(v => Math.max(0, v - 1))}
                disabled={weeksAgo === 0}
                className="px-2 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-all text-sm disabled:opacity-30"
              >›</button>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all">✕</button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center py-16">
            <span className="spinner w-10 h-10" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '📋', label: 'Tổng task', value: totalThisWeek, color: 'text-slate-200' },
                { icon: '✅', label: 'Hoàn thành', value: totalDone, color: 'text-green-400' },
                { icon: '⏳', label: 'Đang làm', value: weekTasks.filter(t => t.status === 'inprogress').length, color: 'text-blue-400' },
              ].map(s => (
                <div key={s.label} className="glass-card p-3 text-center">
                  <span className="text-xl block mb-0.5">{s.icon}</span>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            {totalThisWeek === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <span className="text-4xl block mb-2">🗓️</span>
                <p>Không có task nào được cập nhật trong {weekLabel.toLowerCase()}</p>
              </div>
            ) : (
              <>
                {/* Member breakdown */}
                <div className="glass-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-300">Đóng góp theo thành viên</h3>
                    <span className="text-xs text-slate-600">{memberStats.filter(m => m.total > 0).length} thành viên active</span>
                  </div>

                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-2 text-xs text-slate-600 border-b border-slate-800/50 bg-dark-950/30">
                    <span>Thành viên</span>
                    <span className="w-12 text-center">To Do</span>
                    <span className="w-16 text-center">In Progress</span>
                    <span className="w-10 text-center">Xong</span>
                    <span className="w-14 text-center">Tổng</span>
                  </div>

                  <div className="divide-y divide-slate-800/30">
                    {memberStats.map(m => {
                      const rate = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0
                      const isExpanded = expandedMember === m.user._id
                      const avatarUrl = m.user.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name || 'U')}&background=6366f1&color=fff&size=32`

                      return (
                        <div key={m.user._id}>
                          {/* Row */}
                          <div
                            className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-3 items-center cursor-pointer transition-colors ${
                              m.total > 0 ? 'hover:bg-slate-800/30' : 'opacity-40'
                            } ${isExpanded ? 'bg-slate-800/20' : ''}`}
                            onClick={() => m.total > 0 && setExpandedMember(isExpanded ? null : m.user._id)}
                          >
                            {/* Avatar + name + progress */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-slate-200 truncate">{m.user.name}</span>
                                  {m.total > 0 && (
                                    <span className="text-xs text-slate-600">{isExpanded ? '▲' : '▼'}</span>
                                  )}
                                </div>
                                {/* Progress bar */}
                                {m.total > 0 && (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="w-20 h-1 bg-slate-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${rate}%` }} />
                                    </div>
                                    <span className="text-xs text-slate-600">{rate}%</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <span className="w-12 text-center text-sm text-slate-400">{m.todo || '–'}</span>
                            <span className="w-16 text-center text-sm text-blue-400">{m.inprogress || '–'}</span>
                            <span className="w-10 text-center text-sm text-green-400 font-medium">{m.done || '–'}</span>
                            <span className={`w-14 text-center text-sm font-bold ${m.total > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                              {m.total}
                            </span>
                          </div>

                          {/* Expanded: task list */}
                          {isExpanded && m.tasks.length > 0 && (
                            <div className="px-4 pb-3 bg-dark-950/50 space-y-1.5">
                              {m.tasks.map(task => (
                                <div key={task._id} className="flex items-center gap-2.5 py-1.5 pl-10">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BG[task.status]}`}>
                                    {STATUS_LABEL[task.status]}
                                  </span>
                                  <span className="text-sm text-slate-300 truncate flex-1">{task.title}</span>
                                  {task.deadline && (
                                    <span className={`text-xs flex-shrink-0 ${
                                      new Date(task.deadline) < new Date() && task.status !== 'done'
                                        ? 'text-red-400' : 'text-slate-600'
                                    }`}>
                                      {new Date(task.deadline).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Unassigned */}
                  {unassigned.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-slate-800/50 flex items-center justify-between">
                      <span className="text-xs text-slate-600">📌 {unassigned.length} task chưa giao</span>
                      <span className="text-xs text-slate-700">Không tính vào cá nhân</span>
                    </div>
                  )}
                </div>

                {/* Completion rate bar */}
                {totalThisWeek > 0 && (
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Tỉ lệ hoàn thành tuần</span>
                      <span className="text-sm font-bold text-green-400">{Math.round((totalDone / totalThisWeek) * 100)}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round((totalDone / totalThisWeek) * 100)}%`,
                          background: 'linear-gradient(90deg, #6366f1, #22c55e)'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>{totalDone} hoàn thành</span>
                      <span>{totalThisWeek - totalDone} còn lại</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
