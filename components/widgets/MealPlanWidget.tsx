'use client'

import { useState } from 'react'
import { ChefHat, Plus } from 'lucide-react'
import { format, addDays } from 'date-fns'

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

  const todaysMeal = meals.find(m => m.date === today)
  const upcomingMeals = meals.filter(m => m.date > today).slice(0, 4)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="h-full flex flex-col p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <ChefHat className="w-4 h-4 text-orange-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Meal Plan</h3>
      </div>

      {/* Today's dinner */}
      {todaysMeal ? (
        <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 mb-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tonight</p>
          <p className="font-medium text-slate-800 dark:text-slate-100">{todaysMeal.dinner}</p>
        </div>
      ) : (
        <div className="bg-white/50 dark:bg-slate-700/30 rounded-xl p-3 mb-3 border-2 border-dashed border-slate-300 dark:border-slate-600">
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Plan tonight's dinner
          </p>
        </div>
      )}

      {/* Upcoming days */}
      <div className="flex-1 grid grid-cols-4 gap-1">
        {upcomingMeals.map(meal => {
          const date = new Date(meal.date)
          const dayName = days[date.getDay()]
          const emoji = meal.dinner.match(/\p{Emoji}/u)?.[0] || '🍽️'

          return (
            <div
              key={meal.date}
              className="flex flex-col items-center justify-center p-1 rounded-lg bg-white/50 dark:bg-slate-700/30"
            >
              <span className="text-xs text-slate-500 dark:text-slate-400">{dayName}</span>
              <span className="text-lg">{emoji}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
