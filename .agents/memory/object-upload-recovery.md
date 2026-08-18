---
name: Object upload recovery
description: Reconnecting orphaned object-storage uploads to app records
---

The presigned upload flow creates UUID-only object paths and does not persist the original filename or an app record automatically. Orphaned uploads therefore need an admin picker that shows storage metadata and lets an operator link the existing object path to the correct episode.

**Why:** A later recovery scan found valid video objects that were still in storage but had no episode references, while their original names were unavailable.

**How to apply:** When adding upload-backed media, persist the original filename, content type, size, and the owning record together with the object path; keep a recovery view for already-orphaned objects.