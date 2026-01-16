'use client'

import { useEffect, useState, useCallback } from 'react'

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
  type: 'confetti' | 'star' | 'emoji'
  emoji?: string
  opacity: number
}

interface ConfettiProps {
  trigger: number // Increment to trigger confetti
  intensity?: 'small' | 'medium' | 'big' | 'epic'
  emoji?: string // Optional emoji to include
  originX?: number // 0-100 percentage
  originY?: number // 0-100 percentage
}

const COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bd6',
  '#c9b1ff', '#ffb347', '#87ceeb', '#98d8c8', '#f7dc6f'
]

const EMOJIS = ['⭐', '🌟', '✨', '💫', '🎉', '🎊', '👏', '🙌', '💪', '🔥']

export default function Confetti({ trigger, intensity = 'medium', emoji, originX = 50, originY = 50 }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([])

  const createParticles = useCallback(() => {
    const counts = {
      small: { confetti: 15, stars: 3, emojis: 1 },
      medium: { confetti: 30, stars: 5, emojis: 2 },
      big: { confetti: 50, stars: 10, emojis: 4 },
      epic: { confetti: 100, stars: 20, emojis: 8 }
    }

    const count = counts[intensity]
    const newParticles: Particle[] = []
    let id = 0

    // Confetti pieces
    for (let i = 0; i < count.confetti; i++) {
      const angle = (Math.random() * Math.PI * 2)
      const speed = 3 + Math.random() * 8
      newParticles.push({
        id: id++,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * (0.5 + Math.random()),
        vy: Math.sin(angle) * speed * (0.5 + Math.random()) - 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
        type: 'confetti',
        opacity: 1
      })
    }

    // Stars
    for (let i = 0; i < count.stars; i++) {
      const angle = (Math.random() * Math.PI * 2)
      const speed = 2 + Math.random() * 6
      newParticles.push({
        id: id++,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: ['#ffd700', '#ffec8b', '#fff8dc'][Math.floor(Math.random() * 3)],
        size: 12 + Math.random() * 12,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        type: 'star',
        opacity: 1
      })
    }

    // Emojis
    const emojisToUse = emoji ? [emoji, ...EMOJIS.slice(0, 3)] : EMOJIS
    for (let i = 0; i < count.emojis; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
      const speed = 4 + Math.random() * 4
      newParticles.push({
        id: id++,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color: '',
        size: 24 + Math.random() * 16,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 10,
        type: 'emoji',
        emoji: emojisToUse[Math.floor(Math.random() * emojisToUse.length)],
        opacity: 1
      })
    }

    setParticles(newParticles)
  }, [intensity, emoji, originX, originY])

  useEffect(() => {
    if (trigger > 0) {
      createParticles()
    }
  }, [trigger, createParticles])

  useEffect(() => {
    if (particles.length === 0) return

    const interval = setInterval(() => {
      setParticles(prev => {
        const updated = prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.3, // gravity
          vx: p.vx * 0.99, // air resistance
          rotation: p.rotation + p.rotationSpeed,
          opacity: p.opacity - 0.015
        })).filter(p => p.opacity > 0 && p.y < 150)

        return updated
      })
    }, 16)

    return () => clearInterval(interval)
  }, [particles.length])

  if (particles.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute transition-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
            opacity: p.opacity,
            fontSize: p.type === 'emoji' ? `${p.size}px` : undefined
          }}
        >
          {p.type === 'confetti' && (
            <div
              style={{
                width: p.size,
                height: p.size * 0.6,
                backgroundColor: p.color,
                borderRadius: '2px'
              }}
            />
          )}
          {p.type === 'star' && (
            <svg width={p.size} height={p.size} viewBox="0 0 24 24" fill={p.color}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          )}
          {p.type === 'emoji' && p.emoji}
        </div>
      ))}
    </div>
  )
}

// Hook for easy confetti triggering
export function useConfetti() {
  const [trigger, setTrigger] = useState(0)
  const [config, setConfig] = useState<Omit<ConfettiProps, 'trigger'>>({})

  const fire = useCallback((options?: Omit<ConfettiProps, 'trigger'>) => {
    if (options) setConfig(options)
    setTrigger(t => t + 1)
  }, [])

  return { trigger, config, fire }
}
