import { useState, useEffect, useRef } from 'react'
import { notificationService } from '../../services'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

const TYPE_ICON = {
  task_assigned: '📋',
  task_completed: '✅',
  task_overdue: '⚠️',
  comment_added: '💬',
  member_added: '👥',
  deadline_reminder: '📅',
  default: '🔔'
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    loadNotifications()
    // Poll mỗi 30 giây
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = async () => {
    try {
      const res = await notificationService.getAll({ limit: 20 })
      const list = res.data || []
      setNotifications(list)
      setUnreadCount(list.filter(n => !n.isRead).length)
    } catch {}
  }

  const handleMarkRead = async (id) => {
    await notificationService.markRead(id)
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkAllRead = async () => {
    setLoading(true)
    await notificationService.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    setLoading(false)
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    await notificationService.delete(id)
    setNotifications(prev => prev.filter(n => n._id !== id))
    setUnreadCount(prev => {
      const n = notifications.find(x => x._id === id)
      return n && !n.isRead ? Math.max(0, prev - 1) : prev
    })
  }

  const timeAgo = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: vi })
    } catch { return '' }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(v => !v); if (!open) loadNotifications() }}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
        title="Thông báo"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-dark-900 border border-slate-700/50 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-sm font-semibold text-slate-200">
              Thông báo {unreadCount > 0 && <span className="text-primary-400">({unreadCount} mới)</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                Đánh dấu đọc hết
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/50">
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <span className="text-3xl block mb-2">🔕</span>
                <p className="text-sm text-slate-500">Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  onClick={() => !n.isRead && handleMarkRead(n._id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors group hover:bg-slate-800/50 ${
                    !n.isRead ? 'bg-primary-500/5' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base ${
                    !n.isRead ? 'bg-primary-500/15' : 'bg-slate-800'
                  }`}>
                    {TYPE_ICON[n.type] || TYPE_ICON.default}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.isRead ? 'text-slate-200' : 'text-slate-400'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>

                  {/* Unread dot + delete */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary-500 mt-1" />
                    )}
                    <button
                      onClick={(e) => handleDelete(n._id, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-600">{notifications.length} thông báo gần nhất</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
