import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NotificationPayload {
  user_id?: string; // Send to specific user
  title: string;
  body: string;
  data?: Record<string, any>; // e.g., { type: 'event_reminder', event_id: '123' }
}

export async function POST(request: NextRequest) {
  try {
    const payload: NotificationPayload = await request.json();

    if (!payload.title || !payload.body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    // Get push tokens for the target user(s)
    let query = supabase.from('push_tokens').select('token, platform');

    if (payload.user_id) {
      query = query.eq('user_id', payload.user_id);
    }

    const { data: tokens, error: tokenError } = await query;

    if (tokenError) {
      console.error('Error fetching tokens:', tokenError);
      return NextResponse.json(
        { error: 'Failed to fetch push tokens' },
        { status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { message: 'No push tokens found', sent: 0 },
        { status: 200 }
      );
    }

    // Send notifications via APNs
    // Note: This requires Apple Developer credentials
    // For now, we'll log what would be sent
    const results = await Promise.all(
      tokens.map(async ({ token, platform }) => {
        if (platform === 'ios') {
          return sendAPNsNotification(token, payload);
        }
        return { success: false, reason: 'unsupported_platform' };
      })
    );

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      message: `Sent ${successCount}/${tokens.length} notifications`,
      sent: successCount,
      total: tokens.length,
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// Send notification via Apple Push Notification service
async function sendAPNsNotification(
  deviceToken: string,
  payload: NotificationPayload
): Promise<{ success: boolean; reason?: string }> {
  // APNs configuration - requires Apple Developer credentials
  const apnsKeyId = process.env.APNS_KEY_ID;
  const apnsTeamId = process.env.APNS_TEAM_ID;
  const apnsKey = process.env.APNS_AUTH_KEY; // .p8 file contents
  const bundleId = 'com.familyhub.app';

  if (!apnsKeyId || !apnsTeamId || !apnsKey) {
    console.log('APNs not configured - would send:', {
      token: deviceToken.substring(0, 10) + '...',
      title: payload.title,
      body: payload.body,
    });
    return { success: false, reason: 'apns_not_configured' };
  }

  try {
    // Create JWT for APNs authentication
    const jwt = await createAPNsJWT(apnsKeyId, apnsTeamId, apnsKey);

    // APNs endpoint (use api.push.apple.com for production)
    const isProduction = process.env.NODE_ENV === 'production';
    const apnsHost = isProduction
      ? 'api.push.apple.com'
      : 'api.sandbox.push.apple.com';

    const response = await fetch(
      `https://${apnsHost}/3/device/${deviceToken}`,
      {
        method: 'POST',
        headers: {
          'authorization': `bearer ${jwt}`,
          'apns-topic': bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
        },
        body: JSON.stringify({
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            sound: 'default',
            badge: 1,
          },
          ...payload.data,
        }),
      }
    );

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.json();
      console.error('APNs error:', error);
      return { success: false, reason: error.reason };
    }
  } catch (error) {
    console.error('APNs request failed:', error);
    return { success: false, reason: 'request_failed' };
  }
}

// Create JWT for APNs authentication
async function createAPNsJWT(
  keyId: string,
  teamId: string,
  privateKey: string
): Promise<string> {
  // JWT header
  const header = {
    alg: 'ES256',
    kid: keyId,
  };

  // JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
  };

  // Note: In production, use a proper JWT library like jose
  // This is a simplified version for illustration
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));

  // For actual implementation, you'd sign with the private key
  // Using ES256 algorithm with the .p8 key from Apple
  // Consider using the 'jose' npm package for this

  return `${encodedHeader}.${encodedPayload}.signature`;
}
