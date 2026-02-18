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
- Video player supporting Vimeo, Google Drive, YouTube, and direct links
- Admin panel for content and episode management (bulk upload)
- Password-protected premium content with session-based unlock

## Data Models
- `content`: id, title, type (series/movie), thumb, banner, description, isLocked, password
- `episodes`: epId, contentId, epTitle, videoLink

## API Endpoints
- GET /api/content - List all content
- GET /api/content/:id - Get single content
- POST /api/content - Create content
- DELETE /api/content/:id - Delete content
- GET /api/content/:id/episodes - Get episodes for content
- POST /api/episodes - Create single episode
- POST /api/episodes/bulk - Bulk create episodes (text format: Title, Link per line)
- DELETE /api/episodes/:epId - Delete episode
- GET /api/watch/:epId - Get episode watch data (episode + parent + allEpisodes)
- POST /api/watch/:epId/unlock - Unlock premium content with password

## Pages
- `/` - Home (banner carousel + content grid)
- `/series/:id` - Series/Movie detail
- `/watch/:epId` - Video player
- `/admin` - Admin panel
