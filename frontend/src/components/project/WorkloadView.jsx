import { useMemo } from 'react'

const LOAD_LEVELS = [
  { max: 0, label: 'Rảnh', color: '#64748b', bg: 'bg-slate-700/30', text: 'text-slate-500' },
  { max: 2, label: 'Nhẹ', color: '#22c55e', bg: 'bg-green-500/15', text: 'text-green-400' },
  { max: 5, label: 'Bình thường', color: '#3b82f6', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  { max: 8, label: 'Bận', color: '#f97316', bg: 'bg-orange-500/15', text: 'text-orange-400' },
  { max: Infinity, label: 'Quá tải!', color: '#ef4444', bg: 'bg-red-500/15', text: 'text-red-400' },
]

function getLoad(count) {
  return LOAD_LEVELS.find(l => count <= l.max) || LOAD_LEVELS[LOAD_LEVELS.length - 1]
}

export default function WorkloadView({ project, tasks, onClose }) {
  const memberStats = useMemo(() => {
    const map = {}

    // Init all members
    ;(project.members || []).forEach(m => {
      const u = m.user
      if (!u?._id) return
      map[u._id] = {
        user: u,
        todo: [], inprogress: [], done: [], overdue: [],
        totalHours: 0
      }
    })

    // Count tasks
    const now = new Date()
    tasks.forEach(task => {
      if (task.isArchived) return
      ;(task.assignees || []).forEach(a => {
        const uid = typeof a === 'object' ? a._id : a
        if (!map[uid]) return
        const isOverdue = task.deadline && task.status !== 'done' && new Date(task.deadline) < now

        if (task.status === 'done') map[uid].done.push(task)
        else if (task.status === 'inprogress') map[uid].inprogress.push(task)
        else map[uid].todo.push(task)

        if (isOverdue) map[uid].overdue.push(task)
        if (task.estimatedHours) map[uid].totalHours += task.estimatedHours
      })
    })

    return Object.values(map).sort((a, b) => {
      const aActive = a.inprogress.length + a.todo.length
      const bActive = b.inprogress.length + b.todo.length
      return bActive - aActive
    })
  }, [tasks, project.members])

  const maxActive = Math.max(1, ...memberStats.map(m => m.inprogress.length + m.todo.length))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-dark-900 border border-slate-700/50 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl animate-slide-up flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-100">🏋️ Khối lượng công việc</h2>
            <p className="text-slate-500 text-xs mt-0.5">{project.name} · {tasks.filter(t => !t.isArchived && t.status !== 'done').length} tasks đang hoạt động</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 pb-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Rảnh</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Nhẹ (1-2)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Bình thường (3-5)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Bận (6-8)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Quá tải (&gt;8)</span>
          </div>

          {memberStats.map(m => {
            const activeCount = m.inprogress.length + m.todo.length
            const load = getLoad(activeCount)
            const pct = Math.round((activeCount / maxActive) * 100)
            const avatarUrl = m.user.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name || 'U')}&background=6366f1&color=fff&size=40`

            return (
              <div key={m.user._id} className={`rounded-xl border ${
                activeCount > 8 ? 'border-red-500/30' : 'border-slate-800'
              } overflow-hidden`}>
                {/* Member row */}
                <div className={`flex items-center gap-3 p-3 ${load.bg}`}>
                  <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-dark-900" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-200 truncate">{m.user.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${load.text} ${load.bg} border border-current/20`}>
                        {load.label}
                      </span>
                      {m.overdue.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                          ⚠️ {m.overdue.length} quá hạn
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: load.color }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs flex-shrink-0">
                    <div className="text-center">
                      <p className="font-bold text-slate-200">{activeCount}</p>
                      <p className="text-slate-600">active</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-blue-400">{m.inprogress.length}</p>
                      <p className="text-slate-600">doing</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-green-400">{m.done.length}</p>
                      <p className="text-slate-600">done</p>
                    </div>
                    {m.totalHours > 0 && (
                      <div className="text-center">
                        <p className="font-bold text-purple-400">{m.totalHours}h</p>
                        <p className="text-slate-600">ước tính</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Overdue task list */}
                {m.overdue.length > 0 && (
                  <div className="px-3 pb-2 pt-1 bg-red-500/5 border-t border-red-500/20 space-y-1">
                    {m.overdue.map(t => (
                      <div key={t._id} className="flex items-center gap-2 text-xs text-red-400/80">
                        <span>⚠️</span>
                        <span className="truncate">{t.title}</span>
                        <span className="ml-auto text-red-500/60 flex-shrink-0">
                          {new Date(t.deadline).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Team summary */}
          <div className="glass-card p-4 mt-2">
            <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Tổng quan đội nhóm</h3>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: 'Active tasks', value: tasks.filter(t => t.status !== 'done' && !t.isArchived).length, color: 'text-slate-200' },
                { label: 'Đang làm', value: tasks.filter(t => t.status === 'inprogress').length, color: 'text-blue-400' },
                { label: 'Quá hạn', value: tasks.filter(t => t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date()).length, color: 'text-red-400' },
                { label: 'Hoàn thành', value: tasks.filter(t => t.status === 'done').length, color: 'text-green-400' },
              ].map(s => (
                <div key={s.label}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-600">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
