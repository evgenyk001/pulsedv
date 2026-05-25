import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import { Layout } from '@/components/Layout/Layout'
import HomePage from '@/pages/HomePage'
import MarketPage from '@/pages/MarketPage'
import ListingDetailPage from '@/pages/ListingDetailPage'
import FavoritesPage from '@/pages/FavoritesPage'
import ComparisonPage from '@/pages/ComparisonPage'
import NewbuildingsPage from '@/pages/NewbuildingsPage'
import ProfilePage from '@/pages/ProfilePage'
import AdminPage from '@/pages/AdminPage'
import { AIChat } from '@/components/Chat/AIChat'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/listing/:id" element={<ListingDetailPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/compare" element={<ComparisonPage />} />
              <Route path="/newbuildings" element={<NewbuildingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<div className="pt-24 text-center">404</div>} />
            </Routes>
          </AnimatePresence>
        </Layout>
        <AIChat />
        <Toaster position="bottom-right" toastOptions={{ duration: 3000 }} />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
