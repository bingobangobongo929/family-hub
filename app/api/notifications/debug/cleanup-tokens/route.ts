import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Debug endpoint to clean up stale push tokens
 * Keeps only the most recent token per user
 *
 * GET /api/notifications/debug/cleanup-tokens - show what would be deleted
 * POST /api/notifications/debug/cleanup-tokens - actually delete old tokens
 */

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all tokens grouped by user
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('id, user_id, token, platform, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by user
  const byUser = new Map<string, typeof tokens>();
  for (const token of tokens || []) {
    const existing = byUser.get(token.user_id) || [];
    existing.push(token);
    byUser.set(token.user_id, existing);
  }

  // Find duplicates (anything except the newest per user)
  const toKeep: any[] = [];
  const toDelete: any[] = [];

  for (const [userId, userTokens] of byUser) {
    // Keep only the newest token
    toKeep.push(userTokens[0]);
    toDelete.push(...userTokens.slice(1));
  }

  return NextResponse.json({
    total_tokens: tokens?.length || 0,
    users: byUser.size,
    to_keep: toKeep.map(t => ({
      user_id: t.user_id.substring(0, 8) + '...',
      token: t.token.substring(0, 15) + '...',
      platform: t.platform,
      created_at: t.created_at,
    })),
    to_delete: toDelete.map(t => ({
      id: t.id,
      user_id: t.user_id.substring(0, 8) + '...',
      token: t.token.substring(0, 15) + '...',
      platform: t.platform,
      created_at: t.created_at,
    })),
    action: 'Use POST to delete old tokens',
  });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all tokens grouped by user
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('id, user_id, token, platform, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by user
  const byUser = new Map<string, typeof tokens>();
  for (const token of tokens || []) {
    const existing = byUser.get(token.user_id) || [];
    existing.push(token);
    byUser.set(token.user_id, existing);
  }

  // Find IDs to delete (anything except the newest per user)
  const idsToDelete: string[] = [];
  for (const [userId, userTokens] of byUser) {
    // Delete all except the newest
    for (let i = 1; i < userTokens.length; i++) {
      idsToDelete.push(userTokens[i].id);
    }
  }

  if (idsToDelete.length === 0) {
    return NextResponse.json({ message: 'No duplicates to delete', deleted: 0 });
  }

  // Delete old tokens
  const { error: deleteError } = await supabase
    .from('push_tokens')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Deleted ${idsToDelete.length} old tokens`,
    deleted: idsToDelete.length,
    kept: byUser.size,
  });
}
