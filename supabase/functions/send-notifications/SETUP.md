# Push Notifications Setup Guide

This Edge Function sends push notifications for routines, calendar events, tasks, birthdays, and F1 sessions.

## Step 1: Get Your APNs Key from Apple

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
2. Click **Keys** → **Create a Key**
3. Name it "Family Hub Push Notifications"
4. Check **Apple Push Notifications service (APNs)**
5. Click **Continue** → **Register**
6. **Download the .p8 file** (you can only download once!)
7. Note down:
   - **Key ID** (shown on the key page, e.g., "ABC123DEFG")
   - **Team ID** (from your account page, e.g., "TEAM123456")

## Step 2: Add Secrets to Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Add these secrets:

| Secret Name | Value |
|------------|-------|
| `APNS_KEY_ID` | Your Key ID from Step 1 (e.g., `ABC123DEFG`) |
| `APNS_TEAM_ID` | Your Team ID from Step 1 (e.g., `TEAM123456`) |
| `APNS_PRIVATE_KEY` | Contents of your .p8 file (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) |
| `CRON_SECRET` | Generate a random string (e.g., `openssl rand -hex 32`) |

### How to get the private key content:

Open the .p8 file in a text editor. It looks like:
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
...several lines...
-----END PRIVATE KEY-----
```

Copy the **entire contents** including the BEGIN and END lines.

## Step 3: Deploy the Edge Function

Run this from your project root:

```bash
npx supabase functions deploy send-notifications --project-ref YOUR_PROJECT_REF
```

Or via the Supabase CLI:
```bash
supabase functions deploy send-notifications
```

## Step 4: Set Up the Cron Schedule

### Option A: Supabase Dashboard (Recommended)

1. Go to **Database** → **Cron Jobs** (or SQL Editor)
2. Create a new cron job:

```sql
SELECT cron.schedule(
  'send-notifications-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notifications',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_CRON_SECRET` with the CRON_SECRET you set in Step 2

### Option B: Manual Testing

Test the function manually:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notifications' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

## Step 5: Verify It Works

1. Set a routine with a `scheduled_time` a few minutes in the future
2. Make sure you have push notifications enabled in the app
3. Wait for the cron to run (or trigger manually)
4. Check the `notification_log` table for results:

```sql
SELECT * FROM notification_log ORDER BY sent_at DESC LIMIT 10;
```

## Notification Types

| Type | Trigger |
|------|---------|
| Routine reminders | At scheduled_time on applicable days |
| Calendar events | 15min, 30min, or 1h before (based on prefs) |
| Task due | 8 AM on due date |
| Birthdays | 9 AM, 3 days before and day-of |
| F1 sessions | 15min and 1h before race/quali/sprint |

## Troubleshooting

### Notifications not sending?

1. Check `notification_log` for errors:
   ```sql
   SELECT * FROM notification_log WHERE status = 'failed' ORDER BY sent_at DESC;
   ```

2. Check that push tokens exist:
   ```sql
   SELECT * FROM push_tokens;
   ```

3. Verify notification preferences:
   ```sql
   SELECT * FROM notification_preferences;
   ```

4. Check Edge Function logs in Supabase Dashboard → Edge Functions → Logs

### APNs errors?

- `BadDeviceToken`: The device token is invalid or expired
- `Unregistered`: User uninstalled the app
- `BadCertificate`: Check your APNS_PRIVATE_KEY secret

## Cost

- Supabase free tier: 500,000 Edge Function invocations/month
- Running every 5 minutes = ~8,640 invocations/month
- **Total cost: $0** (well within free tier)
