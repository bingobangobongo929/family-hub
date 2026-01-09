import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export default function Card({ children, className = '', hover = true }: CardProps) {
  return (
    <div className={`glass rounded-2xl p-6 ${hover ? 'card-hover' : ''} ${className}`}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  icon?: ReactNode
  action?: ReactNode
}

export function CardHeader({ title, icon, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white">
            {icon}
          </div>
        )}
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      </div>
      {action}
    </div>
  )
}
