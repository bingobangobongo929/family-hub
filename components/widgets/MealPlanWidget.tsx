'use client'

import { useState } from 'react'
import { ChefHat, Plus } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'

interface MealPlan {
  date: string
  breakfast?: string
  lunch?: string
  dinner: string
}

// Demo meal plans
const DEMO_MEALS: MealPlan[] = [
  { date: format(new Date(), 'yyyy-MM-dd'), dinner: 'Spaghetti Bolognese 🍝' },
  { date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), dinner: 'Chicken Stir Fry 🥡' },
  { date: format(addDays(new Date(), 2), 'yyyy-MM-dd'), dinner: 'Fish & Chips 🐟' },
  { date: format(addDays(new Date(), 3), 'yyyy-MM-dd'), dinner: 'Tacos 🌮' },
  { date: format(addDays(new Date(), 4), 'yyyy-MM-dd'), dinner: 'Pizza Night 🍕' },
]

export default function MealPlanWidget() {
  const [meals] = useState<MealPlan[]>(DEMO_MEALS)
  const today = format(new Date(), 'yyyy-MM-dd')
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)

  const todaysMeal = meals.find(m => m.date === today)
  const upcomingMeals = meals.filter(m => m.date > today).slice(0, 4)

  return (
    <div className="h-full flex flex-col p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
      <div className="flex items-center gap-2 mb-3">
        <ChefHat className="w-4 h-4 text-orange-500" />
        <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">{t('meals.title')}</h3>
      </div>

      {/* Today's dinner */}
      {todaysMeal ? (
        <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 mb-3 shadow-sm">
          <p className="text-xs text-orange-600 dark:text-orange-400 mb-1 font-medium">{t('meals.tonight')}</p>
          <p className="font-medium text-slate-800 dark:text-slate-100">{todaysMeal.dinner}</p>
        </div>
      ) : (
        <div className="bg-white/50 dark:bg-slate-700/30 rounded-xl p-3 mb-3 border-2 border-dashed border-orange-300 dark:border-slate-600">
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('meals.planTonight')}
          </p>
        </div>
      )}

      {/* Upcoming days */}
      <div className="flex-1 grid grid-cols-4 gap-1.5">
        {upcomingMeals.map(meal => {
          const date = new Date(meal.date)
          const dayName = format(date, 'EEE', { locale: dateLocale })
          const emoji = meal.dinner.match(/\p{Emoji}/u)?.[0] || '🍽️'

          return (
            <div
              key={meal.date}
              className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-white/50 dark:bg-slate-700/30"
            >
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{dayName}</span>
              <span className="text-lg">{emoji}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
