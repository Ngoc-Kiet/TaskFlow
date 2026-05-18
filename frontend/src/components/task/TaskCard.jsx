import { format, isAfter, differenceInDays } from 'date-fns'
import { vi } from 'date-fns/locale'

const PRIORITY_CONFIG = {
  urgent: { label: 'Khẩn cấp', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', dot: 'bg-red-500' },
  high: { label: 'Cao', color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  medium: { label: 'Trung bình', color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  low: { label: 'Thấp', color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/30', dot: 'bg-slate-500' }
}

export default function TaskCard({ task, onClick, isDragging }) {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
  const isOverdue = task.deadline && task.status !== 'done' && isAfter(new Date(), new Date(task.deadline))
  const daysLeft = task.deadline ? differenceInDays(new Date(task.deadline), new Date()) : null
  const isUrgentDeadline = daysLeft !== null && daysLeft <= 2 && daysLeft >= 0

  const completedChecklist = task.checklist?.filter(c => c.completed).length || 0
  const totalChecklist = task.checklist?.length || 0

  return (
    <div
      onClick={onClick}
      className={`task-card group ${isDragging ? 'shadow-2xl shadow-primary-500/20' : ''} ${isOverdue ? 'border-red-500/40 glow-red' : ''}`}
    >
      {/* Priority indicator */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`badge ${priority.bg} ${priority.color} border ${priority.border} text-xs`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
          {priority.label}
        </span>
        {task.assignees?.length > 0 && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map(a => (
              <img
                key={a._id}
                src={a.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=6366f1&color=fff&size=24`}
                alt={a.name}
                title={a.name}
                className="w-6 h-6 rounded-full border-2 border-dark-800"
              />
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className={`text-sm font-medium leading-snug mb-2 ${task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-100'}`}>
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Tags */}
      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/30">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {/* Comments */}
          {task.comments?.length > 0 && (
            <span className="flex items-center gap-1">
              💬 {task.comments.length}
            </span>
          )}
          {/* Attachments */}
          {task.attachments?.length > 0 && (
            <span className="flex items-center gap-1">
              📎 {task.attachments.length}
            </span>
          )}
          {/* Checklist */}
          {totalChecklist > 0 && (
            <span className={`flex items-center gap-1 ${completedChecklist === totalChecklist ? 'text-green-400' : ''}`}>
              ✓ {completedChecklist}/{totalChecklist}
            </span>
          )}
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1">
          {task.startDate && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/20 text-blue-400">
              🚀 {format(new Date(task.startDate), 'dd/MM', { locale: vi })}
            </span>
          )}
          {task.startDate && task.deadline && <span className="text-slate-600">-</span>}
          {task.deadline && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isOverdue ? 'bg-red-500/20 text-red-400' :
              isUrgentDeadline ? 'bg-orange-500/20 text-orange-400' :
              'bg-slate-700/50 text-slate-400'
            }`}>
              {isOverdue ? '⚠️ ' : isUrgentDeadline ? '⏰ ' : '📅 '}
              {format(new Date(task.deadline), 'dd/MM', { locale: vi })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
