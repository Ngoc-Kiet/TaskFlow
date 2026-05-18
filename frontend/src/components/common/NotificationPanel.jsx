import { useState, useEffect } from 'react'
import { notificationService } from '../../services'
import useAuthStore from '../../contexts/useAuthStore'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import toast from 'react-hot-toast'

const TYPE_ICON = {
  task_assigned: '📋',
  task_deadline: '⏰',
  task_comment: '💬',
  task_status_changed: '🔄',
  project_invitation: '📁',
  task_completed: '✅',
  mention: '@'
}

export default function NotificationPanel({ onClose }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const { setUnreadCount: setGlobalUnread } = useAuthStore()

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const res = await notificationService.getAll({ limit: 30 })
      setNotifications(res.data)
      setUnreadCount(res.unreadCount)
    } catch {}
    setLoading(false)
  }

  const markRead = async (id) => {
    await notificationService.markRead(id)
    setNotifications(ns => ns.map(n => n._id === id ? { ...n, isRead: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
    setGlobalUnread(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await notificationService.markAllRead()
    setNotifications(ns => ns.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    setGlobalUnread(0)
    toast.success('Đã đọc tất cả thông báo')
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-dark-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <h2 className="font-semibold text-slate-100">Thông báo</h2>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                Đọc tất cả
              </button>
            )}
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 transition-all">
              ✕
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <span className="spinner w-8 h-8" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500">
              <span className="text-4xl mb-2">🎉</span>
              <p className="text-sm">Không có thông báo nào</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {notifications.map(n => (
                <div
                  key={n._id}
                  onClick={() => !n.isRead && markRead(n._id)}
                  className={`p-4 cursor-pointer hover:bg-slate-800/30 transition-colors ${!n.isRead ? 'bg-primary-500/5' : ''}`}
                >
                  <div className="flex gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg
                      ${!n.isRead ? 'bg-primary-500/20' : 'bg-slate-800'}`}>
                      {TYPE_ICON[n.type] || '🔔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!n.isRead ? 'text-slate-100' : 'text-slate-400'}`}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: vi })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
