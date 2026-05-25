import { useComparisonStore } from '@/store/comparisonStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { Trash2, GitCompare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/UI/EmptyState'

export default function ComparisonPage() {
  const { compareIds, removeFromCompare, clearCompare } = useComparisonStore()
  const { data: allListings } = useQuery({
    queryKey: ['listings'],
    queryFn: async () => {
      const { data } = await api.get('/listings?limit=100')
      return data.data
    },
  })

  const compareListings = allListings?.filter((l: any) => compareIds.includes(l.id)) || []

  if (compareListings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <EmptyState
          title="Нет объектов для сравнения"
          description="Добавьте объекты из маркета, нажав кнопку сравнения"
          icon={<GitCompare className="w-12 h-12" />}
          actionLabel="Перейти в маркет"
          onAction={() => window.location.href = '/market'}
        />
      </div>
    )
  }

  const features = ['Цена', 'Комнат', 'Площадь (м²)', 'Этаж', 'Адрес', 'Комиссия', 'Сопровождение']

  const getValue = (listing: any, feature: string) => {
    switch (feature) {
      case 'Цена': return formatPrice(listing.price)
      case 'Комнат': return listing.rooms
      case 'Площадь (м²)': return listing.area
      case 'Этаж': return listing.floor
      case 'Адрес': return listing.address
      case 'Комиссия': return listing.commission || '—'
      case 'Сопровождение': return listing.hasService === 'yes' ? 'Есть' : 'Нет'
      default: return ''
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Сравнение объектов</h1>
        <button onClick={clearCompare} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
          <Trash2 className="w-4 h-4" /> Очистить всё
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white dark:bg-gray-900 rounded-2xl shadow-md">
          <thead>
            <tr className="border-b dark:border-gray-800">
              <th className="p-4 text-left">Характеристика</th>
              {compareListings.map((l: any) => (
                <th key={l.id} className="p-4 text-left min-w-[200px]">
                  <div className="flex justify-between items-center">
                    <span>{l.title}</span>
                    <button onClick={() => removeFromCompare(l.id)} className="text-gray-400 hover:text-red-600 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <tr key={feature} className="border-b dark:border-gray-800">
                <td className="p-4 font-medium bg-gray-50 dark:bg-gray-800/50">{feature}</td>
                {compareListings.map((l: any) => (
                  <td key={l.id} className="p-4">{getValue(l, feature)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
