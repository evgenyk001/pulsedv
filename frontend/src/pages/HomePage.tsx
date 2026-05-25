import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Sparkles, Shield, Clock } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from '@studio-freight/lenis'
import api from '@/lib/api'
import { ListingCard } from '@/components/Listings/ListingCard'
import { SkeletonCard } from '@/components/UI/Skeleton'
import { Scene3D } from '@/3d/Scene'

gsap.registerPlugin(ScrollTrigger)

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const listingsRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95])
  const featuresY = useTransform(scrollYProgress, [0.2, 0.5], [100, 0])
  const featuresOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1])

  const { data: listings, isLoading } = useQuery({
    queryKey: ['featured-listings'],
    queryFn: async () => {
      const { data } = await api.get('/listings?limit=4')
      return data.data
    },
  })

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)

    const ctx = gsap.context(() => {
      gsap.fromTo(
        heroRef.current,
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, scrollTrigger: { trigger: heroRef.current, start: 'top 80%' } }
      )
      gsap.fromTo(
        featuresRef.current?.children,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.2, duration: 0.8, scrollTrigger: { trigger: featuresRef.current, start: 'top 70%' } }
      )
      gsap.fromTo(
        listingsRef.current,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, scrollTrigger: { trigger: listingsRef.current, start: 'top 80%' } }
      )
    })

    return () => {
      ctx.revert()
      lenis.destroy()
    }
  }, [])

  const features = [
    { icon: Sparkles, title: 'Проверенные объекты', desc: 'Только реальные предложения от собственников и застройщиков' },
    { icon: Shield, title: 'Юридическая защита', desc: 'Полное сопровождение сделки на всех этапах' },
    { icon: Clock, title: 'Быстрый подбор', desc: 'Найдём идеальный вариант за 24 часа' },
  ]

  return (
    <>
      <Scene3D />
      <div ref={containerRef} className="relative z-10">
        <motion.div
          ref={heroRef}
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative h-screen flex items-center justify-center text-center px-6"
        >
          <div className="max-w-4xl mx-auto">
            <motion.h1
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-6xl md:text-8xl font-bold text-white leading-tight"
            >
              Живи в ритме <span className="text-primary-500">будущего</span>
            </motion.h1>
            <motion.p
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl text-white/80 mt-6 max-w-2xl mx-auto"
            >
              Эксклюзивные квартиры, новостройки, ипотека под ключ
            </motion.p>
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-10"
            >
              <Link
                to="/market"
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-full font-medium transition-all shadow-lg hover:shadow-xl"
              >
                Начать поиск <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          ref={featuresRef}
          style={{ y: featuresY, opacity: featuresOpacity }}
          className="py-24 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm"
        >
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center p-6 rounded-2xl bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition"
                >
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <div ref={listingsRef} className="py-20 bg-white dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">🔥 Актуальные предложения</h2>
              <Link to="/market" className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 transition">
                Все объявления <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {isLoading
                ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
                : listings?.map((listing: any, idx: number) => <ListingCard key={listing.id} listing={listing} index={idx} />)
              }
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
