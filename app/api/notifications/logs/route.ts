import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  // Create authenticated client to get current user
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Create service client for admin queries
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get query params
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const category = searchParams.get('category');

  // Build query
  let query = supabase
    .from('notification_log')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('category', category);
  }

  const { data: logs, error: logsError } = await query;

  if (logsError) {
    console.error('Error fetching notification logs:', logsError);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }

  // Format logs for display
  const formattedLogs = (logs || []).map(log => ({
    id: log.id,
    category: log.category,
    type: log.notification_type,
    title: log.title,
    body: log.body,
    data: log.data,
    created_at: log.created_at,
    // Parse created_at for display
    time: new Date(log.created_at).toLocaleTimeString(),
    date: new Date(log.created_at).toLocaleDateString(),
  }));

  // Get category counts
  const { data: categoryCounts } = await supabase
    .from('notification_log')
    .select('category')
    .eq('user_id', user.id);

  const counts: Record<string, number> = {};
  (categoryCounts || []).forEach(log => {
    counts[log.category] = (counts[log.category] || 0) + 1;
  });

  return NextResponse.json({
    logs: formattedLogs,
    total: formattedLogs.length,
    category_counts: counts,
    fetched_at: new Date().toISOString(),
  });
}
