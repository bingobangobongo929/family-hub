'use client'

import { useState } from 'react'
import Card, { CardHeader } from '@/components/Card'
import { ShoppingCart, Plus, Trash2, Check } from 'lucide-react'

interface ShoppingItem {
  id: number
  name: string
  quantity: string
  category: string
  addedBy: string
  checked: boolean
}

const initialItems: ShoppingItem[] = [
  { id: 1, name: "Milk", quantity: "2 gallons", category: "Dairy", addedBy: "Mom", checked: false },
  { id: 2, name: "Bread", quantity: "1 loaf", category: "Bakery", addedBy: "Dad", checked: false },
  { id: 3, name: "Eggs", quantity: "1 dozen", category: "Dairy", addedBy: "Mom", checked: true },
  { id: 4, name: "Bananas", quantity: "1 bunch", category: "Produce", addedBy: "Emma", checked: false },
  { id: 5, name: "Chicken breast", quantity: "2 lbs", category: "Meat", addedBy: "Mom", checked: false },
  { id: 6, name: "Pasta", quantity: "2 boxes", category: "Pantry", addedBy: "Dad", checked: false },
  { id: 7, name: "Tomato sauce", quantity: "2 jars", category: "Pantry", addedBy: "Mom", checked: true },
  { id: 8, name: "Cereal", quantity: "2 boxes", category: "Breakfast", addedBy: "Jake", checked: false },
  { id: 9, name: "Orange juice", quantity: "1 carton", category: "Beverages", addedBy: "Emma", checked: false },
  { id: 10, name: "Cheese", quantity: "1 block", category: "Dairy", addedBy: "Dad", checked: false },
]

const categoryColors: Record<string, string> = {
  Dairy: 'bg-blue-100 text-blue-700',
  Bakery: 'bg-amber-100 text-amber-700',
  Produce: 'bg-green-100 text-green-700',
  Meat: 'bg-red-100 text-red-700',
  Pantry: 'bg-purple-100 text-purple-700',
  Breakfast: 'bg-orange-100 text-orange-700',
  Beverages: 'bg-cyan-100 text-cyan-700',
}

export default function ShoppingPage() {
  const [items, setItems] = useState(initialItems)
  const [newItem, setNewItem] = useState('')

  const toggleItem = (id: number) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  const deleteItem = (id: number) => {
    setItems(items.filter(item => item.id !== id))
  }

  const addItem = () => {
    if (newItem.trim()) {
      setItems([
        ...items,
        {
          id: Date.now(),
          name: newItem,
          quantity: "1",
          category: "Pantry",
          addedBy: "You",
          checked: false
        }
      ])
      setNewItem('')
    }
  }

  const uncheckedItems = items.filter(i => !i.checked)
  const checkedItems = items.filter(i => i.checked)

  // Group by category
  const groupedItems = uncheckedItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, ShoppingItem[]>)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Shopping List</h1>
        <p className="text-slate-500 mt-1">Keep track of what you need to buy.</p>
      </div>

      {/* Add Item */}
      <Card className="mb-6" hover={false}>
        <div className="flex gap-3">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Add an item..."
            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all"
          />
          <button
            onClick={addItem}
            className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center gap-4">
            <ShoppingCart className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-orange-100 text-sm">Items to Buy</p>
              <p className="text-2xl font-bold">{uncheckedItems.length}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center gap-4">
            <Check className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-green-100 text-sm">Items Done</p>
              <p className="text-2xl font-bold">{checkedItems.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Shopping List by Category */}
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <Card key={category} hover={false}>
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${categoryColors[category] || 'bg-slate-100 text-slate-700'}`}>
                {category}
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
                    className="w-6 h-6 rounded-lg border-2 border-slate-300 hover:border-green-500 transition-colors flex items-center justify-center"
                  >
                  </button>
                  <div className="flex-1">
                    <p className="font-medium text-slate-700">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.quantity} • Added by {item.addedBy}</p>
                  </div>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Checked Items */}
      {checkedItems.length > 0 && (
        <Card className="mt-6" hover={false}>
          <CardHeader title="Completed" icon={<Check className="w-5 h-5" />} />
          <div className="space-y-2">
            {checkedItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-green-50 group"
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-6 h-6 rounded-lg bg-green-500 text-white flex items-center justify-center"
                >
                  <Check className="w-4 h-4" />
                </button>
                <div className="flex-1">
                  <p className="font-medium text-slate-400 line-through">{item.name}</p>
                  <p className="text-sm text-slate-400">{item.quantity}</p>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
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
