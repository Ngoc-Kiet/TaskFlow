import { useState, useEffect } from 'react'
import { projectService } from '../../services'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

const STATUS_COLORS = { todo: '#64748b', inprogress: '#3b82f6', done: '#22c55e' }
const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#64748b' }

export default function ProjectStats({ project, onClose }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const res = await projectService.getStats(project._id)
      setStats(res.data)
    } catch {}
    setLoading(false)
  }

  const tooltipStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bg-dark-900 border border-slate-700/50 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-100">📊 Thống kê dự án</h2>
              <p className="text-slate-400 text-sm mt-1">{project.name}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-2 rounded-lg hover:bg-slate-800 transition-all">✕</button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <span className="spinner w-10 h-10" />
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Overview cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatBox label="Tổng task" value={stats.total} icon="📋" color="text-blue-400" />
                <StatBox label="Hoàn thành" value={stats.byStatus?.done || 0} icon="✅" color="text-green-400" />
                <StatBox label="Quá hạn" value={stats.overdueCount} icon="⚠️" color="text-red-400" />
                <StatBox label="Tỉ lệ hoàn thành" value={`${stats.completionRate}%`} icon="🎯" color="text-primary-400" />
              </div>

              {/* Charts row */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Status distribution */}
                <div className="glass-card p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Phân bổ theo trạng thái</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Object.entries(stats.byStatus || {}).map(([k, v]) => ({ name: k, value: v }))}>
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {Object.keys(stats.byStatus || {}).map((key) => (
                          <Cell key={key} fill={STATUS_COLORS[key] || '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Priority distribution */}
                <div className="glass-card p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Phân bổ theo độ ưu tiên</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={Object.entries(stats.byPriority || {}).map(([k, v]) => ({ name: k, value: v }))}
                        cx="50%" cy="50%" outerRadius={80} dataKey="value"
                      >
                        {Object.keys(stats.byPriority || {}).map((key) => (
                          <Cell key={key} fill={PRIORITY_COLORS[key] || '#6366f1'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Weekly progress */}
              {stats.weeklyProgress?.length > 0 && (
                <div className="glass-card p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Tiến độ hoàn thành 7 ngày qua</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={stats.weeklyProgress}>
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="completed" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Member performance */}
              {stats.byMember?.length > 0 && (
                <div className="glass-card p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Hiệu suất thành viên</h3>
                  <div className="space-y-3">
                    {stats.byMember.map(m => {
                      const rate = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0
                      return (
                        <div key={m.user._id} className="flex items-center gap-3">
                          <img
                            src={m.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name)}&background=6366f1&color=fff&size=32`}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-slate-300">{m.user.name}</span>
                              <span className="text-xs text-slate-500">{m.done}/{m.total} ({rate}%)</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-primary-500 rounded-full" style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, icon, color }) {
  return (
    <div className="glass-card p-4 text-center">
      <span className="text-2xl block mb-1">{icon}</span>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
