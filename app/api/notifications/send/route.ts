import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SignJWT, importPKCS8 } from 'jose';
import * as http2 from 'http2';

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
