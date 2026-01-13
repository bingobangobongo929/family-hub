'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Image, ChevronLeft, ChevronRight, Pause, Play, Settings, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useSettings } from '@/lib/settings-context'
import { useWidgetSize } from '@/lib/useWidgetSize'

interface Photo {
  id: string
  baseUrl: string
  width: number
  height: number
  creationTime?: string
  description?: string
}

// Demo photos (placeholder gradients when not connected)
const DEMO_PHOTOS = [
  { id: '1', gradient: 'from-rose-400 to-pink-500', caption: 'Family day out' },
  { id: '2', gradient: 'from-amber-400 to-orange-500', caption: 'Beach holiday' },
  { id: '3', gradient: 'from-emerald-400 to-teal-500', caption: 'Garden fun' },
  { id: '4', gradient: 'from-blue-400 to-indigo-500', caption: 'Birthday party' },
  { id: '5', gradient: 'from-purple-400 to-pink-500', caption: 'Christmas morning' },
]

export default function GooglePhotosWidget() {
  const { user } = useAuth()
  const { googlePhotosAlbumId, googlePhotosAlbumTitle, googlePhotosRotationInterval } = useSettings()
  const [ref, { size }] = useWidgetSize()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [demoIndex, setDemoIndex] = useState(0)

  const lastFetchRef = useRef<number>(0)
  const REFRESH_INTERVAL = 50 * 60 * 1000 // 50 minutes (baseUrl expires after ~1 hour)

  // Fetch photos from Google Photos API
  const fetchPhotos = useCallback(async () => {
    if (!user || !googlePhotosAlbumId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/google-photos/photos?user_id=${user.id}&album_id=${googlePhotosAlbumId}&page_size=50`
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch photos')
      }

      const data = await response.json()
      setPhotos(data.photos || [])
      lastFetchRef.current = Date.now()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos')
    } finally {
      setIsLoading(false)
    }
  }, [user, googlePhotosAlbumId])

  // Initial fetch and refresh on album change
  useEffect(() => {
    if (user && googlePhotosAlbumId) {
      fetchPhotos()
    }
  }, [user, googlePhotosAlbumId, fetchPhotos])

  // Refresh baseUrls before they expire
  useEffect(() => {
    if (!user || !googlePhotosAlbumId || photos.length === 0) return

    const checkAndRefresh = () => {
      const timeSinceLastFetch = Date.now() - lastFetchRef.current
      if (timeSinceLastFetch >= REFRESH_INTERVAL) {
        fetchPhotos()
      }
    }

    const interval = setInterval(checkAndRefresh, 60 * 1000) // Check every minute
    return () => clearInterval(interval)
  }, [user, googlePhotosAlbumId, photos.length, fetchPhotos])

  // Auto-advance slideshow
  useEffect(() => {
    if (!isPlaying) return

    const interval = googlePhotosRotationInterval * 1000
    const timer = setInterval(() => {
      if (photos.length > 0) {
        setCurrentIndex(prev => (prev + 1) % photos.length)
      } else {
        setDemoIndex(prev => (prev + 1) % DEMO_PHOTOS.length)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [isPlaying, googlePhotosRotationInterval, photos.length])

  const next = () => {
    if (photos.length > 0) {
      setCurrentIndex((currentIndex + 1) % photos.length)
    } else {
      setDemoIndex((demoIndex + 1) % DEMO_PHOTOS.length)
    }
  }

  const prev = () => {
    if (photos.length > 0) {
      setCurrentIndex((currentIndex - 1 + photos.length) % photos.length)
    } else {
      setDemoIndex((demoIndex - 1 + DEMO_PHOTOS.length) % DEMO_PHOTOS.length)
    }
  }

  const isConnected = user && googlePhotosAlbumId && photos.length > 0
  const showControls = size !== 'small'
  const showDots = photos.length <= 10 || size !== 'small'
  const currentPhoto = photos[currentIndex]
  const currentDemo = DEMO_PHOTOS[demoIndex]

  // Get photo URL with size parameters
  const getPhotoUrl = (photo: Photo, maxWidth: number = 800) => {
    // Google Photos baseUrl can have size parameters appended
    return `${photo.baseUrl}=w${maxWidth}-h${maxWidth}`
  }

  return (
    <div
      ref={ref}
      className="h-full flex flex-col rounded-3xl overflow-hidden relative group shadow-widget dark:shadow-widget-dark"
    >
      {/* Loading state */}
      {isLoading && photos.length === 0 && (
        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && photos.length === 0 && !isLoading && (
        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center p-4">
          <Image className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500 text-center">{error}</p>
          <button
            onClick={fetchPhotos}
            className="mt-2 text-xs text-sage-600 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Connected - Show actual photos */}
      {isConnected && currentPhoto && (
        <>
          <div className="absolute inset-0">
            <img
              src={getPhotoUrl(currentPhoto)}
              alt={currentPhoto.description || 'Family photo'}
              className="w-full h-full object-cover transition-opacity duration-500"
            />
          </div>

          {/* Album title / caption */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-white text-sm font-display font-medium truncate">
              {googlePhotosAlbumTitle || 'Photos'}
            </p>
            {photos.length > 1 && (
              <p className="text-white/70 text-xs">
                {currentIndex + 1} of {photos.length}
              </p>
            )}
          </div>
        </>
      )}

      {/* Not connected - Show demo/placeholder */}
      {!isConnected && !isLoading && !error && (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br ${currentDemo.gradient} transition-all duration-500`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Image className="w-16 h-16 text-white/30" />
            </div>
          </div>

          {/* Prompt to connect */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            {!user ? (
              <p className="text-white text-sm font-display font-medium">Sign in for photos</p>
            ) : !googlePhotosAlbumId ? (
              <Link href="/settings" className="text-white text-sm font-display font-medium hover:underline flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" />
                Connect Google Photos
              </Link>
            ) : (
              <p className="text-white text-sm font-display font-medium">{currentDemo.caption}</p>
            )}
          </div>

          {/* Demo dots */}
          {showDots && (
            <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1">
              {DEMO_PHOTOS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setDemoIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === demoIndex ? 'bg-white' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Navigation controls - show on hover */}
      {showControls && (photos.length > 1 || !isConnected) && (
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
      )}

      {/* Play/Pause control */}
      {showControls && (
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="absolute top-2 right-2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      )}

      {/* Photo dots indicator */}
      {isConnected && showDots && photos.length > 1 && photos.length <= 10 && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentIndex ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}

      {/* Gallery link */}
      {isConnected && (
        <Link
          href="/gallery"
          className="absolute top-2 left-2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Image className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}
