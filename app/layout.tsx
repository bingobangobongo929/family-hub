import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-context'
import { I18nProvider } from '@/lib/i18n-context'
import { FamilyProvider } from '@/lib/family-context'
import { SettingsProvider } from '@/lib/settings-context'
import { CategoriesProvider } from '@/lib/categories-context'
import { ContactsProvider } from '@/lib/contacts-context'
import { EditModeProvider } from '@/lib/edit-mode-context'
import { PushProvider } from '@/lib/push-context'
import { DeviceProvider } from '@/lib/device-context'
import AppLayout from '@/components/AppLayout'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Family Hub',
  description: 'Your family command center - calendar, tasks, shopping lists, and more',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Family Hub',
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme color meta tags for status bar theming */}
        {/* Light mode: warm-50 background */}
        <meta name="theme-color" content="#fffef9" media="(prefers-color-scheme: light)" />
        {/* Dark mode: slate-900 background */}
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        {/* Inline CSS for instant loading screen - no React needed */}
        <style dangerouslySetInnerHTML={{ __html: `
          #initial-loader {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%);
            transition: opacity 0.3s ease-out, visibility 0.3s ease-out;
          }
          #initial-loader.hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
          }
          #initial-loader .loader-icon {
            width: 80px;
            height: 80px;
            border-radius: 20px;
            animation: pulse 1.5s ease-in-out infinite;
            box-shadow: 0 10px 40px -10px rgba(20, 184, 166, 0.5);
          }
          #initial-loader .loader-dots {
            display: flex;
            gap: 6px;
            margin-top: 24px;
          }
          #initial-loader .loader-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #14b8a6;
            animation: bounce 0.6s ease-in-out infinite;
          }
          #initial-loader .loader-dot:nth-child(2) { animation-delay: 0.15s; }
          #initial-loader .loader-dot:nth-child(3) { animation-delay: 0.3s; }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(0.95); }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @media (prefers-color-scheme: dark) {
            #initial-loader {
              background: linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #0f172a 100%);
            }
          }
        `}} />
      </head>
      <body className={`${inter.variable} ${poppins.variable} font-sans`}>
        {/* Instant loading screen - hidden by AppLayout when ready */}
        <div id="initial-loader">
          <img src="/icon-512.png" alt="" className="loader-icon" />
          <div className="loader-dots">
            <div className="loader-dot"></div>
            <div className="loader-dot"></div>
            <div className="loader-dot"></div>
          </div>
        </div>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <DeviceProvider>
                <FamilyProvider>
                  <SettingsProvider>
                    <CategoriesProvider>
                      <ContactsProvider>
                        <EditModeProvider>
                          <PushProvider>
                            <AppLayout>
                              {children}
                            </AppLayout>
                          </PushProvider>
                        </EditModeProvider>
                      </ContactsProvider>
                    </CategoriesProvider>
                  </SettingsProvider>
                </FamilyProvider>
              </DeviceProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
