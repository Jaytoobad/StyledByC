--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_key" text NOT NULL,
	"blob_url" text NOT NULL,
	"alt_text" text,
	"mime_type" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_images_slot_key_unique" UNIQUE("slot_key")
);
