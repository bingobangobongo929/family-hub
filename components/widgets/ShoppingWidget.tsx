'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Check, Plus } from 'lucide-react'
import Link from 'next/link'
import { recipeVaultSupabase } from '@/lib/supabase'
import { useWidgetSize } from '@/lib/useWidgetSize'
import { ShoppingListItem } from '@/lib/database.types'
import { useTranslation } from '@/lib/i18n-context'

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
  const [ref, { size, isWide, isTall, width, height }] = useWidgetSize()
  const { t } = useTranslation()

  const fetchItems = useCallback(async () => {
    if (!isRecipeVaultConfigured()) {
      setItems(DEMO_ITEMS)
      return
    }

    try {
      const { data: lists, error: listError } = await recipeVaultSupabase
        .from('shopping_lists')
        .select('id')
        .limit(1)

      if (listError || !lists || lists.length === 0) {
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
        setItems(DEMO_ITEMS)
        return
      }

      setItems(data || [])
    } catch (error) {
      setItems(DEMO_ITEMS)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const toggleItem = async (item: ShoppingListItem) => {
    const newChecked = !item.is_checked
    setItems(items.map(i => i.id === item.id ? { ...i, is_checked: newChecked } : i))

    if (!isConnected) return

    try {
      await recipeVaultSupabase
        .from('shopping_list_items')
        .update({ is_checked: newChecked })
        .eq('id', item.id)
    } catch (error) {
      setItems(items.map(i => i.id === item.id ? { ...i, is_checked: !newChecked } : i))
    }
  }

  const uncheckedItems = items.filter(i => !i.is_checked)
  const checkedItems = items.filter(i => i.is_checked)

  // Calculate layout based on actual dimensions
  // Row height: small=20px, medium=28px, large=32px
  const headerHeight = 40
  const footerHeight = checkedItems.length > 0 && size !== 'small' ? 32 : 0
  const availableHeight = height - headerHeight - footerHeight - 24 // padding

  const rowHeight = size === 'small' ? 22 : size === 'medium' ? 28 : size === 'large' ? 32 : 36
  const maxItemsFromHeight = Math.max(2, Math.floor(availableHeight / rowHeight))

  // Use 2 columns only when wide enough
  const useColumns = isWide && width > 320 && size !== 'small'
  const columns = useColumns ? 2 : 1
  const maxItems = useColumns ? maxItemsFromHeight * 2 : maxItemsFromHeight

  // Font and checkbox sizes based on widget size
  const textSize = size === 'small' ? 'text-xs' : size === 'xlarge' ? 'text-base' : 'text-sm'
  const checkboxSize = size === 'small' ? 'w-4 h-4' : size === 'xlarge' ? 'w-6 h-6' : 'w-5 h-5'
  const checkIconSize = size === 'xlarge' ? 'w-4 h-4' : 'w-3 h-3'
  const headerTextSize = size === 'xlarge' ? 'text-lg' : size === 'large' ? 'text-base' : 'text-sm'
  const headerIconSize = size === 'xlarge' ? 'w-6 h-6' : size === 'large' ? 'w-5 h-5' : 'w-4 h-4'
  const itemPadding = size === 'small' ? 'py-0.5 px-1' : size === 'xlarge' ? 'py-1.5 px-2' : 'py-1 px-1.5'

  // Show quantities when there's enough space
  const showQuantities = size !== 'small' && width > 180

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingCart className={`${headerIconSize} text-amber-600 flex-shrink-0`} />
          <h3 className={`font-display font-semibold text-slate-800 dark:text-slate-100 ${headerTextSize} truncate`}>
            {t('shopping.title')}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-slate-500 dark:text-slate-400 ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}>
            {uncheckedItems.length}
          </span>
          <Link
            href="/shopping"
            className="p-1 hover:bg-amber-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            <Plus className={`${headerIconSize} text-amber-600 dark:text-amber-400`} />
          </Link>
        </div>
      </div>

      {/* Items */}
      {uncheckedItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Check className={`${size === 'xlarge' ? 'w-10 h-10' : 'w-6 h-6'} text-green-500 mb-1`} />
          <p className={`text-slate-500 dark:text-slate-400 ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}>
            {t('shopping.allDone')}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div
            className={`${useColumns ? 'grid gap-x-2 gap-y-1 content-start' : 'flex flex-col gap-0.5'}`}
            style={useColumns ? { gridTemplateColumns: 'repeat(2, 1fr)' } : undefined}
          >
            {uncheckedItems.slice(0, maxItems).map(item => (
              <button
                key={item.id}
                onClick={() => toggleItem(item)}
                className={`flex items-center gap-2 ${itemPadding} rounded-lg hover:bg-amber-100/50 dark:hover:bg-slate-600/50 transition-colors text-left group min-w-0`}
              >
                <div className={`${checkboxSize} rounded-md border-2 ${
                  item.is_checked
                    ? 'bg-teal-500 border-teal-500'
                    : 'border-slate-300 dark:border-slate-500 group-hover:border-amber-400'
                } flex items-center justify-center flex-shrink-0`}>
                  {item.is_checked && <Check className={`${checkIconSize} text-white`} />}
                </div>
                <span className={`${textSize} ${
                  item.is_checked
                    ? 'text-slate-400 line-through'
                    : 'text-slate-700 dark:text-slate-200'
                } truncate flex-1`}>
                  {item.item_name}
                </span>
                {showQuantities && item.quantity && (
                  <span className={`text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0`}>
                    {item.quantity}{item.unit || ''}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* Show more link or spacer */}
          {uncheckedItems.length > maxItems ? (
            <Link
              href="/shopping"
              className={`block text-amber-600 dark:text-amber-400 text-center mt-auto pt-1 hover:underline ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}
            >
              {t('common.more', { count: uncheckedItems.length - maxItems })}
            </Link>
          ) : uncheckedItems.length < 3 ? (
            <Link
              href="/shopping"
              className={`block text-amber-600 dark:text-amber-400 text-center mt-auto pt-2 hover:underline ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}
            >
              {t('shopping.addMore')}
            </Link>
          ) : null}
        </div>
      )}

      {/* Footer - checked count */}
      {checkedItems.length > 0 && size !== 'small' && (
        <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-slate-600/50 flex-shrink-0">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {t('shopping.inTrolley', { count: checkedItems.length })}
          </p>
        </div>
      )}
    </div>
  )
}
