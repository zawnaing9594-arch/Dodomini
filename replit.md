# Series Plus Myanmar

## Overview
A movie/series streaming platform built with React (frontend) + Express (backend) + PostgreSQL. Features a dark cinematic theme similar to Netflix, with content management, episode streaming, and password-protected premium content.

## Architecture
- **Frontend**: React + TypeScript + TailwindCSS + shadcn/ui
- **Fonts**: Inter (English) + Noto Sans Myanmar (Myanmar script) via Google Fonts
- **Backend**: Express.js with session support
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Replit Object Storage (for persistent poster uploads)
- **Routing**: wouter (frontend), Express routes (backend)
- **PWA**: Progressive Web App with service worker, installable on mobile

## Key Features
- Home page with banner carousel (admin-configurable) and content grid
- Series detail page with episode listing
- Video player supporting Vimeo, Google Drive, YouTube, Telegram, Facebook, Dailymotion, and direct links
- SRT subtitle support for direct video links
- In-app download: direct video files saved to IndexedDB for offline viewing, embedded videos bookmarked
- "My Downloads" page (/downloads) for offline video playback and bookmark management
- Download progress tracking with percentage display
- Admin panel for content and episode management (bulk upload), password-protected
- Episode editing: lock/unlock toggle, password management, title/link editing
- Episode move: move episodes between series via admin edit dialog
- Banner carousel management (select content, reorder) in admin panel
- Password-protected premium episodes with session-based unlock (per-episode locking)
- Poster upload via Replit Object Storage (persistent across redeployments)
- Short share URLs using episode ID (e.g., /e/64)
- Push notifications via Web Push API (VAPID) - notifies all subscribers when new episodes added
- New episode notifications (bell icon on home page, browser notifications)
- Auto-subscribe to push notifications when user clicks notification bell
- PWA support (installable as mobile app)
- Google Analytics integration (via GA_MEASUREMENT_ID env var)
- Google AdSense + HilltopAds monetization
- SEO: sitemap.xml, robots.txt, Open Graph, Twitter cards, Myanmar keywords
- User authentication via Replit Auth (Google, GitHub, etc.) for download access

## Data Models
- `content`: id, title, type (series/movie), poster, description, isBanner, bannerOrder
- `episodes`: epId, contentId, epTitle, videoLink, isLocked, password
- `push_subscriptions`: id, userId, endpoint, p256dh, auth, createdAt

## API Endpoints
- GET /api/content - List all content
- GET /api/content/:id - Get single content
- POST /api/content - Create content
- PATCH /api/content/:id - Update content
- DELETE /api/content/:id - Delete content
- GET /api/content/:id/episodes - Get episodes for content
- POST /api/episodes - Create single episode
- POST /api/episodes/bulk - Bulk create episodes (text format: Title, Link per line)
- PATCH /api/episodes/:epId - Update episode (lock/unlock, password, title, link, move to series) (admin-only)
- DELETE /api/episodes/:epId - Delete episode
- GET /api/watch/:epId - Get episode watch data (episode + parent + allEpisodes)
- POST /api/watch/:epId/unlock - Unlock premium content with password
- GET /api/resolve/:seriesSlug/:epSlug - Resolve slug-based URLs to episode data
- GET /api/banners - Get banner content (ordered)
- POST /api/banners/toggle - Toggle banner status (admin-only)
- POST /api/banners/reorder - Reorder banners atomically (admin-only)
- POST /api/uploads/request-url - Get presigned URL for file upload (admin-only)
- GET /objects/* - Serve uploaded files from object storage
- POST /api/admin/login - Admin login with password
- GET /api/admin/check - Check admin session
- GET /api/analytics-id - Get Google Analytics measurement ID
- GET /api/latest-episodes - Get 20 most recent episodes (for notifications)
- GET /api/vapid-public-key - Get VAPID public key for push subscriptions
- POST /api/push/subscribe - Subscribe to push notifications
- POST /api/push/unsubscribe - Unsubscribe from push notifications

## Pages
- `/` - Home (banner carousel + content grid + notification bell)
- `/series/:id` - Series/Movie detail
- `/watch/:epId` - Video player (by ID, internal)
- `/e/:epId` - Video player (short share URL, e.g. /e/64)
- `/downloads` - My Downloads (offline videos + bookmarks)
- `/:seriesSlug/:epSlug` - Video player (legacy slug-based, backward compatible)
- `/admin` - Admin panel (password-protected, default: admin123)

## Admin Access
- Admin panel accessible via subtle footer link on home page
- Access via /admin URL directly
- Password stored in ADMIN_PASSWORD env var (default: admin123)

## File Upload Flow
- Uses two-step presigned URL flow via Replit Object Storage
- Step 1: POST /api/uploads/request-url (sends file metadata, gets presigned URL)
- Step 2: PUT to presigned URL (uploads file directly to cloud storage)
- Uploaded files served via /objects/* route

## Google Analytics
- Set GA_MEASUREMENT_ID environment variable to enable tracking
- Script loads dynamically from /api/analytics-id endpoint
- No tracking if env var is not set

## PWA / Mobile App
- manifest.json in client/public/
- Service worker (sw.js) for offline caching
- Installable on Android/iOS via browser "Add to Home Screen"
