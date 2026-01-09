'use client'

import { useState, useEffect } from 'react'
import Card, { CardHeader } from '@/components/Card'
import { ShoppingCart, Plus, Trash2, Check, RefreshCw, ChefHat, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  type ShoppingList,
  type ShoppingListItem,
  type InsertShoppingListItem,
  getCategoryConfig,
  CATEGORY_CONFIG
} from '@/lib/database.types'

// Demo data for when Supabase is not configured
const demoItems: ShoppingListItem[] = [
  { id: '1', list_id: 'demo', item_name: "Nappies Size 4 (Olivia)", quantity: 1, unit: "pack", category: "baby", recipe_id: null, recipe_name: null, recipe_quantities: null, is_checked: false, is_pantry_staple: false, is_manual: true, sort_order: 0, created_at: new Date().toISOString() },
  { id: '2', list_id: 'demo', item_name: "Nappies Size 6 (Ellie)", quantity: 1, unit: "pack", category: "baby", recipe_id: null, recipe_name: null, recipe_quantities: null, is_checked: false, is_pantry_staple: false, is_manual: true, sort_order: 1, created_at: new Date().toISOString() },
  { id: '3', list_id: 'demo', item_name: "Baby wipes", quantity: 2, unit: "packs", category: "baby", recipe_id: null, recipe_name: null, recipe_quantities: null, is_checked: true, is_pantry_staple: false, is_manual: true, sort_order: 2, created_at: new Date().toISOString() },
  { id: '4', list_id: 'demo', item_name: "Whole milk", quantity: 4, unit: "pints", category: "dairy", recipe_id: null, recipe_name: null, recipe_quantities: null, is_checked: false, is_pantry_staple: false, is_manual: true, sort_order: 3, created_at: new Date().toISOString() },
  { id: '5', list_id: 'demo', item_name: "Bananas", quantity: 1, unit: "bunch", category: "produce", recipe_id: null, recipe_name: null, recipe_quantities: null, is_checked: false, is_pantry_staple: false, is_manual: true, sort_order: 4, created_at: new Date().toISOString() },
  { id: '6', list_id: 'demo', item_name: "Pasta shapes", quantity: 500, unit: "g", category: "pantry", recipe_id: null, recipe_name: 'Bolognese', recipe_quantities: null, is_checked: false, is_pantry_staple: false, is_manual: false, sort_order: 5, created_at: new Date().toISOString() },
  { id: '7', list_id: 'demo', item_name: "Cheddar cheese", quantity: 200, unit: "g", category: "dairy", recipe_id: null, recipe_name: null, recipe_quantities: null, is_checked: false, is_pantry_staple: false, is_manual: true, sort_order: 6, created_at: new Date().toISOString() },
  { id: '8', list_id: 'demo', item_name: "Fish fingers", quantity: 1, unit: "box", category: "frozen", recipe_id: null, recipe_name: null, recipe_quantities: null, is_checked: false, is_pantry_staple: false, is_manual: true, sort_order: 7, created_at: new Date().toISOString() },
]

