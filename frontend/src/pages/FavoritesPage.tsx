import { useFavoriteStore } from '@/store/favoriteStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ListingCard } from '@/components/Listings/ListingCard'
import { EmptyState } from '@/components/UI/EmptyState'
import { Heart } from 'lucide-react'

export default function FavoritesPage() {
  const { favorites } = useFavoriteStore()
  const { data: allListings, isLoading } = useQuery({
    queryKey: ['listings'],
    queryFn: async () => {
      const { data } = await api.get('/listings?limit=100')
      return data.data
    },
  })

  const favoriteListings = allListings?.filter((l: any) => favorites.includes(l.id)) || []

  if (isLoading) return <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">Загрузка...</div>

  if (favoriteListings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <EmptyState
          title="Избранное пусто"
          description="Добавляйте понравившиеся объекты, нажимая сердечко на карточке"
          icon={<Heart className="w-12 h-12" />}
          actionLabel="Перейти в маркет"
          onAction={() => window.location.href = '/market'}
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
      <h1 className="text-3xl font-bold mb-8">❤️ Избранное</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {favoriteListings.map((listing: any, idx: number) => (
          <ListingCard key={listing.id} listing={listing} index={idx} />
        ))}
      </div>
    </div>
  )
}
