'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Image, Settings, Loader2, RefreshCw, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import Button from '@/components/ui/Button'
import PhotoLightbox from '@/components/PhotoLightbox'

interface Photo {
  id: string
  baseUrl: string
  width: number
  height: number
  creationTime?: string
  description?: string
}

export default function GalleryPage() {
  const { user } = useAuth()
  const { googlePhotosAlbumId, googlePhotosAlbumTitle } = useSettings()
  const { t } = useTranslation()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const lastFetchRef = useRef<number>(0)
  const REFRESH_INTERVAL = 50 * 60 * 1000 // 50 minutes

  // Fetch photos from Google Photos API
  const fetchPhotos = useCallback(async (append = false) => {
    if (!user || !googlePhotosAlbumId) return

    setIsLoading(true)
    setError(null)

    try {
      let url = `/api/google-photos/photos?user_id=${user.id}&album_id=${googlePhotosAlbumId}&page_size=50`
      if (append && nextPageToken) {
        url += `&page_token=${nextPageToken}`
      }

      const response = await fetch(url)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch photos')
      }

      const data = await response.json()

      if (append) {
        setPhotos(prev => [...prev, ...(data.photos || [])])
      } else {
        setPhotos(data.photos || [])
      }

      setNextPageToken(data.nextPageToken || null)
      lastFetchRef.current = Date.now()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos')
    } finally {
      setIsLoading(false)
    }
  }, [user, googlePhotosAlbumId, nextPageToken])

  // Initial fetch
  useEffect(() => {
    if (user && googlePhotosAlbumId) {
      fetchPhotos()
    }
  }, [user, googlePhotosAlbumId])

  // Refresh baseUrls before they expire
  useEffect(() => {
    if (!user || !googlePhotosAlbumId || photos.length === 0) return

    const checkAndRefresh = () => {
      const timeSinceLastFetch = Date.now() - lastFetchRef.current
      if (timeSinceLastFetch >= REFRESH_INTERVAL) {
        fetchPhotos()
      }
    }

    const interval = setInterval(checkAndRefresh, 60 * 1000)
    return () => clearInterval(interval)
  }, [user, googlePhotosAlbumId, photos.length, fetchPhotos])

  // Get thumbnail URL
  const getThumbnailUrl = (photo: Photo) => {
    return `${photo.baseUrl}=w400-h400-c`
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
  }

  const closeLightbox = () => {
    setLightboxIndex(null)
  }

  // Not connected state
  if (!user || !googlePhotosAlbumId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </Link>
            <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100">
              {t('gallery.title')}
            </h1>
          </div>

          {/* Empty state */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <Image className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {!user ? t('gallery.signInToView') : t('gallery.connectGooglePhotos')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
              {!user
                ? t('gallery.signInDescription')
                : t('gallery.connectDescription')}
            </p>
            <Link href="/settings">
              <Button className="gap-2">
                <Settings className="w-4 h-4" />
                {t('gallery.goToSettings')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100">
                {googlePhotosAlbumTitle || t('gallery.title')}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('gallery.photoCount', { count: photos.length })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchPhotos()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/settings">
              <Button variant="secondary" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-center">
            {error}
            <button
              onClick={() => fetchPhotos()}
              className="ml-2 underline hover:no-underline"
            >
              {t('common.tryAgain')}
            </button>
          </div>
        )}

        {/* Loading state (initial) */}
        {isLoading && photos.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
          </div>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => openLightbox(index)}
                  className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-sage-500 transition-all group"
                >
                  <img
                    src={getThumbnailUrl(photo)}
                    alt={photo.description || t('gallery.photo')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>

            {/* Load more */}
            {nextPageToken && (
              <div className="mt-8 text-center">
                <Button
                  variant="secondary"
                  onClick={() => fetchPhotos(true)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    t('gallery.loadMore')
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Empty album state */}
        {!isLoading && !error && photos.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <Image className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {t('gallery.noPhotos')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {t('gallery.noPhotosDescription')}
            </p>
            <Link href="/settings">
              <Button variant="secondary" size="sm">
                {t('gallery.changeAlbum')}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <PhotoLightbox
        photos={photos}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={closeLightbox}
        onNavigate={setLightboxIndex}
      />
    </div>
  )
}
