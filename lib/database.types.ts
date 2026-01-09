// Database types matching recipe-vault's Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      shopping_lists: {
        Row: {
          id: string
          user_id: string
          name: string
          share_token: string | null
          is_shared: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          share_token?: string | null
          is_shared?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          share_token?: string | null
          is_shared?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      shopping_list_items: {
        Row: {
          id: string
          list_id: string
          item_name: string
          quantity: number | null
          unit: string | null
          category: string | null
          recipe_id: string | null
          recipe_name: string | null
          recipe_quantities: Json | null
          is_checked: boolean
          is_pantry_staple: boolean
          is_manual: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          item_name: string
          quantity?: number | null
          unit?: string | null
          category?: string | null
          recipe_id?: string | null
          recipe_name?: string | null
          recipe_quantities?: Json | null
          is_checked?: boolean
          is_pantry_staple?: boolean
          is_manual?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          item_name?: string
          quantity?: number | null
          unit?: string | null
          category?: string | null
          recipe_id?: string | null
          recipe_name?: string | null
          recipe_quantities?: Json | null
          is_checked?: boolean
          is_pantry_staple?: boolean
          is_manual?: boolean
          sort_order?: number
          created_at?: string
        }
      }
    }
  }
}

// Convenience types
export type ShoppingList = Database['public']['Tables']['shopping_lists']['Row']
export type ShoppingListItem = Database['public']['Tables']['shopping_list_items']['Row']
export type InsertShoppingListItem = Database['public']['Tables']['shopping_list_items']['Insert']

// Recipe quantity breakdown type
export interface RecipeQuantity {
  recipe_name: string
  quantity: number
  unit: string
}

// Extended item type with parsed recipe quantities
export interface ShoppingItemWithBreakdown extends ShoppingListItem {
  recipe_breakdown?: RecipeQuantity[]
}

// Category display configuration
export const CATEGORY_CONFIG: Record<string, { color: string; emoji: string }> = {
  produce: { color: 'bg-green-100 text-green-700', emoji: '🥬' },
  dairy: { color: 'bg-blue-100 text-blue-700', emoji: '🥛' },
  meat: { color: 'bg-red-100 text-red-700', emoji: '🥩' },
  seafood: { color: 'bg-cyan-100 text-cyan-700', emoji: '🐟' },
  bakery: { color: 'bg-amber-100 text-amber-700', emoji: '🍞' },
  pantry: { color: 'bg-purple-100 text-purple-700', emoji: '🥫' },
  frozen: { color: 'bg-sky-100 text-sky-700', emoji: '🧊' },
  beverages: { color: 'bg-teal-100 text-teal-700', emoji: '🥤' },
  household: { color: 'bg-slate-100 text-slate-700', emoji: '🧹' },
  health: { color: 'bg-rose-100 text-rose-700', emoji: '💊' },
  baby: { color: 'bg-pink-100 text-pink-700', emoji: '👶' },
  pet: { color: 'bg-orange-100 text-orange-700', emoji: '🐾' },
  other: { color: 'bg-gray-100 text-gray-700', emoji: '📦' },
}

export function getCategoryConfig(category: string | null) {
  const key = (category || 'other').toLowerCase()
  return CATEGORY_CONFIG[key] || CATEGORY_CONFIG.other
}
