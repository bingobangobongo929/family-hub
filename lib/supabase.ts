import { createClient } from '@supabase/supabase-js'

// Family Hub's own database (family data, calendar, chores, etc.)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Recipe Vault database (for shopping list two-way sync)
const recipeVaultUrl = process.env.NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_URL || ''
const recipeVaultAnonKey = process.env.NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_ANON_KEY || ''

export const recipeVaultSupabase = createClient(recipeVaultUrl, recipeVaultAnonKey)
