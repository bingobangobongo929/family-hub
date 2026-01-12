'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Check, Plus } from 'lucide-react'
import Link from 'next/link'
import { recipeVaultSupabase } from '@/lib/supabase'
import { useWidgetSize } from '@/lib/useWidgetSize'
import { ShoppingListItem, getCategoryConfig } from '@/lib/database.types'

// Demo shopping items
const DEMO_ITEMS: ShoppingListItem[] = [
  { id: '1', list_id: 'demo', item_name: 'Milk', quantity: 2, unit: 'L', category: 'dairy', is_checked: false, is_manual: true, is_pantry_staple: false, sort_order: 0, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
  { id: '2', list_id: 'demo', item_name: 'Bread', quantity: 1, unit: null, category: 'bakery', is_checked: false, is_manual: true, is_pantry_staple: false, sort_order: 1, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
  { id: '3', list_id: 'demo', item_name: 'Eggs', quantity: 12, unit: null, category: 'dairy', is_checked: true, is_manual: true, is_pantry_staple: false, sort_order: 2, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
  { id: '4', list_id: 'demo', item_name: 'Apples', quantity: 6, unit: null, category: 'produce', is_checked: false, is_manual: true, is_pantry_staple: false, sort_order: 3, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
  { id: '5', list_id: 'demo', item_name: 'Chicken breast', quantity: 500, unit: 'g', category: 'meat', is_checked: false, is_manual: true, is_pantry_staple: false, sort_order: 4, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
  { id: '6', list_id: 'demo', item_name: 'Pasta', quantity: 1, unit: 'kg', category: 'pantry', is_checked: false, is_manual: true, is_pantry_staple: true, sort_order: 5, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
  { id: '7', list_id: 'demo', item_name: 'Tomatoes', quantity: 4, unit: null, category: 'produce', is_checked: false, is_manual: true, is_pantry_staple: false, sort_order: 6, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
  { id: '8', list_id: 'demo', item_name: 'Cheese', quantity: 200, unit: 'g', category: 'dairy', is_checked: false, is_manual: true, is_pantry_staple: false, sort_order: 7, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
]

// Check if Recipe Vault Supabase is configured
const isRecipeVaultConfigured = () => {
  const url = process.env.NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_URL
  return url && url !== '' && url !== 'your-supabase-url'
}

export default function ShoppingWidget() {
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [listId, setListId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [ref, { size, isWide, isTall }] = useWidgetSize()

  const fetchItems = useCallback(async () => {
    if (!isRecipeVaultConfigured()) {
      setItems(DEMO_ITEMS)
      return
    }

    try {
      // Get the shopping list from Recipe Vault
      const { data: lists, error: listError } = await recipeVaultSupabase
        .from('shopping_lists')
        .select('id')
        .limit(1)

      if (listError) {
        console.error('Error fetching shopping list:', listError)
        setItems(DEMO_ITEMS)
        return
      }

      if (!lists || lists.length === 0) {
        console.log('No shopping list found, using demo items')
        setItems(DEMO_ITEMS)
        return
      }

      setListId(lists[0].id)
      setIsConnected(true)

      const { data, error: itemsError } = await recipeVaultSupabase
        .from('shopping_list_items')
        .select('*')
        .eq('list_id', lists[0].id)
        .order('is_checked', { ascending: true })
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })

      if (itemsError) {
        console.error('Error fetching shopping items:', itemsError)
        setItems(DEMO_ITEMS)
        return
      }

      // Set items even if empty array (connected but no items)
      setItems(data || [])
    } catch (error) {
      console.error('Error fetching shopping items:', error)
      setItems(DEMO_ITEMS)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const toggleItem = async (item: ShoppingListItem) => {
    const newChecked = !item.is_checked

    // Optimistic update
    setItems(items.map(i =>
      i.id === item.id ? { ...i, is_checked: newChecked } : i
    ))

    if (!isConnected) return

    try {
      await recipeVaultSupabase
        .from('shopping_list_items')
        .update({ is_checked: newChecked })
        .eq('id', item.id)
    } catch (error) {
      console.error('Error updating item:', error)
      // Revert on error
      setItems(items.map(i =>
        i.id === item.id ? { ...i, is_checked: !newChecked } : i
      ))
    }
  }

  const uncheckedItems = items.filter(i => !i.is_checked)
  const checkedItems = items.filter(i => i.is_checked)

  // Number of items to show based on size
  const maxItems = {
    small: 4,
    medium: 6,
    large: 10,
    xlarge: 14,
  }[size]

  const compactMode = size === 'small'
  const showCategories = (size === 'large' || size === 'xlarge') && isWide

  // Group by category for larger views
  const groupedItems = uncheckedItems.reduce((acc, item) => {
    const cat = item.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, ShoppingListItem[]>)

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-amber-600" />
          <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">Shopping</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {uncheckedItems.length} items
          </span>
          <Link
            href="/shopping"
            className="p-1 hover:bg-amber-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </Link>
        </div>
      </div>

      {uncheckedItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Check className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">All done!</p>
          <Link href="/shopping" className="text-xs text-amber-600 dark:text-amber-400 mt-2 hover:underline">
            Add items
          </Link>
        </div>
      ) : showCategories ? (
        // Category view for large/wide
        <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">
          {Object.entries(groupedItems).slice(0, 4).map(([category, categoryItems]) => {
            const config = getCategoryConfig(category)
            return (
              <div key={category} className="space-y-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span>{config.emoji}</span>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </p>
                {categoryItems.slice(0, 3).map(item => (
                  <ShoppingItem
                    key={item.id}
                    item={item}
                    compact={true}
                    onToggle={toggleItem}
                  />
                ))}
                {categoryItems.length > 3 && (
                  <p className="text-[10px] text-slate-400">+{categoryItems.length - 3} more</p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        // List view
        <div className={`flex-1 space-y-${compactMode ? '1' : '1.5'} overflow-hidden`}>
          {uncheckedItems.slice(0, maxItems).map(item => (
            <ShoppingItem
              key={item.id}
              item={item}
              compact={compactMode}
              onToggle={toggleItem}
            />
          ))}
          {uncheckedItems.length > maxItems && (
            <Link
              href="/shopping"
              className="block text-xs text-amber-600 dark:text-amber-400 text-center pt-1 hover:underline"
            >
              +{uncheckedItems.length - maxItems} more items
            </Link>
          )}
        </div>
      )}

      {/* Show checked count if there are any */}
      {checkedItems.length > 0 && size !== 'small' && (
        <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-slate-600/50">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {checkedItems.length} item{checkedItems.length !== 1 ? 's' : ''} in trolley
          </p>
        </div>
      )}
    </div>
  )
}

function ShoppingItem({
  item,
  compact,
  onToggle
}: {
  item: ShoppingListItem
  compact: boolean
  onToggle: (item: ShoppingListItem) => void
}) {
  const config = getCategoryConfig(item.category)

  return (
    <button
      onClick={() => onToggle(item)}
      className={`w-full flex items-center gap-2 ${compact ? 'py-0.5' : 'py-1 px-2'} rounded-xl hover:bg-amber-100/50 dark:hover:bg-slate-600/50 transition-colors text-left group`}
    >
      <div className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} rounded-md border-2 ${
        item.is_checked
          ? 'bg-teal-500 border-teal-500'
          : 'border-slate-300 dark:border-slate-500 group-hover:border-amber-400'
      } flex items-center justify-center flex-shrink-0`}>
        {item.is_checked && <Check className="w-3 h-3 text-white" />}
      </div>
      <span className={`${compact ? 'text-xs' : 'text-sm'} ${
        item.is_checked
          ? 'text-slate-400 line-through'
          : 'text-slate-700 dark:text-slate-200'
      } truncate flex-1`}>
        {item.item_name}
      </span>
      {!compact && item.quantity && (
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {item.quantity}{item.unit ? item.unit : ''}
        </span>
      )}
    </button>
  )
}
