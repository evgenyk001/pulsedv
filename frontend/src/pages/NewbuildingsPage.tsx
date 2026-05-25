import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

const newbuildings = [
  { id: 'nb1', name: 'ЖК «Морской фасад»', priceFrom: 6200000, location: 'Владивосток, ул. Корабельная', image: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=600', description: 'Вид на море, закрытая территория' },
  { id: 'nb2', name: 'ЖК «Золотой мост»', priceFrom: 8900000, location: 'Владивосток, центр', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600', description: 'Современные планировки' },
  { id: 'nb3', name: 'Квартал «Зелёный»', priceFrom: 4500000, location: 'Артём, ул. Солнечная', image: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=600', description: 'Эко-район' },
]

export default function NewbuildingsPage() {
  const handleMortgage = (name: string) => {
    toast.success(`Заявка на ипотеку в ${name} отправлена. Мы свяжемся с вами.`)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
      <h1 className="text-3xl font-bold mb-4">🏗️ Новостройки Приморского края</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Прямой партнёр застройщиков. Акции, рассрочка, ипотека от 0.1%</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {newbuildings.map((nb, idx) => (
          <motion.div
            key={nb.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition"
          >
            <img src={nb.image} alt={nb.name} className="h-48 w-full object-cover" />
            <div className="p-5">
              <h2 className="text-xl font-bold">{nb.name}</h2>
              <p className="text-gray-500 text-sm">{nb.location}</p>
              <p className="text-2xl font-bold text-primary-600 mt-2">от {nb.priceFrom.toLocaleString()} ₽</p>
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-2">{nb.description}</p>
              <button
                onClick={() => handleMortgage(nb.name)}
                className="mt-4 w-full bg-black dark:bg-white text-white dark:text-black py-2 rounded-full font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition"
              >
                Рассчитать ипотеку
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
