import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors when env vars are not set
let _supabase: SupabaseClient | null = null
let _recipeVaultSupabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables not configured')
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _supabase
}

function getRecipeVaultSupabase(): SupabaseClient {
  if (!_recipeVaultSupabase) {
    const recipeVaultUrl = process.env.NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_URL
    const recipeVaultAnonKey = process.env.NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_ANON_KEY
    if (!recipeVaultUrl || !recipeVaultAnonKey) {
      throw new Error('Recipe Vault Supabase environment variables not configured')
    }
    _recipeVaultSupabase = createClient(recipeVaultUrl, recipeVaultAnonKey)
  }
  return _recipeVaultSupabase
}

// Family Hub's own database (family data, calendar, chores, etc.)
// Using Proxy for lazy initialization - client is only created when actually used
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabase()
    const value = client[prop as keyof SupabaseClient]
    // Bind methods to the client instance
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})

// Recipe Vault database (for shopping list two-way sync)
export const recipeVaultSupabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getRecipeVaultSupabase()
    const value = client[prop as keyof SupabaseClient]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})
