import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { Skeleton } from '@/components/UI/Skeleton'
import { AIChat } from '@/components/Chat/AIChat'

export default function ListingDetailPage() {
  const { id } = useParams()
  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      const { data } = await api.get(`/listings/${id}`)
      return data
    },
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-2xl font-bold">Объект не найден</h1>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <img
            src={listing.images?.[0] || 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600'}
            alt={listing.title}
            className="w-full h-96 object-cover rounded-2xl"
          />
          <div className="mt-6">
            <h1 className="text-3xl font-bold">{listing.title}</h1>
            <p className="text-2xl font-semibold text-primary-600 mt-2">{formatPrice(listing.price)}</p>
            <div className="flex gap-4 mt-4 text-sm text-gray-500">
              <span>{listing.rooms} комнаты</span>
              <span>{listing.area} м²</span>
              <span>{listing.floor} этаж</span>
            </div>
            <p className="mt-4 text-gray-700 dark:text-gray-300">{listing.description || 'Описание отсутствует'}</p>
            <div className="mt-6 flex gap-4">
              <button className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full">Связаться с агентом</button>
              <button className="px-6 py-2 border border-primary-600 text-primary-600 rounded-full">Видеопоказ</button>
            </div>
          </div>
        </div>
        <div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
            <h3 className="font-bold mb-2">Связь с агентом</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Оставьте заявку, и мы перезвоним</p>
            <button className="w-full bg-primary-600 text-white py-2 rounded-full">Позвонить</button>
          </div>
        </div>
      </div>
      <AIChat />
    </div>
  )
}
