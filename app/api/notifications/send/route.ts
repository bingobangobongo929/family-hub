import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SignJWT, importPKCS8 } from 'jose';

interface NotificationPayload {
  user_id?: string; // Send to specific user
  title: string;
  body: string;
  data?: Record<string, any>; // e.g., { type: 'event_reminder', event_id: '123' }
}

// Cache the JWT to avoid regenerating it for every notification
// APNs tokens are valid for 1 hour, we'll regenerate after 50 minutes
let cachedJwt: { token: string; expiry: number } | null = null;

export async function POST(request: NextRequest) {
  // Initialize Supabase at runtime (not build time)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

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
    const results = await Promise.all(
      tokens.map(async ({ token, platform }) => {
        if (platform === 'ios') {
          return sendAPNsNotification(token, payload);
        }
        return { success: false, reason: 'unsupported_platform' };
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success);

    return NextResponse.json({
      message: `Sent ${successCount}/${tokens.length} notifications`,
      sent: successCount,
      total: tokens.length,
      failures: failures.length > 0 ? failures : undefined,
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
  const apnsKeyId = process.env.APNS_KEY_ID;
  const apnsTeamId = process.env.APNS_TEAM_ID;
  const apnsKey = process.env.APNS_PRIVATE_KEY; // .p8 file contents (PEM format)
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.familyhub.app';

  if (!apnsKeyId || !apnsTeamId || !apnsKey) {
    console.log('APNs not configured - would send:', {
      token: deviceToken.substring(0, 10) + '...',
      title: payload.title,
      body: payload.body,
    });
    return { success: false, reason: 'apns_not_configured' };
  }

  try {
    // Get or create JWT for APNs authentication
    const jwt = await getAPNsJWT(apnsKeyId, apnsTeamId, apnsKey);

    // APNs endpoint - use sandbox for development builds
    const isProduction = process.env.APNS_PRODUCTION === 'true';
    const apnsHost = isProduction
      ? 'api.push.apple.com'
      : 'api.sandbox.push.apple.com';

    console.log(`Sending APNs notification to ${apnsHost}:`, {
      token: deviceToken.substring(0, 10) + '...',
      title: payload.title,
    });

    const response = await fetch(
      `https://${apnsHost}/3/device/${deviceToken}`,
      {
        method: 'POST',
        headers: {
          'authorization': `bearer ${jwt}`,
          'apns-topic': bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-expiration': '0',
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
      console.log('APNs notification sent successfully');
      return { success: true };
    } else {
      const errorText = await response.text();
      let errorReason = 'unknown';
      try {
        const errorJson = JSON.parse(errorText);
        errorReason = errorJson.reason || 'unknown';
      } catch {
        errorReason = errorText || response.statusText;
      }
      console.error('APNs error:', response.status, errorReason);
      return { success: false, reason: errorReason };
    }
  } catch (error) {
    console.error('APNs request failed:', error);
    return { success: false, reason: 'request_failed' };
  }
}

// Get or create JWT for APNs authentication
// JWTs are cached for 50 minutes (APNs tokens valid for 60 minutes)
async function getAPNsJWT(
  keyId: string,
  teamId: string,
  privateKeyPem: string
): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 10 minute buffer)
  if (cachedJwt && cachedJwt.expiry > now) {
    return cachedJwt.token;
  }

  // Create new JWT using jose library
  // The private key from Apple is in PKCS#8 PEM format
  const privateKey = await importPKCS8(privateKeyPem, 'ES256');

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(privateKey);

  // Cache the token (valid for 50 minutes)
  cachedJwt = {
    token: jwt,
    expiry: now + 50 * 60 * 1000, // 50 minutes from now
  };

  console.log('Generated new APNs JWT token');
  return jwt;
}
