import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Bot, Phone } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export const AIChat = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPhoneInput, setShowPhoneInput] = useState(false)
  const [phone, setPhone] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return
    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const { data } = await api.post('/ai/ask', { message: input })
      const assistantMessage = { role: 'assistant', content: data.reply }
      setMessages(prev => [...prev, assistantMessage])
      if (data.requiresPhone) {
        setShowPhoneInput(true)
        toast('Оставьте ваш номер телефона для связи с агентом', { icon: '📞' })
      }
    } catch (error) {
      toast.error('Ошибка AI')
    } finally {
      setLoading(false)
    }
  }

  const submitPhone = async () => {
    if (!phone.trim()) return
    try {
      await api.post('/ai/submit-phone', { phone, sessionId: Date.now().toString() })
      toast.success('Спасибо! Агент свяжется с вами в ближайшее время')
      setShowPhoneInput(false)
      setPhone('')
    } catch {
      toast.error('Ошибка')
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all hover:scale-105 active:scale-95"
      >
        <Bot className="w-6 h-6" />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-50 w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="bg-primary-600 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <span className="font-semibold">AI-ассистент Pulse.DV</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-primary-700 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-800">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                  Задайте вопрос о недвижимости, и я помогу подобрать варианты
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-2xl rounded-bl-none shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
              {showPhoneInput && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (999) 000-00-00"
                    className="flex-1 px-3 py-2 rounded-full border text-sm"
                  />
                  <button onClick={submitPhone} className="p-2 bg-primary-600 text-white rounded-full">
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2 bg-white dark:bg-gray-900">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Спросите про квартиры..."
                className="flex-1 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
              <button onClick={sendMessage} disabled={loading} className="p-2 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
