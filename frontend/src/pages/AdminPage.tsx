import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'

export default function AdminPage() {
  const { user } = useAuthStore()
  if (user?.role !== 'ADMIN') return <Navigate to="/" />
  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
      <h1 className="text-3xl font-bold mb-6">Админ панель</h1>
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md">
        <p>Управление объявлениями, пользователями, модерация</p>
      </div>
    </div>
  )
}
