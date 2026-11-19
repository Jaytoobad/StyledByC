-- Migration 0008: Add photo_data bytea column to booking_photos
-- Stores customer booking photos inline in Neon Postgres instead of Vercel Blob.
-- blobUrl remains nullable for backward compatibility with existing rows.

ALTER TABLE booking_photos ADD COLUMN photo_data bytea;