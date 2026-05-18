import { create } from 'zustand'
import { taskService } from '../services'
import toast from 'react-hot-toast'

const useTaskStore = create((set, get) => ({
  tasks: [],
  currentTask: null,
  filters: { status: '', priority: '', assignee: '', search: '', deadline: '' },
  loading: false,

  fetchTasks: async (projectId, params = {}) => {
    set({ loading: true })
    try {
      const merged = { ...get().filters, ...params }
      // Remove empty filters
      const cleanParams = Object.fromEntries(Object.entries(merged).filter(([, v]) => v))
      const res = await taskService.getAll(projectId, cleanParams)
      set({ tasks: res.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchTask: async (id) => {
    try {
      const res = await taskService.getOne(id)
      set({ currentTask: res.data })
      return res.data
    } catch {
      return null
    }
  },

  createTask: async (projectId, data) => {
    try {
      const res = await taskService.create(projectId, data)
      set(state => ({ tasks: [...state.tasks, res.data] }))
      toast.success('Tạo task thành công! ✅')
      return res.data
    } catch {
      return null
    }
  },

  updateTask: async (id, data) => {
    try {
      const res = await taskService.update(id, data)
      set(state => ({
        tasks: state.tasks.map(t => t._id === id ? res.data : t),
        currentTask: state.currentTask?._id === id ? res.data : state.currentTask
      }))
      return res.data
    } catch {
      return null
    }
  },

  deleteTask: async (id) => {
    try {
      await taskService.delete(id)
      set(state => ({
        tasks: state.tasks.filter(t => t._id !== id),
        currentTask: state.currentTask?._id === id ? null : state.currentTask
      }))
      toast.success('Đã xóa task')
      return true
    } catch {
      return false
    }
  },

  addComment: async (id, content) => {
    try {
      const res = await taskService.addComment(id, { content })
      set(state => ({
        tasks: state.tasks.map(t => {
          if (t._id !== id) return t
          return { ...t, comments: [...t.comments, res.data] }
        }),
        currentTask: state.currentTask?._id === id
          ? { ...state.currentTask, comments: [...state.currentTask.comments, res.data] }
          : state.currentTask
      }))
      return res.data
    } catch {
      return null
    }
  },

  deleteComment: async (taskId, commentId) => {
    try {
      await taskService.deleteComment(taskId, commentId)
      set(state => ({
        currentTask: state.currentTask?._id === taskId
          ? { ...state.currentTask, comments: state.currentTask.comments.filter(c => c._id !== commentId) }
          : state.currentTask
      }))
      toast.success('Đã xóa bình luận')
    } catch {}
  },

  reorderTasks: async (projectId, updates) => {
    // Optimistic update
    const oldTasks = get().tasks
    set(state => ({
      tasks: state.tasks.map(t => {
        const update = updates.find(u => u.id === t._id)
        return update ? { ...t, status: update.status, order: update.order } : t
      })
    }))
    try {
      await taskService.reorder(projectId, updates)
    } catch {
      // Rollback
      set({ tasks: oldTasks })
    }
  },

  setFilters: (filters) => set(state => ({ filters: { ...state.filters, ...filters } })),
  clearFilters: () => set({ filters: { status: '', priority: '', assignee: '', search: '', deadline: '' } }),
  setCurrentTask: (task) => set({ currentTask: task })
}))

export default useTaskStore
