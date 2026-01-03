# Cloud Sync & Database Plan

## Goal Description
Implement cloud data synchronization using Supabase. Persist user progress, settings, and analytics to the cloud so users can access their learning state across multiple devices.

## User Review Required
-   **Schema**: Review the proposed SQL schema (JSONB blob for progress).
-   **Migration**: Confirm if existing local data should be merged or overwritten by cloud data (default: cloud wins if newer).

## Proposed Changes

### Database (Supabase)
#### [NEW] [cloud_sync_schema.sql](file:///Users/tanzeel/.gemini/antigravity/brain/673f0815-a86a-4a93-a895-b00be147ec1e/cloud_sync_schema.sql)
-   Create `profiles` table: `id` (FK to auth.users), `email`, `last_updated`.
-   Create `user_data` table: `user_id` (FK), `data` (JSONB), `updated_at`.
-   Enable RLS (Row Level Security) so users can only access their own rows.
-   Create trigger to auto-create profile on signup.

### Application Logic
#### [MODIFY] [app.js](file:///Users/tanzeel/.gemini/antigravity/playground/C_learner/app.js)
-   Update `App.Storage`:
    -   Add `sync()` method.
    -   Call `sync()` on `initApp` (pull) and periodically/on-save (push).

#### [MODIFY] [auth.js](file:///Users/tanzeel/.gemini/antigravity/playground/C_learner/auth.js)
-   Trigger a data pull when user logs in (`updateUser`).

## Verification Plan
### Automated Tests
-   Verify JSONB read/write via Supabase JS client.

### Manual Verification
1.  **Login**: User logs in -> existing cloud data populates the dashboard.
2.  **Progress**: User completes a unit -> data is saved to Supabase (check Table Editor).
3.  **Cross-Device**: User logs in on another browser -> sees same progress.
