import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavoriteState {
  favorites: string[]
  toggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
}

export const useFavoriteStore = create<FavoriteState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (id) => {
        const isFav = get().favorites.includes(id)
        set({ favorites: isFav ? get().favorites.filter(i => i !== id) : [...get().favorites, id] })
      },
      isFavorite: (id) => get().favorites.includes(id),
    }),
    { name: 'favorite-storage' }
  )
)
