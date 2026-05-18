import { create } from 'zustand'
import { authService } from '../services'
import toast from 'react-hot-toast'

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('taskflow_user') || 'null'),
  token: localStorage.getItem('taskflow_token'),
  loading: false,
  unreadNotifications: 0,

  login: async (email, password) => {
    set({ loading: true })
    try {
      const res = await authService.login({ email, password })
      const { token, user } = res.data
      localStorage.setItem('taskflow_token', token)
      localStorage.setItem('taskflow_user', JSON.stringify(user))
      set({ user, token, loading: false })
      toast.success(`Chào mừng trở lại, ${user.name}! 👋`)
      return true
    } catch (error) {
      set({ loading: false })
      return false
    }
  },

  register: async (name, email, password) => {
    set({ loading: true })
    try {
      const res = await authService.register({ name, email, password })
      const { token, user } = res.data
      localStorage.setItem('taskflow_token', token)
      localStorage.setItem('taskflow_user', JSON.stringify(user))
      set({ user, token, loading: false })
      toast.success('Đăng ký thành công! 🎉')
      return true
    } catch (error) {
      set({ loading: false })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('taskflow_token')
    localStorage.removeItem('taskflow_user')
    set({ user: null, token: null })
    toast.success('Đã đăng xuất')
  },

  refreshUser: async () => {
    try {
      const res = await authService.getMe()
      const { user, unreadNotifications } = res.data
      localStorage.setItem('taskflow_user', JSON.stringify(user))
      set({ user, unreadNotifications })
    } catch {}
  },

  updateUser: (userData) => {
    const user = { ...get().user, ...userData }
    localStorage.setItem('taskflow_user', JSON.stringify(user))
    set({ user })
  },

  setUnreadCount: (count) => set({ unreadNotifications: count })
}))

export default useAuthStore
