import { Link } from 'react-router-dom'
import { Heart, GitCompare } from 'lucide-react'
import { motion } from 'framer-motion'
import { useFavoriteStore } from '@/store/favoriteStore'
import { useComparisonStore } from '@/store/comparisonStore'
import { formatPrice } from '@/lib/utils'
import { useState } from 'react'

interface Listing {
  id: string
  title: string
  price: number
  rooms: number
  area: number
  floor: number
  images?: string[]
}

interface ListingCardProps {
  listing: Listing
  index?: number
}

export const ListingCard = ({ listing, index = 0 }: ListingCardProps) => {
  const { toggleFavorite, isFavorite } = useFavoriteStore()
  const { addToCompare, removeFromCompare, isInCompare } = useComparisonStore()
  const [currentImage, setCurrentImage] = useState(0)
  const images = listing.images?.length ? listing.images : ['https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600']

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault()
    setCurrentImage((prev) => (prev + 1) % images.length)
  }
  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault()
    setCurrentImage((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="card-hover bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md group"
    >
      <div className="relative h-56">
        <img src={images[currentImage]} alt={listing.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
        {images.length > 1 && (
          <>
            <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">‹</button>
            <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">›</button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, idx: number) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentImage ? 'bg-white w-3' : 'bg-white/50'}`} />
              ))}
            </div>
          </>
        )}
        <button onClick={() => toggleFavorite(listing.id)} className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition">
          <Heart className={`w-5 h-5 ${isFavorite(listing.id) ? 'fill-red-600 text-red-600' : 'text-gray-700'}`} />
        </button>
        <button onClick={() => isInCompare(listing.id) ? removeFromCompare(listing.id) : addToCompare(listing.id)} className="absolute bottom-3 left-3 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition">
          <GitCompare className={`w-5 h-5 ${isInCompare(listing.id) ? 'text-red-600' : 'text-gray-700'}`} />
        </button>
      </div>
      <div className="p-4">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(listing.price)}</div>
        <div className="text-lg font-semibold mt-1 line-clamp-1">{listing.title}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400 flex gap-2 mt-2">
          <span>{listing.rooms} комн.</span>
          <span>{listing.area} м²</span>
          <span>{listing.floor} эт.</span>
        </div>
        <Link to={`/listing/${listing.id}`} className="mt-4 block text-center bg-black dark:bg-white text-white dark:text-black py-2 rounded-full text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition">
          Подробнее
        </Link>
      </div>
    </motion.div>
  )
}
