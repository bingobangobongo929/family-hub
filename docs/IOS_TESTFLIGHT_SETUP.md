# iOS TestFlight Setup Guide

This guide walks you through setting up automated TestFlight builds via GitHub Actions.

## Overview

When you push to master, GitHub will:
1. Build the iOS app on a Mac runner
2. Sign it with your Apple certificates
3. Upload to TestFlight automatically

You'll then get the app on your iPhone via the TestFlight app (no cable needed!).

---

## Step 1: Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Family Hub
   - **Primary Language**: English
   - **Bundle ID**: com.familyhub.app (select or create)
   - **SKU**: familyhub001 (any unique string)
4. Click **Create**

---

## Step 2: Create App Store Connect API Key

This allows GitHub to upload to TestFlight without needing your password.

1. Go to [App Store Connect → Users and Access → Keys](https://appstoreconnect.apple.com/access/api)
2. Click **+** to create a new key
3. Fill in:
   - **Name**: GitHub Actions
   - **Access**: App Manager (or Admin)
4. Click **Generate**
5. **IMPORTANT**: Download the .p8 file immediately (you can only download once!)
6. Note down:
   - **Key ID**: Shown in the table (e.g., ABC123XYZ)
   - **Issuer ID**: Shown at top of page (e.g., 12345678-abcd-1234-abcd-123456789012)

---

## Step 3: Create Distribution Certificate

1. Go to [Apple Developer → Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Click **+** to create new certificate
3. Select **Apple Distribution** → Continue
4. You'll need a Certificate Signing Request (CSR):
   - On a Mac: Open **Keychain Access** → Certificate Assistant → Request a Certificate
   - If no Mac: Use an online CSR generator or I can help with alternatives
5. Upload CSR, download the certificate (.cer)
6. Double-click to install in Keychain
7. In Keychain, find it under "My Certificates"
8. Right-click → **Export** → Save as .p12 file with a password

---

## Step 4: Create Provisioning Profile

1. Go to [Apple Developer → Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Click **+** to create new profile
3. Select **App Store** (under Distribution) → Continue
4. Select your App ID (com.familyhub.app) → Continue
5. Select your Distribution Certificate → Continue
6. Name it: "Family Hub App Store"
7. Download the .mobileprovision file

---

## Step 5: Add Secrets to GitHub

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret Name | Value |
|------------|-------|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_TEAM_ID` | Your Team ID (found in [Membership](https://developer.apple.com/account/#/membership)) |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID from Step 2 |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from Step 2 |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | Base64 of your .p8 file (see below) |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | Base64 of your .p12 file (see below) |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | Password you set when exporting .p12 |
| `KEYCHAIN_PASSWORD` | Any random password (e.g., "githubactions123") |

### How to Base64 encode files:

**On Windows (PowerShell):**
```powershell
# For the .p8 API key:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\AuthKey_XXXXX.p8")) | Set-Clipboard

# For the .p12 certificate:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\Certificates.p12")) | Set-Clipboard
```

**On Mac/Linux:**
```bash
base64 -i AuthKey_XXXXX.p8 | pbcopy
base64 -i Certificates.p12 | pbcopy
```

---

## Step 6: Trigger the Build

Two ways:

1. **Push to master** - Any change to app code triggers a build
2. **Manual trigger** - Go to Actions → "iOS TestFlight Build" → "Run workflow"

---

## Step 7: Get the App on Your iPhone

1. Download **TestFlight** from the App Store on your iPhone
2. Sign in with the same Apple ID
3. The build will appear after processing (5-15 minutes)
4. Tap **Install**

---

## Troubleshooting

### "No profiles for 'com.familyhub.app' were found"
- Make sure the Bundle ID matches exactly
- Regenerate provisioning profile

### "Code signing error"
- Check certificate hasn't expired
- Ensure provisioning profile uses the correct certificate

### Build stuck or failed
- Check the Actions tab for detailed logs
- Most issues are certificate/profile related

---

## Adding Family Members as Testers

1. App Store Connect → Your App → TestFlight
2. Click **+** next to "Internal Testing"
3. Add email addresses
4. They'll get an invite to download TestFlight

---

## Need Help?

The trickiest part is getting certificates right. If you get stuck on Step 3-4, let me know and I can help with alternatives!
