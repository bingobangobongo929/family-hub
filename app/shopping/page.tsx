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
        ...newItem,
        id: Date.now().toString(),
        list_id: 'demo',
        recipe_id: null,
        recipe_name: null,
        recipe_quantities: null,
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center gap-4">
            <ShoppingCart className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-orange-100 text-sm">To Buy</p>
              <p className="text-2xl font-bold">{uncheckedItems.length}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center gap-4">
            <Check className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-green-100 text-sm">Done</p>
              <p className="text-2xl font-bold">{checkedItems.length}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center gap-4">
            <ChefHat className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-purple-100 text-sm">From Recipes</p>
              <p className="text-2xl font-bold">{recipeItems.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recipe Vault Link */}
      {isConnected && (
        <Card className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50" hover={false}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="w-6 h-6 text-purple-600" />
              <div>
                <p className="font-medium text-slate-800">Add items from recipes</p>
                <p className="text-sm text-slate-500">Go to Recipe Vault to add ingredients to this list</p>
              </div>
            </div>
            <a
              href="https://recipe-vault.vercel.app/shopping-list"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
            >
              Open Recipe Vault
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </Card>
      )}

      {/* Shopping List by Category */}
      {sortedCategories.length > 0 ? (
        <div className="space-y-4">
          {sortedCategories.map(category => {
            const categoryItems = groupedItems[category].filter(i => !i.is_checked)
            if (categoryItems.length === 0) return null

            const config = getCategoryConfig(category)

            return (
              <Card key={category} hover={false}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{config.emoji}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </span>
                  <span className="text-sm text-slate-500">{categoryItems.length} items</span>
                </div>
                <div className="space-y-2">
                  {categoryItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                      <button
                        onClick={() => toggleItem(item.id)}
                        className="w-6 h-6 rounded-lg border-2 border-slate-300 hover:border-green-500 transition-colors flex items-center justify-center flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">{item.item_name}</p>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          {item.quantity && (
                            <span>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
                          )}
                          {item.recipe_name && (
                            <span className="flex items-center gap-1 text-purple-600">
                              <ChefHat className="w-3 h-3" />
                              {item.recipe_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
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
        <Card className="mt-6" hover={false}>
          <CardHeader title={`Completed (${checkedItems.length})`} icon={<Check className="w-5 h-5" />} />
          <div className="space-y-2">
            {checkedItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-green-50 group"
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-6 h-6 rounded-lg bg-green-500 text-white flex items-center justify-center flex-shrink-0"
                >
                  <Check className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-400 line-through truncate">{item.item_name}</p>
                  {item.quantity && (
                    <p className="text-sm text-slate-400">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
