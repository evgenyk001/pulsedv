import { useAuthStore } from '@/store/authStore'

export const useAuth = () => {
  const { user, isLoading, login, register, logout, checkAuth } = useAuthStore()
  return { user, isLoading, login, register, logout, checkAuth }
}
