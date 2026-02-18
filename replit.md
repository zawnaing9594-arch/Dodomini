# Series Plus Myanmar

## Overview
A movie/series streaming platform built with React (frontend) + Express (backend) + PostgreSQL. Features a dark cinematic theme similar to Netflix, with content management, episode streaming, and password-protected premium content.

## Architecture
- **Frontend**: React + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Express.js with session support
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend), Express routes (backend)

## Key Features
- Home page with banner carousel and content grid
- Series detail page with episode listing
- Video player supporting Vimeo, Google Drive, YouTube, Telegram, Facebook, Dailymotion, and direct links
- Admin panel for content and episode management (bulk upload), password-protected
- Password-protected premium episodes with session-based unlock (per-episode locking)
- Direct photo upload for posters (via multer)
- SEO-friendly slug-based share URLs (e.g., /shadow-warriors/episode-1)

## Data Models
- `content`: id, title, type (series/movie), poster, description
- `episodes`: epId, contentId, epTitle, videoLink, isLocked, password

## API Endpoints
- GET /api/content - List all content
- GET /api/content/:id - Get single content
- POST /api/content - Create content
- PATCH /api/content/:id - Update content
- DELETE /api/content/:id - Delete content
- GET /api/content/:id/episodes - Get episodes for content
- POST /api/episodes - Create single episode
- POST /api/episodes/bulk - Bulk create episodes (text format: Title, Link per line)
- DELETE /api/episodes/:epId - Delete episode
- GET /api/watch/:epId - Get episode watch data (episode + parent + allEpisodes)
- POST /api/watch/:epId/unlock - Unlock premium content with password
- GET /api/resolve/:seriesSlug/:epSlug - Resolve slug-based URLs to episode data
- POST /api/admin/login - Admin login with password
- GET /api/admin/check - Check admin session

## Pages
- `/` - Home (banner carousel + content grid)
- `/series/:id` - Series/Movie detail
- `/watch/:epId` - Video player (by ID)
- `/:seriesSlug/:epSlug` - Video player (by slug, for share links)
- `/admin` - Admin panel (password-protected, default: admin123)

## Admin Access
- Admin panel is hidden from regular users (no link on home page)
- Access via /admin URL directly
- Password stored in ADMIN_PASSWORD env var (default: admin123)
