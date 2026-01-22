import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SignJWT, importPKCS8 } from 'jose';
import * as http2 from 'http2';
import webpush from 'web-push';

interface NotificationPayload {
  user_id?: string; // Send to specific user
  title: string;
  body: string;
  data?: Record<string, any>; // e.g., { type: 'event_reminder', event_id: '123' }
}

interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// VAPID configuration - initialized lazily at runtime
let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@familyhub.app';

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      vapidConfigured = true;
      return true;
    } catch (e) {
      console.error('Failed to configure VAPID:', e);
      return false;
    }
  }
  return false;
}

// Cache the JWT to avoid regenerating it for every notification
// APNs tokens are valid for 1 hour, we'll regenerate after 50 minutes
let cachedJwt: { token: string; expiry: number } | null = null;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // Log ALL incoming requests to the send endpoint
  console.log(`[SEND-${requestId}] Notification send request received from: ${request.headers.get('user-agent') || 'unknown'}`);

  // Initialize Supabase at runtime (not build time)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(`[SEND-${requestId}] Missing Supabase config!`);
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload: NotificationPayload = await request.json();

    // Log the payload (truncated for security)
    console.log(`[SEND-${requestId}] Payload:`, {
      user_id: payload.user_id?.substring(0, 8) + '...',
      title: payload.title?.substring(0, 50),
      has_body: !!payload.body,
      data_type: payload.data?.type,
    });

    if (!payload.title || !payload.body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    // Get push tokens for the target user(s)
    let query = supabase.from('push_tokens').select('token, platform, web_subscription');

    if (payload.user_id) {
      query = query.eq('user_id', payload.user_id);
    }

    const { data: tokens, error: tokenError } = await query;

    console.log(`[SEND-${requestId}] Token query result:`, {
      tokenCount: tokens?.length || 0,
      error: tokenError?.message || null,
      platforms: tokens?.map(t => t.platform),
    });

    if (tokenError) {
      console.error(`[SEND-${requestId}] Error fetching tokens:`, tokenError);
      return NextResponse.json(
        { error: 'Failed to fetch push tokens' },
        { status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log(`[SEND-${requestId}] No tokens found for user`);
      return NextResponse.json(
        { message: 'No push tokens found', sent: 0 },
        { status: 200 }
      );
    }

    // Send notifications via APNs (iOS) or Web Push
    const results = await Promise.all(
      tokens.map(async ({ token, platform, web_subscription }) => {
        if (platform === 'ios') {
          return sendAPNsNotification(token, payload);
        } else if (platform === 'web' && web_subscription) {
          return sendWebPushNotification(web_subscription as WebPushSubscription, payload);
        }
        return { success: false, reason: 'unsupported_platform' };
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success);

    const duration = Date.now() - startTime;
    console.log(`[SEND-${requestId}] Complete in ${duration}ms:`, {
      sent: successCount,
      total: tokens.length,
      failures: failures.length > 0 ? failures : 'none',
    });

    // Log to database for visibility in debug page
    try {
      await supabase.from('notification_log').insert({
        user_id: payload.user_id || null,
        category: 'cron_execution',
        notification_type: 'send_endpoint_result',
        title: `Send: ${successCount}/${tokens.length}`,
        body: payload.title?.substring(0, 100),
        data: {
          request_id: requestId,
          duration_ms: duration,
          sent: successCount,
          total: tokens.length,
          failures: failures,
          data_type: payload.data?.type,
        },
      });
    } catch {} // Ignore logging errors

    return NextResponse.json({
      message: `Sent ${successCount}/${tokens.length} notifications`,
      sent: successCount,
      total: tokens.length,
      failures: failures.length > 0 ? failures : undefined,
    });

  } catch (error) {
    console.error(`[SEND-${requestId}] Exception:`, error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// Send notification via Apple Push Notification service using HTTP/2
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
      bundleId,
      isProduction,
    });

    // Use HTTP/2 for APNs (required by Apple)
    const result = await sendHttp2Request(apnsHost, deviceToken, jwt, bundleId, payload);
    return result;

  } catch (error) {
    console.error('APNs request failed:', error);
    return { success: false, reason: 'request_failed' };
  }
}

// HTTP/2 request to APNs
function sendHttp2Request(
  apnsHost: string,
  deviceToken: string,
  jwt: string,
  bundleId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const client = http2.connect(`https://${apnsHost}`);

    client.on('error', (err) => {
      console.error('HTTP/2 connection error:', err);
      client.close();
      resolve({ success: false, reason: 'connection_error' });
    });

    const body = JSON.stringify({
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: 'default',
        badge: 1,
      },
      ...payload.data,
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': '0',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    });

    let responseData = '';
    let statusCode = 0;

    req.on('response', (headers) => {
      statusCode = headers[':status'] as number;
    });

    req.on('data', (chunk) => {
      responseData += chunk;
    });

    req.on('end', () => {
      client.close();

      if (statusCode === 200) {
        console.log('APNs notification sent successfully');
        resolve({ success: true });
      } else {
        let errorReason = 'unknown';
        try {
          const errorJson = JSON.parse(responseData);
          errorReason = errorJson.reason || 'unknown';
        } catch {
          errorReason = responseData || `status_${statusCode}`;
        }
        console.error('APNs error:', statusCode, errorReason);
        resolve({ success: false, reason: errorReason });
      }
    });

    req.on('error', (err) => {
      console.error('HTTP/2 request error:', err);
      client.close();
      resolve({ success: false, reason: 'request_error' });
    });

    req.write(body);
    req.end();
  });
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

// Send notification via Web Push
async function sendWebPushNotification(
  subscription: WebPushSubscription,
  payload: NotificationPayload
): Promise<{ success: boolean; reason?: string }> {
  if (!ensureVapidConfigured()) {
    console.log('Web Push not configured - would send:', {
      endpoint: subscription.endpoint.substring(0, 50) + '...',
      title: payload.title,
      body: payload.body,
    });
    return { success: false, reason: 'web_push_not_configured' };
  }

  try {
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: payload.data || {},
    });

    console.log('Sending Web Push notification:', {
      endpoint: subscription.endpoint.substring(0, 50) + '...',
      title: payload.title,
    });

    await webpush.sendNotification(subscription, pushPayload);

    console.log('Web Push notification sent successfully');
    return { success: true };

  } catch (error: any) {
    console.error('Web Push error:', error);

    // Handle specific web push errors
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription expired or not found - should remove from database
      return { success: false, reason: 'subscription_expired' };
    }

    return { success: false, reason: error.message || 'web_push_failed' };
  }
}
