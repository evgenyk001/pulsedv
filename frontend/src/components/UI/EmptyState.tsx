import { motion } from 'framer-motion'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}

export const EmptyState = ({ title, description, icon, actionLabel, onAction }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-16 px-4"
  >
    {icon && <div className="w-16 h-16 mx-auto mb-4 text-gray-400">{icon}</div>}
    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
    {description && <p className="text-gray-500 dark:text-gray-400 mb-6">{description}</p>}
    {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
  </motion.div>
)
