import { Navigate } from 'react-router-dom'
import useAuthStore from '../../contexts/useAuthStore'

export default function PrivateRoute({ children }) {
  const { token } = useAuthStore()
  return token ? children : <Navigate to="/login" replace />
}

export function PublicRoute({ children }) {
  const { token } = useAuthStore()
  return token ? <Navigate to="/dashboard" replace /> : children
}
