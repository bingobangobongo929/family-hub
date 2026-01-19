'use client'

import { ReactNode, useRef, useState, useCallback } from 'react'
import { hapticTap, hapticSuccess } from '@/lib/haptics'

interface SwipeAction {
  id: string
  icon: ReactNode
  label: string
  color: string
  bgColor: string
  onAction: () => void
}

interface SwipeableItemProps {
  children: ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  /** Threshold percentage to trigger action (0-1) */
  threshold?: number
  /** Called when swipe completes without triggering action */
  onSwipeComplete?: () => void
  className?: string
  disabled?: boolean
}

export default function SwipeableItem({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 0.35,
  onSwipeComplete,
  className = '',
  disabled = false,
}: SwipeableItemProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [triggeredAction, setTriggeredAction] = useState<string | null>(null)

  const maxLeftOffset = leftActions.length > 0 ? 80 * leftActions.length : 0
  const maxRightOffset = rightActions.length > 0 ? 80 * rightActions.length : 0

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isAnimating) return
    startX.current = e.touches[0].clientX
    currentX.current = startX.current
    setIsDragging(true)
  }, [disabled, isAnimating])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled) return

    currentX.current = e.touches[0].clientX
    const diff = currentX.current - startX.current

    // Calculate bounded offset
    let newOffset = diff

    // Limit swipe distance with resistance at edges
    if (leftActions.length === 0 && diff > 0) {
      newOffset = diff * 0.2 // Resistance when no left actions
    } else if (rightActions.length === 0 && diff < 0) {
      newOffset = diff * 0.2 // Resistance when no right actions
    } else if (diff > maxLeftOffset) {
      // Add resistance beyond max
      newOffset = maxLeftOffset + (diff - maxLeftOffset) * 0.2
    } else if (diff < -maxRightOffset) {
      // Add resistance beyond max
      newOffset = -maxRightOffset + (diff + maxRightOffset) * 0.2
    }

    setOffset(newOffset)

    // Check if threshold crossed
    const containerWidth = containerRef.current?.clientWidth || 300
    const percentSwipe = Math.abs(newOffset) / containerWidth

    if (percentSwipe >= threshold) {
      const action = newOffset > 0 ? leftActions[0] : rightActions[0]
      if (action && triggeredAction !== action.id) {
        setTriggeredAction(action.id)
        hapticTap()
      }
    } else {
      setTriggeredAction(null)
    }
  }, [isDragging, disabled, leftActions, rightActions, maxLeftOffset, maxRightOffset, threshold, triggeredAction])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const containerWidth = containerRef.current?.clientWidth || 300
    const percentSwipe = Math.abs(offset) / containerWidth

    if (percentSwipe >= threshold && triggeredAction) {
      // Trigger action
      setIsAnimating(true)
      const action = offset > 0
        ? leftActions.find(a => a.id === triggeredAction)
        : rightActions.find(a => a.id === triggeredAction)

      if (action) {
        // Animate out
        const direction = offset > 0 ? 1 : -1
        setOffset(direction * (containerWidth + 20))
        hapticSuccess()

        setTimeout(() => {
          action.onAction()
          // Reset after action
          setTimeout(() => {
            setOffset(0)
            setIsAnimating(false)
            setTriggeredAction(null)
          }, 100)
        }, 200)
      }
    } else {
      // Snap back
      setIsAnimating(true)
      setOffset(0)
      setTriggeredAction(null)
      onSwipeComplete?.()
      setTimeout(() => setIsAnimating(false), 300)
    }
  }, [isDragging, offset, threshold, triggeredAction, leftActions, rightActions, onSwipeComplete])

  // Mouse support for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || isAnimating) return
    startX.current = e.clientX
    currentX.current = startX.current
    setIsDragging(true)

    const handleMouseMove = (e: MouseEvent) => {
      currentX.current = e.clientX
      const diff = currentX.current - startX.current

      let newOffset = diff
      if (leftActions.length === 0 && diff > 0) {
        newOffset = diff * 0.2
      } else if (rightActions.length === 0 && diff < 0) {
        newOffset = diff * 0.2
      } else if (diff > maxLeftOffset) {
        newOffset = maxLeftOffset + (diff - maxLeftOffset) * 0.2
      } else if (diff < -maxRightOffset) {
        newOffset = -maxRightOffset + (diff + maxRightOffset) * 0.2
      }

      setOffset(newOffset)

      const containerWidth = containerRef.current?.clientWidth || 300
      const percentSwipe = Math.abs(newOffset) / containerWidth

      if (percentSwipe >= threshold) {
        const action = newOffset > 0 ? leftActions[0] : rightActions[0]
        if (action) {
          setTriggeredAction(action.id)
        }
      } else {
        setTriggeredAction(null)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      const containerWidth = containerRef.current?.clientWidth || 300
      const percentSwipe = Math.abs(offset) / containerWidth

      if (percentSwipe >= threshold && triggeredAction) {
        setIsAnimating(true)
        const action = offset > 0
          ? leftActions.find(a => a.id === triggeredAction)
          : rightActions.find(a => a.id === triggeredAction)

        if (action) {
          const direction = offset > 0 ? 1 : -1
          setOffset(direction * (containerWidth + 20))
          hapticSuccess()

          setTimeout(() => {
            action.onAction()
            setTimeout(() => {
              setOffset(0)
              setIsAnimating(false)
              setTriggeredAction(null)
            }, 100)
          }, 200)
        }
      } else {
        setIsAnimating(true)
        setOffset(0)
        setTriggeredAction(null)
        setTimeout(() => setIsAnimating(false), 300)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [disabled, isAnimating, leftActions, rightActions, maxLeftOffset, maxRightOffset, threshold, offset, triggeredAction])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Left action buttons */}
      {leftActions.length > 0 && (
        <div
          className="absolute inset-y-0 left-0 flex items-stretch"
          style={{ width: maxLeftOffset }}
        >
          {leftActions.map((action, index) => (
            <div
              key={action.id}
              className={`flex items-center justify-center transition-all duration-200 ${action.bgColor}`}
              style={{
                width: 80,
                opacity: Math.min(1, offset / (80 * (index + 1))),
                transform: `scale(${triggeredAction === action.id ? 1.1 : 1})`,
              }}
            >
              <div className={`flex flex-col items-center gap-1 ${action.color}`}>
                {action.icon}
                <span className="text-xs font-medium">{action.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Right action buttons */}
      {rightActions.length > 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{ width: maxRightOffset }}
        >
          {rightActions.map((action, index) => (
            <div
              key={action.id}
              className={`flex items-center justify-center transition-all duration-200 ${action.bgColor}`}
              style={{
                width: 80,
                opacity: Math.min(1, Math.abs(offset) / (80 * (index + 1))),
                transform: `scale(${triggeredAction === action.id ? 1.1 : 1})`,
              }}
            >
              <div className={`flex flex-col items-center gap-1 ${action.color}`}>
                {action.icon}
                <span className="text-xs font-medium">{action.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div
        className={`relative bg-white dark:bg-slate-800 ${isAnimating ? 'transition-transform duration-300 ease-out' : ''} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          transform: `translateX(${offset}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>
    </div>
  )
}
