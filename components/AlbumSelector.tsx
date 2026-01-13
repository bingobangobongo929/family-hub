'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Image, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface Album {
  id: string
  title: string
  coverPhotoBaseUrl: string | null
  mediaItemsCount: number
}

interface AlbumSelectorProps {
  selectedAlbumId: string | null
  selectedAlbumTitle: string | null
  onSelect: (albumId: string, albumTitle: string) => void
}

export default function AlbumSelector({ selectedAlbumId, selectedAlbumTitle, onSelect }: AlbumSelectorProps) {
  const { user } = useAuth()
  const [albums, setAlbums] = useState<Album[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAlbums = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/google-photos/albums?user_id=${user.id}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch albums')
      }

      const data = await response.json()
      setAlbums(data.albums || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load albums')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && albums.length === 0 && !isLoading) {
      fetchAlbums()
    }
  }, [isOpen])

  const handleSelect = (album: Album) => {
    onSelect(album.id, album.title)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors min-w-[200px]"
      >
        <Image className="w-4 h-4 text-slate-400" />
        <span className="flex-1 text-left text-sm text-slate-700 dark:text-slate-200 truncate">
          {selectedAlbumTitle || 'Select album...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 max-h-80 overflow-hidden">
          {/* Header with refresh */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {albums.length} albums
            </span>
            <button
              onClick={fetchAlbums}
              disabled={isLoading}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Album list */}
          <div className="overflow-y-auto max-h-64">
            {isLoading && albums.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : error ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                <button
                  onClick={fetchAlbums}
                  className="mt-2 text-xs text-sage-600 dark:text-sage-400 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : albums.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No albums found
              </div>
            ) : (
              albums.map(album => (
                <button
                  key={album.id}
                  onClick={() => handleSelect(album)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                    selectedAlbumId === album.id ? 'bg-sage-50 dark:bg-sage-900/30' : ''
                  }`}
                >
                  {album.coverPhotoBaseUrl ? (
                    <img
                      src={`${album.coverPhotoBaseUrl}=w48-h48-c`}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <Image className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {album.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {album.mediaItemsCount} photos
                    </p>
                  </div>
                  {selectedAlbumId === album.id && (
                    <div className="w-2 h-2 rounded-full bg-sage-500 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
