import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useProjectStore from '../contexts/useProjectStore'
import useTaskStore from '../contexts/useTaskStore'
import TaskCard from '../components/task/TaskCard'
import TaskModal from '../components/task/TaskModal'
import CreateTaskModal from '../components/task/CreateTaskModal'
import TaskFilters from '../components/task/TaskFilters'
import ProjectStats from '../components/project/ProjectStats'
import MembersPanel from '../components/project/MembersPanel'
import { projectService } from '../services'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import WeeklyTeamReport from '../components/project/WeeklyTeamReport'
import WorkloadView from '../components/project/WorkloadView'
import toast from 'react-hot-toast'
import { exportProjectToExcel } from '../utils/excelExport'

const DEFAULT_COLUMNS = [
  { id: 'todo', title: 'To Do', color: '#64748b', icon: '📋' },
  { id: 'inprogress', title: 'In Progress', color: '#3b82f6', icon: '⚡' },
  { id: 'done', title: 'Done', color: '#22c55e', icon: '✅' }
]

export default function ProjectPage() {
  const { id: projectId } = useParams()
  const { currentProject, fetchProject } = useProjectStore()
  const { tasks, fetchTasks, reorderTasks, filters, clearFilters } = useTaskStore()
  const [activeTask, setActiveTask] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showCreateTask, setShowCreateTask] = useState(null) // column id
  const [showStats, setShowStats] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showWeeklyReport, setShowWeeklyReport] = useState(false)
  const [showWorkload, setShowWorkload] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [view, setView] = useState('kanban')
  const [loading, setLoading] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    clearFilters() // Reset filter khi chuyển project / user mới vào
    loadProject()
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      fetchTasks(projectId)
    }
  }, [projectId, filters])

  const loadProject = async () => {
    setLoading(true)
    await fetchProject(projectId)
    await fetchTasks(projectId)
    setLoading(false)
  }

  const columns = currentProject?.columns || DEFAULT_COLUMNS

  const getTasksByStatus = (status) =>
    tasks.filter(t => t.status === status).sort((a, b) => a.order - b.order)

  const handleDragStart = (event) => {
    const task = tasks.find(t => t._id === event.active.id)
    setActiveTask(task)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id
    const overId = over.id

    const task = tasks.find(t => t._id === taskId)
    if (!task) return

    // Determine target column
    const targetColumn = columns.find(c => c.id === overId)
    const overTask = tasks.find(t => t._id === overId)
    const targetStatus = targetColumn?.id || overTask?.status

    if (!targetStatus || targetStatus === task.status) return

    // Build reorder updates
    const columnTasks = tasks.filter(t => t.status === targetStatus && t._id !== taskId)
    const updates = [
      { id: taskId, status: targetStatus, order: columnTasks.length },
      ...columnTasks.map((t, i) => ({ id: t._id, status: t.status, order: i }))
    ]

    await reorderTasks(projectId, updates)
    toast.success(`Task moved to ${targetColumn?.title || overTask?.status}`)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="spinner w-12 h-12 block mx-auto mb-4" />
          <p className="text-slate-400">Đang tải dự án...</p>
        </div>
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">😕</span>
          <p className="text-slate-400">Không tìm thấy dự án</p>
        </div>
      </div>
    )
  }

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Project Header */}
      <div className="border-b border-slate-800/50 px-6 py-4 bg-dark-950/50 backdrop-blur relative z-20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg"
              style={{ backgroundColor: `${currentProject.color}20`, border: `1px solid ${currentProject.color}40` }}
            >
              {currentProject.icon}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">{currentProject.name}</h1>
              {currentProject.description && (
                <p className="text-xs text-slate-400 truncate max-w-md">{currentProject.description}</p>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">Tiến độ</p>
              <p className="text-sm font-semibold text-slate-200">{progress}% ({doneTasks}/{totalTasks})</p>
            </div>
            <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, backgroundColor: currentProject.color || '#6366f1' }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Members avatars - click để mở workload */}
            <div
              className="flex -space-x-2 mr-1 cursor-pointer"
              onClick={() => setShowWorkload(true)}
              title="Xem khối lượng công việc"
            >
              {currentProject.members?.slice(0, 4).map(m => {
                if (!m.user) return null;
                const memberTaskCount = tasks.filter(t =>
                  t.status !== 'done' && (t.assignees || []).some(a => (typeof a === 'object' ? a._id : a) === m.user._id)
                ).length
                return (
                  <div key={m.user._id} className="relative">
                    <img
                      src={m.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name || 'User')}&background=6366f1&color=fff&size=32`}
                      alt={m.user.name}
                      title={`${m.user.name} - ${memberTaskCount} task active`}
                      className="w-7 h-7 rounded-full border-2 border-dark-950 hover:scale-110 transition-transform"
                    />
                    {memberTaskCount > 0 && (
                      <span className={`absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 ${memberTaskCount > 5 ? 'bg-red-500' : memberTaskCount > 3 ? 'bg-orange-500' : 'bg-blue-500'
                        }`}>
                        {memberTaskCount}
                      </span>
                    )}
                  </div>
                )
              })}
              {currentProject.members?.length > 4 && (
                <div className="w-7 h-7 rounded-full bg-slate-700 border-2 border-dark-950 flex items-center justify-center text-xs text-slate-400">
                  +{currentProject.members.length - 4}
                </div>
              )}
            </div>

            {/* Actions dropdown */}
            <div className={`relative ${showActionsMenu ? 'z-50' : ''}`}>
              <button
                onClick={() => setShowActionsMenu(v => !v)}
                className="btn-secondary text-sm px-2.5 py-2"
                title="Thêm tùy chọn"
              >
                ⋯
              </button>
              {showActionsMenu && (
                <div className="absolute right-0 top-full mt-1 bg-dark-800 border border-slate-700 rounded-xl shadow-xl z-50 min-w-[160px] overflow-hidden animate-fade-in">
                  {[
                    { icon: '🏋️', label: 'Khối lượng', action: () => setShowWorkload(true) },
                    { icon: '📅', label: 'Báo cáo tuần', action: () => setShowWeeklyReport(true) },
                    { icon: '📊', label: 'Thống kê', action: () => setShowStats(true) },
                    { icon: '📥', label: 'Xuất Excel', action: () => {
                      try {
                        const fileName = exportProjectToExcel(currentProject, tasks)
                        toast.success(`Đã xuất báo cáo: ${fileName}`)
                      } catch (err) {
                        console.error('Export error:', err)
                        toast.error('Xuất báo cáo thất bại!')
                      }
                    }},
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={() => { item.action(); setShowActionsMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowMembers(true)} className="btn-secondary text-sm px-3 py-2 flex items-center gap-1.5">
              👥 Thành viên
            </button>
            <button onClick={() => setShowCreateTask('todo')} className="btn-primary text-sm px-3 py-2">
              + Thêm task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-3">
          <TaskFilters projectId={projectId} members={currentProject.members || []} />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max pb-4">
            {columns.map(column => {
              const columnTasks = getTasksByStatus(column.id)
              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  onCreateTask={() => setShowCreateTask(column.id)}
                  onTaskClick={(task) => setSelectedTask(task)}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="rotate-2 opacity-90 scale-105">
                <TaskCard task={activeTask} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          project={currentProject}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => fetchTasks(projectId)}
        />
      )}

      {showCreateTask && (
        <CreateTaskModal
          projectId={projectId}
          defaultStatus={showCreateTask}
          members={currentProject.members || []}
          onClose={() => setShowCreateTask(null)}
          onCreated={() => fetchTasks(projectId)}
        />
      )}

      {showWeeklyReport && currentProject && (
        <WeeklyTeamReport
          project={currentProject}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}

      {showWorkload && currentProject && (
        <WorkloadView
          project={currentProject}
          tasks={tasks}
          onClose={() => setShowWorkload(false)}
        />
      )}

      {showStats && (
        <ProjectStats project={currentProject} onClose={() => setShowStats(false)} />
      )}

      {showMembers && (
        <MembersPanel project={currentProject} onClose={() => setShowMembers(false)} />
      )}

      {/* Close actions menu on backdrop click */}
      {showActionsMenu && (
        <div className="fixed inset-0 -z-10" onClick={() => setShowActionsMenu(false)} />
      )}
    </div>
  )
}

// Droppable Kanban Column
function KanbanColumn({ column, tasks, onCreateTask, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div
      className={`kanban-column w-72 flex-shrink-0 transition-all duration-200 ${isOver ? 'drag-over' : ''}`}
    >
      {/* Column Header */}
      <div className="p-3 flex items-center justify-between border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="text-sm font-semibold text-slate-200">{column.title}</span>
          <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onCreateTask}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-all text-lg"
        >
          +
        </button>
      </div>

      {/* Tasks */}
      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px]">
        <SortableContext items={tasks.map(t => t._id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTask key={task._id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-600 text-xs">
            <span className="text-2xl mb-1">📭</span>
            <p>Kéo task vào đây</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Sortable Task wrapper
function SortableTask({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick} />
    </div>
  )
}
