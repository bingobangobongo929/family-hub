'use client'

import { useState, useEffect } from 'react'
import { Image, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'

// Demo photos (using placeholder gradients since we don't have actual photos)
const DEMO_PHOTOS = [
  { id: '1', gradient: 'from-rose-400 to-pink-500', caption: 'Family day out' },
  { id: '2', gradient: 'from-amber-400 to-orange-500', caption: 'Beach holiday' },
  { id: '3', gradient: 'from-emerald-400 to-teal-500', caption: 'Garden fun' },
  { id: '4', gradient: 'from-blue-400 to-indigo-500', caption: 'Birthday party' },
  { id: '5', gradient: 'from-purple-400 to-pink-500', caption: 'Christmas morning' },
]

export default function PhotoWidget({ autoPlay = true }: { autoPlay?: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)

  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % DEMO_PHOTOS.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [isPlaying])

  const current = DEMO_PHOTOS[currentIndex]

  const next = () => setCurrentIndex((currentIndex + 1) % DEMO_PHOTOS.length)
  const prev = () => setCurrentIndex((currentIndex - 1 + DEMO_PHOTOS.length) % DEMO_PHOTOS.length)

  return (
    <div className="h-full flex flex-col rounded-3xl overflow-hidden relative group shadow-widget dark:shadow-widget-dark">
      {/* Photo display (using gradient placeholder) */}
      <div className={`absolute inset-0 bg-gradient-to-br ${current.gradient} transition-all duration-500`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Image className="w-16 h-16 text-white/30" />
        </div>
      </div>

      {/* Caption */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
        <p className="text-white text-sm font-display font-medium">{current.caption}</p>
      </div>

      {/* Controls - show on hover */}
      <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={prev}
          className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={next}
          className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Play/Pause */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="absolute top-2 right-2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* Dots */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-1">
        {DEMO_PHOTOS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentIndex ? 'bg-white' : 'bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
