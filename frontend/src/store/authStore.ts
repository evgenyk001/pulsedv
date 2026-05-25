import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          set({ user: data.user, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      register: async (userData) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/register', userData)
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          set({ user: data.user, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      logout: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({ user: null })
      },
      checkAuth: async () => {
        const token = localStorage.getItem('accessToken')
        if (!token) return
        try {
          const { data } = await api.get('/users/me')
          set({ user: data })
        } catch {
          set({ user: null })
        }
      },
    }),
    { name: 'auth-storage', partialize: (state) => ({ user: state.user }) }
  )
)
