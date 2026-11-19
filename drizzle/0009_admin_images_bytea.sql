-- Migration 0009: Add photo_data bytea to site_images and image_data bytea to services
-- Stores admin site images and service images inline in Neon Postgres instead of Vercel Blob.

ALTER TABLE site_images ADD COLUMN photo_data bytea;
ALTER TABLE services ADD COLUMN image_data bytea;
