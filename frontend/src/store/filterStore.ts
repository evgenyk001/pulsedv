import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FilterState {
  filters: {
    minPrice?: number
    maxPrice?: number
    rooms?: number
    district?: string
    type?: string
    areaMin?: number
    areaMax?: number
  }
  setFilters: (filters: any) => void
  resetFilters: () => void
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      filters: {},
      setFilters: (filters) => set({ filters }),
      resetFilters: () => set({ filters: {} }),
    }),
    { name: 'filter-storage' }
  )
)
