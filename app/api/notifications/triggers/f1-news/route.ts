import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// F1 News notification trigger
// Cron schedule: "*/30 * * * *" (every 30 minutes)
// Sends push notifications for new AI-filtered interesting F1 news

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

interface NotificationPrefs {
  user_id: string;
  f1_enabled: boolean;
  f1_news_enabled: boolean;
  f1_news_ai_curated: boolean;
  f1_spoiler_free: boolean;
  f1_news_race_category: boolean;
  f1_news_driver_category: boolean;
  f1_news_technical_category: boolean;
  f1_news_calendar_category: boolean;
  f1_favorite_driver: string | null;
}

// Category to emoji and description
const CATEGORY_INFO: Record<string, { emoji: string; prefix: string }> = {
  race: { emoji: '🏁', prefix: 'RACE NEWS' },
  driver: { emoji: '👤', prefix: 'DRIVER NEWS' },
  technical: { emoji: '🔧', prefix: 'TECH UPDATE' },
  calendar: { emoji: '📅', prefix: 'CALENDAR' },
  other: { emoji: '📰', prefix: 'F1 NEWS' },
};

// Check if article mentions a specific driver
function mentionsDriver(article: F1NewsItem, driverName: string | null): boolean {
  if (!driverName) return false;

  const searchName = driverName.toLowerCase();
  const title = article.title.toLowerCase();
  const desc = article.description.toLowerCase();

  return title.includes(searchName) || desc.includes(searchName);
}

