import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useFilterStore } from '@/store/filterStore'
import { ListingCard } from '@/components/Listings/ListingCard'
import { ListingFilters } from '@/components/Listings/ListingFilters'
import { SkeletonCard } from '@/components/UI/Skeleton'
import { EmptyState } from '@/components/UI/EmptyState'
import { Home, MapPin } from 'lucide-react'
import api from '@/lib/api'

gsap.registerPlugin(ScrollTrigger)

export default function MarketPage() {
  const { filters } = useFilterStore()
  const [view, setView] = useState<'grid' | 'map'>('grid')
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.fromTo(headerRef.current, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, scrollTrigger: { trigger: headerRef.current, start: 'top 90%' } })
  }, [])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery({
    queryKey: ['listings', filters],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: pageParam, ...filters })
      const { data } = await api.get(`/listings?${params}`)
      return data
    },
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  })

  const listings = data?.pages.flatMap(p => p.data) || []
  const isEmpty = !isLoading && listings.length === 0

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <EmptyState title="Ошибка загрузки" description="Не удалось загрузить объявления. Попробуйте позже." icon={<Home className="w-12 h-12" />} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
      <div ref={headerRef} className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Маркет недвижимости</h1>
        <div className="flex gap-2">
          <button onClick={() => setView('grid')} className={`px-4 py-2 rounded-full text-sm transition-all ${view === 'grid' ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Сетка</button>
          <button onClick={() => setView('map')} className={`px-4 py-2 rounded-full text-sm transition-all ${view === 'map' ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Карта</button>
        </div>
      </div>
      <ListingFilters />
      <AnimatePresence mode="wait">
        {view === 'grid' ? (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {isLoading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div>}
            {isEmpty && <EmptyState title="Ничего не найдено" description="Попробуйте изменить параметры фильтрации" icon={<Home className="w-12 h-12" />} />}
            {!isEmpty && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {listings.map((listing: any, idx: number) => <ListingCard key={listing.id} listing={listing} index={idx} />)}
                </div>
                {hasNextPage && (
                  <div className="flex justify-center mt-8">
                    <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="px-6 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50">
                      {isFetchingNextPage ? 'Загрузка...' : 'Загрузить ещё'}
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-96 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
            <div className="text-center"><MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" /><p className="text-gray-500">Карта загружается...</p></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
