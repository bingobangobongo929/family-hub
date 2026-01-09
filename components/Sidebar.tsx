'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Calendar,
  CheckSquare,
  ShoppingCart,
  StickyNote,
  Users,
  LogOut
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/shopping', label: 'Shopping', icon: ShoppingCart },
  { href: '/notes', label: 'Notes', icon: StickyNote },
]

const familyMembers = [
  { name: 'Dad', color: 'bg-blue-500' },
  { name: 'Mum', color: 'bg-pink-500' },
  { name: 'Olivia', color: 'bg-purple-500', age: 3 },
  { name: 'Ellie', color: 'bg-green-500', age: 1 },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 glass shadow-xl z-50 flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
            Family Hub
          </h1>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-8 pt-8 border-t border-slate-200">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Family Members
          </h3>
          <div className="space-y-3">
            {familyMembers.map((member) => (
              <div key={member.name} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${member.color} flex items-center justify-center text-white text-sm font-medium`}>
                  {member.name[0]}
                </div>
                <span className="text-sm text-slate-600">{member.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User section at bottom */}
      {user && (
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
              {user.email?.[0].toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  )
}
