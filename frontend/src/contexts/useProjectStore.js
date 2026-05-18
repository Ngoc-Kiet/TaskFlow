import { create } from 'zustand'
import { projectService } from '../services'
import toast from 'react-hot-toast'

const useProjectStore = create((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,

  fetchProjects: async () => {
    set({ loading: true })
    try {
      const res = await projectService.getAll()
      set({ projects: res.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchProject: async (id) => {
    set({ loading: true })
    try {
      const res = await projectService.getOne(id)
      set({ currentProject: res.data, loading: false })
      return res.data
    } catch {
      set({ loading: false })
      return null
    }
  },

  createProject: async (data) => {
    try {
      const res = await projectService.create(data)
      set(state => ({ projects: [res.data, ...state.projects] }))
      toast.success('Tạo dự án thành công! 🎉')
      return res.data
    } catch {
      return null
    }
  },

  updateProject: async (id, data) => {
    try {
      const res = await projectService.update(id, data)
      set(state => ({
        projects: state.projects.map(p => p._id === id ? res.data : p),
        currentProject: state.currentProject?._id === id ? res.data : state.currentProject
      }))
      toast.success('Cập nhật dự án thành công!')
      return res.data
    } catch {
      return null
    }
  },

  deleteProject: async (id) => {
    try {
      await projectService.delete(id)
      set(state => ({
        projects: state.projects.filter(p => p._id !== id),
        currentProject: state.currentProject?._id === id ? null : state.currentProject
      }))
      toast.success('Đã xóa dự án')
      return true
    } catch {
      return false
    }
  },

  addMember: async (id, data) => {
    try {
      const res = await projectService.addMember(id, data)
      set(state => ({
        projects: state.projects.map(p => p._id === id ? res.data : p),
        currentProject: state.currentProject?._id === id ? res.data : state.currentProject
      }))
      toast.success('Thêm thành viên thành công!')
      return res.data
    } catch (error) {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra')
      return null
    }
  },

  removeMember: async (id, userId) => {
    try {
      const res = await projectService.removeMember(id, userId)
      set(state => ({
        projects: state.projects.map(p => p._id === id ? res.data : p),
        currentProject: state.currentProject?._id === id ? res.data : state.currentProject
      }))
      toast.success('Đã xóa thành viên')
      return res.data
    } catch (error) {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra')
      return null
    }
  },

  setCurrentProject: (project) => set({ currentProject: project })
}))

export default useProjectStore
