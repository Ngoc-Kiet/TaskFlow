import { useState, useEffect } from 'react'
import { userService } from '../services'
import useAuthStore from '../contexts/useAuthStore'
import useTaskStore from '../contexts/useTaskStore'
import useProjectStore from '../contexts/useProjectStore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { Link } from 'react-router-dom'
import { format, isAfter } from 'date-fns'
import { vi } from 'date-fns/locale'
import ExportWeeklyReportModal from '../components/project/ExportWeeklyReportModal'

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#64748b' }
const STATUS_COLORS = { todo: '#64748b', inprogress: '#3b82f6', done: '#22c55e' }
const STATUS_LABELS = { todo: 'Cần làm', inprogress: 'Đang làm', done: 'Hoàn thành' }

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { projects } = useProjectStore()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showExportModal, setShowExportModal] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await userService.getDashboard()
      setDashboard(res.data)
    } catch {}
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center">
          <span className="spinner w-12 h-12 block mx-auto mb-4" />
          <p className="text-slate-400">Đang tải dashboard...</p>
        </div>
      </div>
    )
  }

  const { taskStats = {}, myTasks = [], projectCount = 0, overdueTasks = 0 } = dashboard || {}

  const totalTasks = (taskStats.todo || 0) + (taskStats.inprogress || 0) + (taskStats.done || 0)
  const completionRate = totalTasks > 0 ? Math.round((taskStats.done / totalTasks) * 100) : 0

  const pieData = [
    { name: 'Cần làm', value: taskStats.todo || 0, color: STATUS_COLORS.todo },
    { name: 'Đang làm', value: taskStats.inprogress || 0, color: STATUS_COLORS.inprogress },
    { name: 'Hoàn thành', value: taskStats.done || 0, color: STATUS_COLORS.done }
  ].filter(d => d.value > 0)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Chào buổi sáng, {user?.name?.split(' ').pop()}! 👋
          </h1>
          <p className="text-slate-400 mt-1">Đây là tổng quan công việc của bạn hôm nay</p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-lg hover:shadow-primary-500/20 transition-all duration-200"
        >
          <span>📅</span> Xuất Excel Báo Cáo Tuần
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📁" label="Dự án" value={projectCount} color="from-primary-600 to-primary-700" />
        <StatCard icon="📋" label="Tổng task" value={totalTasks} color="from-blue-600 to-blue-700" />
        <StatCard icon="🔥" label="Đang làm" value={taskStats.inprogress || 0} color="from-orange-600 to-orange-700" />
        <StatCard icon="⚠️" label="Quá hạn" value={overdueTasks} color={overdueTasks > 0 ? "from-red-600 to-red-700" : "from-slate-600 to-slate-700"} />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-slate-200 mb-4">Phân bổ task theo trạng thái</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                    <span className="text-sm text-slate-400">{d.name}</span>
                    <span className="text-sm font-semibold text-slate-200 ml-auto">{d.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-700 mt-2">
                  <p className="text-xs text-slate-500">Hoàn thành</p>
                  <p className="text-2xl font-bold gradient-text">{completionRate}%</p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyChart message="Chưa có task nào" />
          )}
        </div>

        {/* My upcoming tasks */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-slate-200 mb-4">Task sắp đến hạn</h3>
          {myTasks.length === 0 ? (
            <EmptyChart message="Không có task nào sắp đến hạn 🎉" />
          ) : (
            <div className="space-y-2">
              {myTasks.slice(0, 5).map(task => (
                <div key={task._id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    task.priority === 'urgent' ? 'bg-red-500' :
                    task.priority === 'high' ? 'bg-orange-500' :
                    task.priority === 'medium' ? 'bg-yellow-500' : 'bg-slate-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{task.title}</p>
                    <p className="text-xs text-slate-500">{task.project?.name}</p>
                  </div>
                  {task.deadline && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isAfter(new Date(), new Date(task.deadline)) && task.status !== 'pending'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {format(new Date(task.deadline), 'dd/MM', { locale: vi })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Projects overview */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-200">Tiến độ dự án</h3>
          <Link to="/projects" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
            Xem tất cả →
          </Link>
        </div>
        {projects.length === 0 ? (
          <EmptyChart message="Chưa có dự án nào" />
        ) : (
          <div className="space-y-4">
            {projects.slice(0, 5).map(project => {
              const total = project.taskCounts?.total || 0
              const done = project.taskCounts?.done || 0
              const rate = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <Link key={project._id} to={`/projects/${project._id}`} className="block group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{project.icon}</span>
                      <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100 transition-colors">
                        {project.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{done}/{total} tasks</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 progress-bar"
                      style={{ width: `${rate}%`, backgroundColor: project.color || '#6366f1' }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      {showExportModal && (
        <ExportWeeklyReportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="glass-card p-4 hover:border-slate-600/50 transition-all duration-200 hover:-translate-y-0.5">
      <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center mb-3 shadow-lg`}>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-sm text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

function EmptyChart({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-600">
      <span className="text-3xl mb-2">📭</span>
      <p className="text-sm">{message}</p>
    </div>
  )
}
