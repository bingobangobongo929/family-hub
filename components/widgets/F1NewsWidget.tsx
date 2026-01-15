'use client'

import { useState, useEffect } from 'react'
import { useWidgetSize } from '@/lib/useWidgetSize'
import Link from 'next/link'
import { Newspaper, Star, ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-context'
import { useSettings } from '@/lib/settings-context'

interface F1NewsItem {
  id: string
  title: string
  description: string
  link: string
  pubDate: string
  imageUrl?: string
  isInteresting: boolean
}

interface NewsData {
  items: F1NewsItem[]
  cached: boolean
  timestamp: number
}

export default function F1NewsWidget() {
  const [ref, { size, height }] = useWidgetSize()
  const { t, locale } = useTranslation()
  const { aiModel } = useSettings()
  const [news, setNews] = useState<NewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchNews() {
      try {
        const response = await fetch(`/api/f1/news?model=${aiModel}`)
        if (response.ok) {
          setNews(await response.json())
        } else {
          setError(true)
        }
      } catch (e) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchNews()
  }, [aiModel])

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

      if (diffHours < 1) return t('common.justNow')
      if (diffHours < 24) return t('common.hoursAgo', { hours: diffHours })

      return date.toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', {
        day: 'numeric',
        month: 'short',
      })
    } catch {
      return ''
    }
  }

  // Filter to only show interesting news
  const interestingNews = news?.items.filter(item => item.isInteresting) || []

  // Calculate how many items to show based on height
  const headerHeight = 44
  const itemHeight = size === 'small' ? 50 : 70
  const footerHeight = 32
  const availableHeight = height - headerHeight - footerHeight - 16
  const maxItems = Math.max(1, Math.floor(availableHeight / itemHeight))

  const compactMode = size === 'small'

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-3 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏎️</span>
          <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100 text-sm">
            {t('f1.news')}
          </h3>
        </div>
        <Link
          href="/f1"
          className="text-xs text-red-600 dark:text-red-400 hover:underline"
        >
          {t('common.viewAll')}
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-sm text-slate-500">{t('f1.noNews')}</p>
          </div>
        ) : interestingNews.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <Newspaper className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">{t('f1.noNews')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {interestingNews.slice(0, maxItems).map(item => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className={`flex gap-2 ${compactMode ? 'items-center' : 'items-start'}`}>
                  {!compactMode && item.imageUrl && (
                    <div className="w-16 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-600">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-slate-800 dark:text-slate-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors ${
                      compactMode ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'
                    }`}>
                      {item.title}
                    </p>
                    {!compactMode && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">
                          {formatDate(item.pubDate)}
                        </span>
                        <Star className="w-3 h-3 text-yellow-500" />
                      </div>
                    )}
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && !error && interestingNews.length > maxItems && (
        <Link
          href="/f1"
          className="block text-center text-xs text-red-600 dark:text-red-400 hover:underline mt-2 pt-2 border-t border-slate-200 dark:border-slate-600"
        >
          {t('common.more', { count: interestingNews.length - maxItems })}
        </Link>
      )}
    </div>
  )
}