const CATEGORIES = Object.keys(CATEGORY_CONFIG)

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [listId, setListId] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('other')
  const [showAddForm, setShowAddForm] = useState(false)

  // Check if Supabase is configured
  const isSupabaseConfigured = () => {
    return process.env.NEXT_PUBLIC_SUPABASE_URL &&
           process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your-supabase-url'
  }

  // Fetch shopping list from Supabase
  const fetchShoppingList = async () => {
    if (!isSupabaseConfigured()) {
      setItems(demoItems)
      setLoading(false)
      return
    }

    try {
      // First get or create default shopping list
      const { data: listData, error: listError } = await supabase
        .from('shopping_lists')
        .select('*')
        .limit(1)

      if (listError) {
        console.error('Error fetching list:', listError)
        setItems(demoItems)
        setLoading(false)
        return
      }

      const list = (listData as ShoppingList[] | null)?.[0]

      if (list) {
        setListId(list.id)
        setIsConnected(true)

        // Fetch items for this list
        const { data: itemsData, error: itemsError } = await supabase
          .from('shopping_list_items')
          .select('*')
          .eq('list_id', list.id)
          .order('category')
          .order('sort_order')

        if (itemsError) {
          console.error('Error fetching items:', itemsError)
        } else {
          setItems((itemsData as ShoppingListItem[] | null) || [])
        }
      } else {
        // No list found, use demo data
        setItems(demoItems)
      }
    } catch (error) {
      console.error('Supabase error:', error)
      setItems(demoItems)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchShoppingList()
  }, [])

  // Toggle item checked status
  const toggleItem = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return

    // Optimistic update
    setItems(items.map(i =>
      i.id === id ? { ...i, is_checked: !i.is_checked } : i
    ))

    if (isConnected) {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({ is_checked: !item.is_checked })
        .eq('id', id)

      if (error) {
        console.error('Error updating item:', error)
        // Revert on error
        setItems(items)
      }
    }
  }

  // Delete item
  const deleteItem = async (id: string) => {
    // Optimistic update
    const previousItems = items
    setItems(items.filter(i => i.id !== id))

    if (isConnected) {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting item:', error)
        setItems(previousItems)
      }
    }
  }

  // Add new item
  const addItem = async () => {
    if (!newItemName.trim()) return

    const newItem: InsertShoppingListItem = {
      list_id: listId || 'demo',
      item_name: newItemName.trim(),
      quantity: newItemQuantity ? parseFloat(newItemQuantity) : 1,
      unit: null,
      category: newItemCategory,
      is_manual: true,
      is_checked: false,
      is_pantry_staple: false,
      sort_order: items.length,
    }

    if (isConnected && listId) {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .insert(newItem)
        .select()
        .single()

      if (error) {
        console.error('Error adding item:', error)
      } else if (data) {
        setItems([...items, data as ShoppingListItem])
      }
    } else {
      // Demo mode - add locally
      const demoNewItem: ShoppingListItem = {
        id: Date.now().toString(),
        list_id: 'demo',
        item_name: newItemName.trim(),
        quantity: newItemQuantity ? parseFloat(newItemQuantity) : 1,
        unit: null,
        category: newItemCategory,
        recipe_id: null,
        recipe_name: null,
        recipe_quantities: null,
        is_checked: false,
        is_pantry_staple: false,
        is_manual: true,
        sort_order: items.length,
        created_at: new Date().toISOString(),
      }
      setItems([...items, demoNewItem])
    }

    setNewItemName('')
    setNewItemQuantity('')
    setNewItemCategory('other')
    setShowAddForm(false)
  }

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, ShoppingListItem[]>)

  const uncheckedItems = items.filter(i => !i.is_checked)
  const checkedItems = items.filter(i => i.is_checked)
  const recipeItems = items.filter(i => !i.is_manual && i.recipe_name)

  // Sort categories with items
  const sortedCategories = Object.keys(groupedItems)
    .filter(cat => groupedItems[cat].some(i => !i.is_checked))
    .sort()

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Shopping List</h1>
          <p className="text-slate-500 mt-1">
            {isConnected ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Connected to Recipe Vault
              </span>
            ) : (
              'Demo mode - connect Supabase for sync'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {isConnected && (
            <button
              onClick={fetchShoppingList}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <Card className="mb-6" hover={false}>
          <h3 className="font-semibold text-slate-800 mb-4">Add Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="Item name..."
              className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all"
              autoFocus
            />
            <input
              type="text"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              placeholder="Quantity (optional)"
              className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all"
            />
            <select
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {getCategoryConfig(cat).emoji} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addItem}
              className="px-6 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
            >
              Add
            </button>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="flex gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-100 text-orange-700">
          <ShoppingCart className="w-4 h-4" />
          <span className="text-sm font-medium">{uncheckedItems.length} to buy</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-100 text-green-700">
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">{checkedItems.length} done</span>
        </div>
        {recipeItems.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-100 text-purple-700">
            <ChefHat className="w-4 h-4" />
            <span className="text-sm font-medium">{recipeItems.length} from recipes</span>
          </div>
        )}
      </div>

      {/* Recipe Vault Link */}
      {isConnected && (
        <a
          href="https://recipe-vault.vercel.app/shopping-list"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 mb-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-slate-700">Add from Recipe Vault</span>
          </div>
          <ExternalLink className="w-4 h-4 text-purple-500 group-hover:translate-x-0.5 transition-transform" />
        </a>
      )}

      {/* Shopping List by Category */}
      {sortedCategories.length > 0 ? (
        <div className="space-y-3">
          {sortedCategories.map(category => {
            const categoryItems = groupedItems[category].filter(i => !i.is_checked)
            if (categoryItems.length === 0) return null

            const config = getCategoryConfig(category)

            return (
              <Card key={category} hover={false} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span>{config.emoji}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </span>
                  <span className="text-xs text-slate-400">{categoryItems.length}</span>
                </div>
                <div className="space-y-1">
                  {categoryItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <button
                        onClick={() => toggleItem(item.id)}
                        className="w-5 h-5 rounded border-2 border-slate-300 hover:border-green-500 transition-colors flex items-center justify-center flex-shrink-0"
                      />
                      <span className="flex-1 text-sm text-slate-700 truncate">{item.item_name}</span>
                      {item.quantity && (
                        <span className="text-xs text-slate-400">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
                      )}
                      {item.recipe_name && (
                        <ChefHat className="w-3 h-3 text-purple-500 flex-shrink-0" />
                      )}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="text-center py-12" hover={false}>
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 mb-4">Your shopping list is empty</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add your first item
          </button>
        </Card>
      )}

      {/* Checked Items */}
      {checkedItems.length > 0 && (
        <Card className="mt-4 p-4" hover={false}>
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">Completed ({checkedItems.length})</span>
          </div>
          <div className="space-y-1">
            {checkedItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-1 px-2 -mx-2 rounded-lg bg-green-50/50 group"
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-5 h-5 rounded bg-green-500 text-white flex items-center justify-center flex-shrink-0"
                >
                  <Check className="w-3 h-3" />
                </button>
                <span className="flex-1 text-sm text-slate-400 line-through truncate">{item.item_name}</span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
