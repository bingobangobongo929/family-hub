'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Sidebar from './Sidebar'
import { RefreshCw } from 'lucide-react'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isLoginPage = pathname === '/login'
  const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your-supabase-url'

  useEffect(() => {
    // Only redirect if Supabase is configured
    if (!loading && isSupabaseConfigured) {
      if (!user && !isLoginPage) {
        router.push('/login')
      } else if (user && isLoginPage) {
        router.push('/')
      }
    }
  }, [user, loading, isLoginPage, router, isSupabaseConfigured])

  // Show loading spinner while checking auth
  if (loading && isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  // Login page - no sidebar
  if (isLoginPage) {
    return <>{children}</>
  }

  // Demo mode (no Supabase) or logged in - show full app
  if (!isSupabaseConfigured || user) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          {children}
        </main>
      </div>
    )
  }

  // Not logged in and not on login page - will redirect
  return null
}
