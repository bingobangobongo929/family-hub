# iOS App Setup Guide

This guide walks you through setting up Family Hub as a native iOS app with push notifications.

## Prerequisites

- [ ] Mac with Xcode installed (download from App Store)
- [ ] Apple Developer Account ($99/year) - https://developer.apple.com/programs/enroll/
- [ ] Your Vercel deployment URL

## Step 1: Update Configuration

### 1.1 Update Capacitor Config

Edit `capacitor.config.ts` and update the server URL:

```typescript
server: {
  url: 'https://YOUR-ACTUAL-VERCEL-URL.vercel.app',
  cleartext: false,
},
```

### 1.2 Update App ID (Optional)

If you want a different bundle ID, update it in `capacitor.config.ts`:

```typescript
appId: 'com.yourname.familyhub',
```

## Step 2: Apple Developer Setup

### 2.1 Create App ID

1. Go to https://developer.apple.com/account/resources/identifiers
2. Click "+" to create a new identifier
3. Select "App IDs" → Continue
4. Select "App" → Continue
5. Enter:
   - Description: `Family Hub`
   - Bundle ID: `com.familyhub.app` (or your custom ID)
6. Under Capabilities, enable:
   - [x] Push Notifications
7. Click Continue → Register

### 2.2 Create APNs Key

1. Go to https://developer.apple.com/account/resources/authkeys
2. Click "+" to create a new key
3. Enter:
   - Key Name: `Family Hub APNs`
   - [x] Apple Push Notifications service (APNs)
4. Click Continue → Register
5. **Download the .p8 file** (you can only download once!)
6. Note down the **Key ID** (shown on the page)
7. Note down your **Team ID** (shown in top right of developer portal)

### 2.3 Create Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles
2. Click "+" to create a new profile
3. Select "iOS App Development" → Continue
4. Select your App ID → Continue
5. Select your development certificates → Continue
6. Select your devices (you'll need to register your iPhone first) → Continue
7. Name it `Family Hub Development` → Generate
8. Download the profile

### 2.4 Register Your Device

1. Go to https://developer.apple.com/account/resources/devices
2. Click "+" to add a device
3. Enter your device name and UDID
   - To find UDID: Connect iPhone to Mac → Open Finder → Select iPhone → Click on "iPhone" text below image to cycle through info until you see "UDID"
4. Click Continue → Register

## Step 3: Environment Variables

Add these to your Vercel project (Settings → Environment Variables):

```
APNS_KEY_ID=your_key_id_here
APNS_TEAM_ID=your_team_id_here
APNS_AUTH_KEY=contents_of_your_p8_file
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CRON_SECRET=generate_a_random_string_here
```

For the `APNS_AUTH_KEY`, paste the entire contents of the .p8 file (including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines).

## Step 4: Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Copy contents from supabase/migrations/20240115_push_tokens.sql
```

## Step 5: Build the iOS App

On your Mac, run these commands:

```bash
# Navigate to project
cd /path/to/family-hub

# Sync Capacitor
npx cap sync ios

# Open in Xcode
npx cap open ios
```

## Step 6: Configure Xcode

### 6.1 Signing

1. In Xcode, select the project in the sidebar
2. Select the "Family Hub" target
3. Go to "Signing & Capabilities" tab
4. Check "Automatically manage signing"
5. Select your Team from the dropdown
6. If prompted, let Xcode create a signing certificate

### 6.2 Add Push Notification Capability

1. In "Signing & Capabilities" tab
2. Click "+ Capability"
3. Add "Push Notifications"
4. Add "Background Modes" and check "Remote notifications"

### 6.3 Update Info.plist (if needed)

The `ios/App/App/Info.plist` should already be configured, but verify these entries exist:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

## Step 7: Install on Your iPhone

### Option A: Run from Xcode

1. Connect your iPhone via USB
2. Select your iPhone from the device dropdown in Xcode
3. Click the Play button (▶️) to build and run
4. Trust the developer on iPhone: Settings → General → VPN & Device Management → Your Developer Account → Trust

### Option B: Ad Hoc Distribution

1. In Xcode: Product → Archive
2. Once archived, click "Distribute App"
3. Select "Ad Hoc" → Next
4. Select your provisioning profile → Next
5. Export the IPA file
6. Use Apple Configurator or Finder to install the IPA on registered devices

## Step 8: Test Push Notifications

1. Open the app on your iPhone
2. Grant notification permissions when prompted
3. Test with the API:

```bash
curl -X POST https://your-vercel-url.vercel.app/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "If you see this, push notifications are working!"
  }'
```

## Troubleshooting

### Push notifications not working

1. Verify APNs credentials in Vercel environment variables
2. Check Xcode console for registration errors
3. Ensure device is registered in Apple Developer portal
4. Try removing and reinstalling the app

### App won't install

1. Verify device is registered in provisioning profile
2. Check that bundle ID matches exactly
3. Re-download and install provisioning profile

### "Untrusted Developer" error

Go to Settings → General → VPN & Device Management → Trust your developer account

## Updating the App

After making code changes:

1. Deploy to Vercel (the app loads from your server)
2. Most updates are instant - just refresh the app

For native changes (new Capacitor plugins, iOS settings):

1. Run `npx cap sync ios`
2. Rebuild in Xcode
3. Reinstall on devices

## Cron Jobs

The following scheduled tasks are set up in `vercel.json`:

| Job | Schedule | Description |
|-----|----------|-------------|
| Event Reminders | Every 15 min | Sends reminders for upcoming events |
| Bin Reminders | 7 PM daily | Reminds to put out bins for tomorrow |
| Chore Reminders | 9 AM daily | Reminds about today's chores |

Note: Vercel Cron requires a Pro or Enterprise plan.

---

## Quick Reference

| Item | Value |
|------|-------|
| Bundle ID | `com.familyhub.app` |
| Capacitor Config | `capacitor.config.ts` |
| iOS Project | `ios/App/App.xcworkspace` |
| Push Tokens Table | `push_tokens` |
