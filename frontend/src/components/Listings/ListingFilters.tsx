import { useState, useEffect } from 'react'
import { useFilterStore } from '@/store/filterStore'
import { useDebounce } from '@/hooks/useDebounce'
import { motion, AnimatePresence } from 'framer-motion'
import { SlidersHorizontal, X } from 'lucide-react'

export const ListingFilters = () => {
  const { filters, setFilters, resetFilters } = useFilterStore()
  const [local, setLocal] = useState(filters)
  const [isOpen, setIsOpen] = useState(false)
  const debounced = useDebounce(local, 300)

  useEffect(() => {
    setFilters(debounced)
  }, [debounced, setFilters])

  const handleChange = (key: string, value: any) => {
    setLocal(prev => ({ ...prev, [key]: value || undefined }))
  }

  const activeFiltersCount = Object.keys(filters).length

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition group"
      >
        <SlidersHorizontal className="w-4 h-4 group-hover:rotate-12 transition-transform" />
        Фильтры
        {activeFiltersCount > 0 && (
          <span className="w-2 h-2 bg-primary-600 rounded-full animate-pulse" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="mt-4 p-5 bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Уточнить параметры</h3>
              <button onClick={resetFilters} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Сбросить
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Цена до (₽)</label>
                <input
                  type="number"
                  value={local.maxPrice || ''}
                  onChange={(e) => handleChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Любая"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Комнат</label>
                <select
                  value={local.rooms || ''}
                  onChange={(e) => handleChange('rooms', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Любое</option>
                  {[1, 2, 3, 4, 5].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Площадь (м²)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="от"
                    value={local.areaMin || ''}
                    onChange={(e) => handleChange('areaMin', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-1/2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="до"
                    value={local.areaMax || ''}
                    onChange={(e) => handleChange('areaMax', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-1/2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Район</label>
                <input
                  type="text"
                  value={local.district || ''}
                  onChange={(e) => handleChange('district', e.target.value)}
                  placeholder="Например, Центральный"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
