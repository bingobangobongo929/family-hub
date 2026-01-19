'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from '@/lib/i18n-context'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()
  const { t } = useTranslation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-teal-50 via-teal-100 to-teal-200 dark:from-slate-900 dark:via-teal-950 dark:to-slate-900">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-300/30 dark:bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-400/20 dark:bg-teal-600/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Logo & Branding */}
        <div className="mb-8 flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-teal-500/20 rounded-3xl blur-xl scale-110" />
            <Image
              src="/icon-512.png"
              alt="Family Hub"
              width={100}
              height={100}
              className="relative rounded-[1.75rem] shadow-2xl shadow-teal-500/25"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
            {t('nav.appName')}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400 text-center">
            Your family command center
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-3xl shadow-xl shadow-slate-900/5 dark:shadow-black/20 border border-white/50 dark:border-slate-700/50 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('login.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('login.emailPlaceholder')}
                  required
                  autoComplete="email"
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('login.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  required
                  autoComplete="current-password"
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-2xl font-semibold shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {t('login.signIn')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
            {t('login.sameAccountHint')}
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-slate-500 dark:text-slate-500">
          Made with ♥ for the family
        </p>
      </div>
    </div>
  )
}
