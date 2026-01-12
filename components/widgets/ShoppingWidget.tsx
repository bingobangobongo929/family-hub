'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Check, Plus, Package } from 'lucide-react'
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
  { id: '9', list_id: 'demo', item_name: 'Yogurt', quantity: 4, unit: null, category: 'dairy', is_checked: false, is_manual: true, is_pantry_staple: false, sort_order: 8, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
  { id: '10', list_id: 'demo', item_name: 'Orange juice', quantity: 1, unit: 'L', category: 'beverages', is_checked: false, is_manual: true, is_pantry_staple: false, sort_order: 9, recipe_id: null, recipe_name: null, recipe_quantities: null, created_at: '' },
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

  // Determine layout mode based on size AND shape
  type LayoutMode = 'compact' | 'list' | 'cards' | 'grid' | 'full'

  let layoutMode: LayoutMode = 'list'
  let columns = 1
  let maxItems = 6
  let showQuantities = false
  let showCategories = false
  let showEmoji = false
  let fontSize: 'xs' | 'sm' | 'base' | 'lg' = 'sm'
  let checkboxSize = 'w-5 h-5'
  let itemPadding = 'py-1 px-2'

  // Calculate based on actual dimensions
  const isVeryWide = width > 400
  const isMediumWide = width > 280
  const isVeryTall = height > 350
  const isMediumTall = height > 220

  if (size === 'small') {
    layoutMode = 'compact'
    maxItems = isTall ? 6 : 4
    fontSize = 'xs'
    checkboxSize = 'w-4 h-4'
    itemPadding = 'py-0.5 px-1'
  } else if (size === 'medium') {
    if (isWide && !isTall) {
      // Wide and short - use 2 columns
      layoutMode = 'cards'
      columns = 2
      maxItems = 8
      showQuantities = true
      fontSize = 'sm'
    } else if (isTall && !isWide) {
      // Tall and narrow - vertical list with more items
      layoutMode = 'list'
      maxItems = 10
      showQuantities = true
      fontSize = 'sm'
    } else {
      // Square-ish
      layoutMode = 'list'
      maxItems = 6
      showQuantities = true
      fontSize = 'sm'
    }
  } else if (size === 'large') {
    if (isVeryWide) {
      // Very wide - grid with categories
      layoutMode = 'grid'
      columns = 3
      maxItems = 15
      showQuantities = true
      showCategories = true
      showEmoji = true
      fontSize = 'base'
    } else if (isWide) {
      // Moderately wide
      layoutMode = 'cards'
      columns = 2
      maxItems = 12
      showQuantities = true
      showEmoji = true
      fontSize = 'base'
    } else if (isVeryTall) {
      // Very tall
      layoutMode = 'list'
      maxItems = 16
      showQuantities = true
      showCategories = true
      showEmoji = true
      fontSize = 'base'
    } else {
      layoutMode = 'cards'
      columns = 2
      maxItems = 10
      showQuantities = true
      fontSize = 'sm'
    }
  } else if (size === 'xlarge') {
    layoutMode = 'full'
    columns = isVeryWide ? 4 : 3
    maxItems = 24
    showQuantities = true
    showCategories = true
    showEmoji = true
    fontSize = 'lg'
    checkboxSize = 'w-6 h-6'
    itemPadding = 'py-2 px-3'
  }

  // Group by category for category views
  const groupedItems = uncheckedItems.reduce((acc, item) => {
    const cat = item.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, ShoppingListItem[]>)

  // Header text size
  const headerSize = size === 'xlarge' ? 'text-lg' : size === 'large' ? 'text-base' : 'text-sm'
  const iconSize = size === 'xlarge' ? 'w-6 h-6' : size === 'large' ? 'w-5 h-5' : 'w-4 h-4'

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className={`${iconSize} text-amber-600`} />
          <h3 className={`font-display font-semibold text-slate-800 dark:text-slate-100 ${headerSize}`}>
            Shopping
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-slate-500 dark:text-slate-400 ${size === 'small' ? 'text-xs' : 'text-sm'}`}>
            {uncheckedItems.length} items
          </span>
          <Link
            href="/shopping"
            className={`${size === 'xlarge' ? 'p-2' : 'p-1'} hover:bg-amber-100 dark:hover:bg-slate-600 rounded-lg transition-colors`}
          >
            <Plus className={`${iconSize} text-amber-600 dark:text-amber-400`} />
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {uncheckedItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Check className={`${size === 'xlarge' ? 'w-12 h-12' : 'w-8 h-8'} text-green-500 mb-2`} />
          <p className={`text-slate-500 dark:text-slate-400 ${size === 'small' ? 'text-xs' : 'text-sm'}`}>
            All done!
          </p>
          <Link href="/shopping" className={`text-amber-600 dark:text-amber-400 mt-2 hover:underline ${size === 'small' ? 'text-xs' : 'text-sm'}`}>
            Add items
          </Link>
        </div>
      ) : layoutMode === 'compact' ? (
        // Compact mode - minimal styling, max items
        <div className="flex-1 space-y-0.5 overflow-hidden">
          {uncheckedItems.slice(0, maxItems).map(item => (
            <CompactItem key={item.id} item={item} onToggle={toggleItem} />
          ))}
          {uncheckedItems.length > maxItems && (
            <Link href="/shopping" className="block text-xs text-amber-600 dark:text-amber-400 text-center pt-1 hover:underline">
              +{uncheckedItems.length - maxItems} more
            </Link>
          )}
        </div>
      ) : layoutMode === 'grid' || layoutMode === 'full' ? (
        // Grid mode with categories
        <div className="flex-1 overflow-hidden">
          <div
            className="grid gap-3 h-full"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Object.entries(groupedItems).slice(0, columns * 2).map(([category, categoryItems]) => {
              const config = getCategoryConfig(category)
              const itemsPerCategory = Math.floor(maxItems / (columns * 2))
              return (
                <div key={category} className="min-w-0">
                  <div className={`flex items-center gap-1.5 mb-2 ${fontSize === 'lg' ? 'text-sm' : 'text-xs'} font-medium text-slate-500 dark:text-slate-400`}>
                    <span className={fontSize === 'lg' ? 'text-base' : 'text-sm'}>{config.emoji}</span>
                    <span className="truncate capitalize">{category}</span>
                  </div>
                  <div className="space-y-1">
                    {categoryItems.slice(0, itemsPerCategory).map(item => (
                      <ShoppingItem
                        key={item.id}
                        item={item}
                        fontSize={fontSize}
                        checkboxSize={checkboxSize}
                        padding={itemPadding}
                        showQuantity={showQuantities}
                        showEmoji={false}
                        onToggle={toggleItem}
                      />
                    ))}
                    {categoryItems.length > itemsPerCategory && (
                      <p className="text-[10px] text-slate-400 pl-1">+{categoryItems.length - itemsPerCategory} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : layoutMode === 'cards' ? (
        // Cards mode - 2 columns without categories
        <div className="flex-1 overflow-hidden">
          <div
            className="grid gap-2 h-full"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {uncheckedItems.slice(0, maxItems).map(item => (
              <ShoppingItem
                key={item.id}
                item={item}
                fontSize={fontSize}
                checkboxSize={checkboxSize}
                padding={itemPadding}
                showQuantity={showQuantities}
                showEmoji={showEmoji}
                onToggle={toggleItem}
              />
            ))}
          </div>
          {uncheckedItems.length > maxItems && (
            <Link href="/shopping" className={`block text-amber-600 dark:text-amber-400 text-center pt-2 hover:underline ${fontSize === 'base' ? 'text-sm' : 'text-xs'}`}>
              +{uncheckedItems.length - maxItems} more items
            </Link>
          )}
        </div>
      ) : (
        // List mode - single column
        <div className="flex-1 space-y-1 overflow-hidden">
          {showCategories ? (
            // List with category headers
            Object.entries(groupedItems).map(([category, categoryItems]) => {
              const config = getCategoryConfig(category)
              return (
                <div key={category}>
                  <div className="flex items-center gap-1.5 mb-1 mt-2 first:mt-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span>{config.emoji}</span>
                    <span className="capitalize">{category}</span>
                  </div>
                  {categoryItems.slice(0, Math.ceil(maxItems / Object.keys(groupedItems).length)).map(item => (
                    <ShoppingItem
                      key={item.id}
                      item={item}
                      fontSize={fontSize}
                      checkboxSize={checkboxSize}
                      padding={itemPadding}
                      showQuantity={showQuantities}
                      showEmoji={showEmoji}
                      onToggle={toggleItem}
                    />
                  ))}
                </div>
              )
            })
          ) : (
            <>
              {uncheckedItems.slice(0, maxItems).map(item => (
                <ShoppingItem
                  key={item.id}
                  item={item}
                  fontSize={fontSize}
                  checkboxSize={checkboxSize}
                  padding={itemPadding}
                  showQuantity={showQuantities}
                  showEmoji={showEmoji}
                  onToggle={toggleItem}
                />
              ))}
              {uncheckedItems.length > maxItems && (
                <Link href="/shopping" className={`block text-amber-600 dark:text-amber-400 text-center pt-1 hover:underline ${fontSize === 'base' ? 'text-sm' : 'text-xs'}`}>
                  +{uncheckedItems.length - maxItems} more items
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* Footer - checked count */}
      {checkedItems.length > 0 && size !== 'small' && (
        <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-slate-600/50">
          <p className={`text-slate-400 dark:text-slate-500 ${size === 'xlarge' ? 'text-sm' : 'text-xs'}`}>
            {checkedItems.length} item{checkedItems.length !== 1 ? 's' : ''} in trolley
          </p>
        </div>
      )}
    </div>
  )
}

// Compact item for small widgets
function CompactItem({
  item,
  onToggle
}: {
  item: ShoppingListItem
  onToggle: (item: ShoppingListItem) => void
}) {
  return (
    <button
      onClick={() => onToggle(item)}
      className="w-full flex items-center gap-1.5 py-0.5 rounded-lg hover:bg-amber-100/50 dark:hover:bg-slate-600/50 transition-colors text-left group"
    >
      <div className={`w-3.5 h-3.5 rounded border-2 ${
        item.is_checked
          ? 'bg-teal-500 border-teal-500'
          : 'border-slate-300 dark:border-slate-500 group-hover:border-amber-400'
      } flex items-center justify-center flex-shrink-0`}>
        {item.is_checked && <Check className="w-2 h-2 text-white" />}
      </div>
      <span className={`text-[11px] ${
        item.is_checked
          ? 'text-slate-400 line-through'
          : 'text-slate-700 dark:text-slate-200'
      } truncate flex-1`}>
        {item.item_name}
      </span>
    </button>
  )
}

// Standard shopping item with size options
function ShoppingItem({
  item,
  fontSize,
  checkboxSize,
  padding,
  showQuantity,
  showEmoji,
  onToggle
}: {
  item: ShoppingListItem
  fontSize: 'xs' | 'sm' | 'base' | 'lg'
  checkboxSize: string
  padding: string
  showQuantity: boolean
  showEmoji: boolean
  onToggle: (item: ShoppingListItem) => void
}) {
  const config = getCategoryConfig(item.category)

  const textSize = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg'
  }[fontSize]

  const quantitySize = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    base: 'text-sm',
    lg: 'text-sm'
  }[fontSize]

  return (
    <button
      onClick={() => onToggle(item)}
      className={`w-full flex items-center gap-2 ${padding} rounded-xl hover:bg-amber-100/50 dark:hover:bg-slate-600/50 transition-colors text-left group`}
    >
      <div className={`${checkboxSize} rounded-md border-2 ${
        item.is_checked
          ? 'bg-teal-500 border-teal-500'
          : 'border-slate-300 dark:border-slate-500 group-hover:border-amber-400'
      } flex items-center justify-center flex-shrink-0`}>
        {item.is_checked && <Check className={`${fontSize === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} text-white`} />}
      </div>
      {showEmoji && (
        <span className={fontSize === 'lg' ? 'text-base' : 'text-sm'}>{config.emoji}</span>
      )}
      <span className={`${textSize} ${
        item.is_checked
          ? 'text-slate-400 line-through'
          : 'text-slate-700 dark:text-slate-200'
      } truncate flex-1 font-medium`}>
        {item.item_name}
      </span>
      {showQuantity && item.quantity && (
        <span className={`${quantitySize} text-slate-400 dark:text-slate-500 flex-shrink-0`}>
          {item.quantity}{item.unit ? item.unit : ''}
        </span>
      )}
    </button>
  )
}
