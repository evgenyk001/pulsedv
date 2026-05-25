import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ComparisonState {
  compareIds: string[]
  addToCompare: (id: string) => void
  removeFromCompare: (id: string) => void
  clearCompare: () => void
  isInCompare: (id: string) => boolean
}

export const useComparisonStore = create<ComparisonState>()(
  persist(
    (set, get) => ({
      compareIds: [],
      addToCompare: (id) => {
        if (get().compareIds.length < 4 && !get().compareIds.includes(id)) {
          set({ compareIds: [...get().compareIds, id] })
        }
      },
      removeFromCompare: (id) => set({ compareIds: get().compareIds.filter(i => i !== id) }),
      clearCompare: () => set({ compareIds: [] }),
      isInCompare: (id) => get().compareIds.includes(id),
    }),
    { name: 'comparison-storage' }
  )
)
