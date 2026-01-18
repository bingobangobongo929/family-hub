# Security Fixes Log

Started: 2026-01-18
Status: NEARLY COMPLETE (18/19 fixes done, 1 requires infrastructure)

## Critical Fixes

- [x] 1. Upgrade Next.js to 14.2.35+ (CVE fix)
- [x] 2. Fix API routes user_id authorization bypass
- [x] 3. Fix OAuth state parameter CSRF vulnerability
- [x] 4. Fix token encryption in google-calendar/sync
- [x] 5. Fix token decryption in google-calendar/sync

## High Priority Fixes

- [x] 6. Add centralized middleware for auth
- [x] 7. Fix cron auth to work in all environments
- [x] 8. Add auth to calendar-ai route
- [x] 9. Fix service role RLS policies
- [x] 10. Add image size validation to calendar-ai
- [x] 11. Fix deprecated session pattern in OAuth callback

## Medium Priority Fixes

- [x] 12. Remove debug info from error responses
- [ ] 13. Add rate limiting (requires Upstash Redis or similar)
- [x] 14. Fix ReDoS potential in RSS parser (reviewed - patterns are safe)
- [x] 15. Fix routine_members RLS policy reference (migration 017 already applied)
- [x] 16. Remove demo password from notes page

## Low Priority Fixes

- [x] 17. Move hardcoded bundle ID to env var
- [x] 18. Add ENCRYPTION_KEY validation at startup
- [x] 19. Add HTTPS enforcement for OAuth redirects

---

## Progress Log

### Session 1 - 2026-01-18

**02:25** - Upgraded Next.js from 14.2.21 to 14.2.35
- Fixes CVE with CVSS 9.1 (authorization bypass)
- Fixes 2 DoS vulnerabilities (CVSS 7.5)
- Remaining 2 high vulns are tar package (Capacitor transitive dep)

**02:30** - Created centralized middleware (middleware.ts)
- Authenticates all API routes via Supabase SSR
- Validates user_id parameters match authenticated user
- Cron routes require auth in ALL environments (not just production)
- Adds x-authenticated-user-id header for routes

**02:35** - Fixed google-calendar/sync route
- Added encryption import
- Decrypt tokens when reading from DB
- Encrypt tokens when storing after refresh
- Use authenticated user from middleware header

**02:40** - Fixed google-photos routes
- photos/route.ts - use authenticated user from middleware
- albums/route.ts - use authenticated user + removed debug info from errors

**02:45** - Created secure OAuth state system
- lib/oauth-state.ts - generates signed JWT state tokens with nonce
- Prevents CSRF attacks on OAuth flows
- 10 minute expiration on state tokens

**02:50** - Fixed all OAuth routes to use secure state
- google-photos/auth/route.ts - use generateOAuthState()
- google-photos/callback/route.ts - verify state with verifyOAuthState()
- google-calendar/auth/route.ts - use generateOAuthState()
- google-calendar/callback/route.ts - verify state with verifyOAuthState()
- Removed deprecated cookie-based auth from calendar callback

### Session 2 - 2026-01-18 (continued)

**Continuing** - Completed remaining security fixes

- Moved hardcoded bundle ID to env var (APNS_BUNDLE_ID) in notifications/send/route.ts
- Added HTTPS enforcement for OAuth redirects (getSecureRedirectUri() in lib/oauth-state.ts)
- Updated all OAuth auth/callback routes to use secure redirect URIs
- Removed error message leaks from:
  - google-photos/callback/route.ts
  - google-photos/albums/route.ts
  - calendar-ai/route.ts
- Created migration 020_fix_f1_news_rls.sql to fix overly permissive RLS policy
- Reviewed RSS parser regex patterns - no ReDoS vulnerability (patterns are bounded)
- Verified routine_members RLS fix already in migration 017

**Remaining:**
- Rate limiting requires external infrastructure (Upstash Redis recommended)

