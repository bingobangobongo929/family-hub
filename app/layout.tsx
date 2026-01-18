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
      <body className={`${inter.variable} ${poppins.variable} font-sans`}>
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