// Truncate text to length with ellipsis
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Log that this trigger was called (for debugging cron execution)
  try {
    await supabase.from('notification_log').insert({
      user_id: null,
      category: 'cron_execution',
      notification_type: 'f1_news_trigger',
      title: 'F1 News Trigger Called',
      body: `Triggered at ${new Date().toISOString()}`,
      data: { source: request.headers.get('user-agent') || 'unknown' },
    });
  } catch {} // Ignore errors

  // Note: Auth is handled by middleware (CRON_ROUTES)

  try {
    // Fetch latest news from F1 news API
    const newsRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/f1/news`
    );

    if (!newsRes.ok) {
      console.log('Failed to fetch F1 news');
      return NextResponse.json({ error: 'Failed to fetch F1 news' }, { status: 500 });
    }

    const newsData = await newsRes.json();
    const articles: F1NewsItem[] = newsData.items || [];

    if (articles.length === 0) {
      return NextResponse.json({ message: 'No F1 news articles', count: 0 });
    }

    // Get users with F1 news notifications enabled
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, f1_enabled, f1_news_enabled, f1_news_ai_curated, f1_spoiler_free, f1_news_race_category, f1_news_driver_category, f1_news_technical_category, f1_news_calendar_category, f1_favorite_driver')
      .eq('f1_enabled', true)
      .eq('f1_news_enabled', true);

    if (prefsError || !prefs || prefs.length === 0) {
      return NextResponse.json({ message: 'No users with F1 news enabled', count: 0 });
    }

    // Get notification states to find last notified article per user
    const userIds = prefs.map(p => p.user_id);
    const { data: states } = await supabase
      .from('f1_notification_state')
      .select('user_id, last_news_article_id, last_news_check')
      .in('user_id', userIds);

    const stateMap = new Map((states || []).map(s => [s.user_id, s]));

    let sentCount = 0;
    const results: { user_id: string; article: string; sent: boolean; detail?: any; reason?: string }[] = [];

    for (const pref of prefs) {
      const state = stateMap.get(pref.user_id);
      const lastNewsCheck = state?.last_news_check ? new Date(state.last_news_check) : null;

      // Find articles to notify about (only articles published AFTER last check)
      const articlesToNotify: F1NewsItem[] = [];

      for (const article of articles) {
        // Skip if not interesting (AI filtered)
        if (!article.isInteresting) continue;

        // Skip if article is older than last check (already notified)
        if (lastNewsCheck && article.pubDate) {
          const articleDate = new Date(article.pubDate);
          if (articleDate <= lastNewsCheck) continue;
        }

        // Skip spoilers if user has spoiler-free mode
        if (pref.f1_spoiler_free && article.isSpoiler) continue;

        // If AI-curated is enabled, skip category filtering (notify for all interesting articles)
        // Otherwise, check category preferences
        if (!pref.f1_news_ai_curated) {
          const category = article.category || 'other';
          const wantsCategory = (
            (category === 'race' && pref.f1_news_race_category) ||
            (category === 'driver' && pref.f1_news_driver_category) ||
            (category === 'technical' && pref.f1_news_technical_category) ||
            (category === 'calendar' && pref.f1_news_calendar_category) ||
            (category === 'other')
          );

          if (!wantsCategory) continue;
        }

        articlesToNotify.push(article);

        // Limit to 3 articles per check to avoid notification spam
        if (articlesToNotify.length >= 3) break;
      }

      if (articlesToNotify.length === 0) continue;

      // Send notification for each article (or combine if multiple)
      if (articlesToNotify.length === 1) {
        const article = articlesToNotify[0];
        const catInfo = CATEGORY_INFO[article.category || 'other'];

        // Build rich notification
        let title = `${catInfo.emoji} ${catInfo.prefix}`;
        let body = article.title;

        // Check if mentions favorite driver
        if (mentionsDriver(article, pref.f1_favorite_driver)) {
          const driverName = pref.f1_favorite_driver!.charAt(0).toUpperCase() + pref.f1_favorite_driver!.slice(1);
          title = `${catInfo.emoji} ${driverName.toUpperCase()} NEWS`;
        }

        // Add description preview
        if (article.description && article.description.length > 0) {
          body = truncate(article.title, 80) + '\n' + truncate(article.description, 100);
        }

        try {
          const sendUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/notifications/send`;
          const response = await fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({
              user_id: pref.user_id,
              title,
              body,
              data: {
                type: 'f1_news',
                article_id: article.id,
                category: article.category,
                link: article.link,
                deep_link: '/f1?tab=news',
              },
            }),
          });

          const responseData = await response.json().catch(() => ({}));

          if (response.ok && responseData.sent > 0) {
            sentCount++;
            results.push({ user_id: pref.user_id, article: article.title, sent: true });
          } else {
            // Log DETAILED failure info
            console.error('F1 notification send failed:', {
              userId: pref.user_id.substring(0, 8),
              status: response.status,
              responseData,
            });

            await supabase.from('notification_log').insert({
              user_id: pref.user_id,
              category: 'cron_execution',
              notification_type: 'f1_send_failed',
              title: 'F1 Send FAILED',
              body: `Status ${response.status}: ${JSON.stringify(responseData).substring(0, 200)}`,
              data: { status: response.status, response: responseData, article: article.title },
            });

            results.push({ user_id: pref.user_id, article: article.title, sent: false, detail: responseData });
          }
        } catch (error) {
          console.error('Error sending F1 news notification:', error);
          results.push({ user_id: pref.user_id, article: article.title, sent: false });
        }
      } else {
        // Multiple articles - send summary
        const title = `📰 ${articlesToNotify.length} New F1 Stories`;
        const headlines = articlesToNotify.map(a => {
          const catEmoji = CATEGORY_INFO[a.category || 'other'].emoji;
          return `${catEmoji} ${truncate(a.title, 50)}`;
        }).join('\n');

        try {
          const sendUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/notifications/send`;
          const response = await fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({
              user_id: pref.user_id,
              title,
              body: headlines,
              data: {
                type: 'f1_news_summary',
                article_count: articlesToNotify.length,
                deep_link: '/f1?tab=news',
              },
            }),
          });

          const responseData = await response.json().catch(() => ({}));

          if (response.ok && responseData.sent > 0) {
            sentCount++;
            results.push({ user_id: pref.user_id, article: `${articlesToNotify.length} articles`, sent: true });
          } else {
            console.error('F1 summary notification send failed:', {
              userId: pref.user_id.substring(0, 8),
              status: response.status,
              responseData,
            });

            await supabase.from('notification_log').insert({
              user_id: pref.user_id,
              category: 'cron_execution',
              notification_type: 'f1_summary_send_failed',
              title: 'F1 Summary Send FAILED',
              body: `Status ${response.status}: ${JSON.stringify(responseData).substring(0, 200)}`,
              data: { status: response.status, response: responseData },
            });

            results.push({ user_id: pref.user_id, article: `${articlesToNotify.length} articles`, sent: false, detail: responseData });
          }
        } catch (error) {
          console.error('Error sending F1 news summary notification:', error);
          results.push({ user_id: pref.user_id, article: 'summary', sent: false, reason: 'exception' });
        }
      }

      // Update notification state with most recent article's pubDate
      // BUG FIX: Was using new Date() which caused articles published between
      // the most recent article and cron run time to be skipped forever
      if (articlesToNotify.length > 0) {
        const mostRecentArticlePubDate = articlesToNotify[0].pubDate;
        await supabase
          .from('f1_notification_state')
          .upsert({
            user_id: pref.user_id,
            last_news_article_id: articlesToNotify[0].id,
            last_news_check: mostRecentArticlePubDate, // Use article pubDate, not current time!
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} F1 news notifications`,
      count: sentCount,
      articlesProcessed: articles.filter(a => a.isInteresting).length,
    });

  } catch (error) {
    console.error('Error in F1 news trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
