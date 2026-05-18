import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../contexts/useAuthStore'
import useProjectStore from '../../contexts/useProjectStore'
import NotificationPanel from '../common/NotificationPanel'

const PRIORITY_COLORS = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-slate-500'
}

export default function Sidebar({ onCreateProject }) {
  const { user, logout, unreadNotifications } = useAuthStore()
  const { projects, fetchProjects } = useProjectStore()
  const [showNotifications, setShowNotifications] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <>
      <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-dark-950 border-r border-slate-800/50 flex flex-col transition-all duration-300 relative`}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/30 flex-shrink-0">
                <span className="text-sm">⚡</span>
              </div>
              <span className="font-bold text-slate-100 text-lg">TaskFlow</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg mx-auto">
              <span className="text-sm">⚡</span>
            </div>
          )}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
              ◀
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-6 w-6 h-6 bg-dark-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 shadow-md z-10"
          >
            ▶
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* Main nav */}
          <Link to="/dashboard" className={`sidebar-item ${isActive('/dashboard') ? 'active' : ''}`}>
            <span className="text-lg flex-shrink-0">📊</span>
            {!collapsed && <span>Dashboard</span>}
          </Link>

          {/* Projects section */}
          {!collapsed && (
            <div className="pt-4 pb-2">
              <div className="flex items-center justify-between px-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dự án</p>
                {user?.role === 'admin' && (
                  <button
                    onClick={onCreateProject}
                    className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                    title="Tạo dự án mới"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          )}

          {collapsed && user?.role === 'admin' && (
            <button
              onClick={onCreateProject}
              className="sidebar-item justify-center"
              title="Tạo dự án mới"
            >
              <span className="text-lg">➕</span>
            </button>
          )}

          {projects.map(project => (
            <Link
              key={project._id}
              to={`/projects/${project._id}`}
              className={`sidebar-item ${isActive(`/projects/${project._id}`) ? 'active' : ''}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              {!collapsed && (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="truncate">{project.icon} {project.name}</span>
                  {project.taskCounts?.total > 0 && (
                    <span className="ml-auto text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {project.taskCounts.total}
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}

          {projects.length === 0 && !collapsed && (
            <div className="px-3 py-4 text-center">
              <p className="text-slate-600 text-xs">Chưa có dự án nào</p>
              {user?.role === 'admin' && (
                <button onClick={onCreateProject} className="mt-2 text-primary-400 text-xs hover:text-primary-300">
                  + Tạo dự án đầu tiên
                </button>
              )}
            </div>
          )}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-slate-800/50 space-y-1">
          {/* Notifications */}
          <button
            onClick={() => setShowNotifications(true)}
            className="sidebar-item w-full relative"
          >
            <span className="text-lg flex-shrink-0">🔔</span>
            {!collapsed && <span>Thông báo</span>}
            {unreadNotifications > 0 && (
              <span className={`${collapsed ? 'absolute top-0 right-0' : 'ml-auto'} bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold`}>
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          {/* Profile */}
          <Link to="/profile" className={`sidebar-item ${isActive('/profile') ? 'active' : ''}`}>
            <img
              src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=6366f1&color=fff`}
              alt={user?.name}
              className="w-7 h-7 rounded-full flex-shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            )}
          </Link>

          {/* Logout */}
          <button onClick={handleLogout} className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <span className="text-lg flex-shrink-0">🚪</span>
            {!collapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Notification Panel */}
      {showNotifications && (
        <NotificationPanel onClose={() => setShowNotifications(false)} />
      )}
    </>
  )
}
