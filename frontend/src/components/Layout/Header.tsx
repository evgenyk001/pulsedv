import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Sun, Moon, Heart, GitCompare, Home, Building2, Star } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useFavoriteStore } from '@/store/favoriteStore'
import { useComparisonStore } from '@/store/comparisonStore'
import { useUIStore } from '@/store/uiStore'

export const Header = () => {
  const { user, logout } = useAuthStore()
  const { favorites } = useFavoriteStore()
  const { compareIds } = useComparisonStore()
  const { darkMode, toggleDarkMode, mobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useUIStore()
  const location = useLocation()
  const [scrolled, setScrolled] = React.useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const navItems = [
    { path: '/', label: 'Главная', icon: Home },
    { path: '/market', label: 'Маркет', icon: Building2 },
    { path: '/newbuildings', label: 'Новостройки', icon: Star },
    { path: '/favorites', label: `Избранное ${favorites.length ? `(${favorites.length})` : ''}`, icon: Heart },
    { path: '/compare', label: `Сравнение ${compareIds.length ? `(${compareIds.length})` : ''}`, icon: GitCompare },
  ]

  return (
    <header className={`glass fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'py-2 shadow-sm' : 'py-4'}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold tracking-tight">
          PULSE<span className="text-primary-600">.DV</span>
        </Link>
        <nav className="hidden md:flex gap-8">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-medium transition-colors hover:text-primary-600 ${
                location.pathname === item.path ? 'text-primary-600' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-3 items-center">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {user ? (
            <div className="flex gap-2 items-center">
              <Link to="/profile" className="text-sm font-medium hidden md:block">Профиль</Link>
              <button
                onClick={logout}
                className="px-4 py-2 rounded-full bg-primary-600 text-white text-sm hover:bg-primary-700 transition"
              >
                Выйти
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Войти
            </Link>
          )}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="md:hidden absolute top-full left-0 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg p-4 flex flex-col gap-3"
          >
            {navItems.map(item => (
              <Link key={item.path} to={item.path} onClick={closeMobileMenu} className="py-2 text-gray-700 dark:text-gray-300">
                {item.label}
              </Link>
            ))}
            {user && <Link to="/profile" onClick={closeMobileMenu} className="py-2">Профиль</Link>}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
