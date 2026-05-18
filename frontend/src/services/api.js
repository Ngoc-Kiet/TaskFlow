import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor - add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('taskflow_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.'
    
    if (error.response?.status === 401) {
      localStorage.removeItem('taskflow_token')
      localStorage.removeItem('taskflow_user')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (error.response?.status !== 404) {
      toast.error(message)
    }

    return Promise.reject({ ...error, message })
  }
)

export default api
