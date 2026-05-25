import { useAuthStore } from '@/store/authStore'

export default function ProfilePage() {
  const { user } = useAuthStore()
  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
      <h1 className="text-3xl font-bold mb-6">Профиль</h1>
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md">
        <p><strong>Имя:</strong> {user?.firstName} {user?.lastName}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Роль:</strong> {user?.role}</p>
      </div>
    </div>
  )
}
