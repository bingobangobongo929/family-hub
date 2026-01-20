import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// F1 Notification Debug Endpoint
// Shows why F1 news notifications might not be coming through

interface F1NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  imageUrl?: string;
  isInteresting: boolean;
  isSpoiler: boolean;
  category?: 'race' | 'driver' | 'technical' | 'calendar' | 'other';
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get user from query param, auth header, or find first F1 user
  const { searchParams } = new URL(request.url);
  let userId: string | null = searchParams.get('user_id');

  // Try auth header if no query param
  if (!userId) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
  }

  // Fallback: get first user with F1 enabled for debugging
  if (!userId) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('f1_enabled', true)
      .eq('f1_news_enabled', true)
      .limit(1);

    userId = prefs?.[0]?.user_id || null;
  }

  if (!userId) {
    return NextResponse.json({
      error: 'No user found',
      hint: 'Pass ?user_id=xxx or ensure at least one user has F1 notifications enabled'
    }, { status: 404 });
  }

  const debug: Record<string, any> = {
    timestamp: new Date().toISOString(),
    userId,
  };

  try {
    // Step 1: Check notification preferences
    if (userId) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      debug.preferences = {
        f1_enabled: prefs?.f1_enabled,
        f1_news_enabled: prefs?.f1_news_enabled,
        f1_news_ai_curated: prefs?.f1_news_ai_curated,
        f1_spoiler_free: prefs?.f1_spoiler_free,
        f1_favorite_driver: prefs?.f1_favorite_driver,
      };
    }

    // Step 2: Check notification state
    if (userId) {
      const { data: state } = await supabase
        .from('f1_notification_state')
        .select('*')
        .eq('user_id', userId)
        .single();

      debug.notificationState = {
        last_news_check: state?.last_news_check,
        last_news_check_ago: state?.last_news_check
          ? `${Math.round((Date.now() - new Date(state.last_news_check).getTime()) / 60000)} minutes ago`
          : 'never',
        last_news_article_id: state?.last_news_article_id,
      };
    }

    // Step 3: Check push token
    if (userId) {
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token, platform, created_at, updated_at')
        .eq('user_id', userId);

      debug.pushTokens = tokens?.map(t => ({
        platform: t.platform,
        token_preview: t.token?.substring(0, 20) + '...',
        created: t.created_at,
        updated: t.updated_at,
      }));
    }

    // Step 4: Fetch F1 news
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    debug.appUrl = appUrl;

    const newsRes = await fetch(`${appUrl}/api/f1/news`);
    debug.newsApiStatus = newsRes.status;

    if (newsRes.ok) {
      const newsData = await newsRes.json();
      const articles: F1NewsItem[] = newsData.items || [];

      debug.totalArticles = articles.length;
      debug.interestingArticles = articles.filter(a => a.isInteresting).length;

      // Get last check time
      const lastNewsCheck = debug.notificationState?.last_news_check
        ? new Date(debug.notificationState.last_news_check)
        : null;

      // Analyze each interesting article
      const articleAnalysis = articles
        .filter(a => a.isInteresting)
        .slice(0, 10)
        .map(article => {
          const articleDate = new Date(article.pubDate);
          const isNewerThanLastCheck = !lastNewsCheck || articleDate > lastNewsCheck;

          return {
            title: article.title.substring(0, 60) + '...',
            pubDate: article.pubDate,
            pubDate_parsed: articleDate.toISOString(),
            category: article.category,
            isSpoiler: article.isSpoiler,
            isInteresting: article.isInteresting,
            isNewerThanLastCheck,
            wouldBeSkipped: !isNewerThanLastCheck,
            reason: !isNewerThanLastCheck
              ? `pubDate (${articleDate.toISOString()}) <= lastCheck (${lastNewsCheck?.toISOString()})`
              : 'Would be sent',
          };
        });

      debug.articleAnalysis = articleAnalysis;

      // Count how many would actually be sent
      const wouldSend = articleAnalysis.filter(a => !a.wouldBeSkipped).length;
      debug.articlesWouldSend = wouldSend;
      debug.articlesSkipped = articleAnalysis.length - wouldSend;
    } else {
      debug.newsApiError = await newsRes.text();
    }

    // Step 5: Check recent notification logs
    if (userId) {
      const { data: logs } = await supabase
        .from('notification_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      debug.recentNotifications = logs?.map(l => ({
        type: l.type,
        title: l.title,
        status: l.status,
        created_at: l.created_at,
        error: l.error_message,
      }));
    }

    // Diagnosis
    debug.diagnosis = [];

    if (!debug.preferences?.f1_enabled) {
      debug.diagnosis.push('❌ F1 notifications are DISABLED in preferences');
    } else {
      debug.diagnosis.push('✅ F1 notifications enabled');
    }

    if (!debug.preferences?.f1_news_enabled) {
      debug.diagnosis.push('❌ F1 NEWS notifications are DISABLED in preferences');
    } else {
      debug.diagnosis.push('✅ F1 news notifications enabled');
    }

    if (!debug.pushTokens || debug.pushTokens.length === 0) {
      debug.diagnosis.push('❌ No push tokens registered');
    } else {
      debug.diagnosis.push(`✅ ${debug.pushTokens.length} push token(s) registered`);
    }

    if (debug.interestingArticles === 0) {
      debug.diagnosis.push('❌ No "interesting" articles from AI filter');
    } else {
      debug.diagnosis.push(`✅ ${debug.interestingArticles} interesting articles`);
    }

    if (debug.articlesWouldSend === 0 && debug.interestingArticles > 0) {
      debug.diagnosis.push('⚠️ Articles exist but ALL are older than last_news_check - this is likely the problem!');
      debug.diagnosis.push('💡 Fix: Reset your f1_notification_state or adjust the date comparison logic');
    } else if (debug.articlesWouldSend > 0) {
      debug.diagnosis.push(`✅ ${debug.articlesWouldSend} article(s) would be sent on next cron run`);
    }

    return NextResponse.json(debug);

  } catch (error) {
    debug.error = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(debug, { status: 500 });
  }
}

// Reset notification state (for debugging)
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get user from auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === 'reset_f1_state') {
    // Reset the F1 notification state to allow new notifications
    const { error } = await supabase
      .from('f1_notification_state')
      .upsert({
        user_id: user.id,
        last_news_check: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
        last_news_article_id: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'F1 notification state reset. New articles should come through on next cron run.',
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
