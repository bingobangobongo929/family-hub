import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-context'
import { FamilyProvider } from '@/lib/family-context'
import { SettingsProvider } from '@/lib/settings-context'
import { CategoriesProvider } from '@/lib/categories-context'
import { ContactsProvider } from '@/lib/contacts-context'
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
          <AuthProvider>
            <FamilyProvider>
              <SettingsProvider>
                <CategoriesProvider>
                  <ContactsProvider>
                    <AppLayout>
                      {children}
                    </AppLayout>
                  </ContactsProvider>
                </CategoriesProvider>
              </SettingsProvider>
            </FamilyProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
