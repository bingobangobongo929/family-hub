'use client'

import { ReactNode, ButtonHTMLAttributes } from 'react'
import { hapticTap } from '@/lib/haptics'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  loading?: boolean
  /** Disable haptic feedback */
  noHaptic?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading,
  disabled,
  className = '',
  noHaptic = false,
  onClick,
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] tap-highlight select-none motion-reduce:transition-none'

  const variantClasses = {
    primary:
      'bg-teal-500 hover:bg-teal-600 text-white shadow-sm hover:shadow-md active:bg-teal-700',
    secondary:
      'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 active:bg-slate-300 dark:active:bg-slate-500',
    danger:
      'bg-coral-500 hover:bg-coral-600 text-white shadow-sm hover:shadow-md active:bg-coral-700',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-700 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-600',
  }

  // Touch-friendly sizes (44px+ tap targets on all sizes)
  const sizeClasses = {
    sm: 'px-3 py-2.5 text-sm min-h-[44px]',
    md: 'px-4 py-3 text-sm min-h-[44px]',
    lg: 'px-6 py-3.5 text-base min-h-[48px]',
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading && !noHaptic) {
      hapticTap()
    }
    onClick?.(e)
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </button>
  )
}
