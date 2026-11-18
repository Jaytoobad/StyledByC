CREATE TABLE IF NOT EXISTS "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL DEFAULT 0,
	"window_start" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limits_window_start_idx" ON "rate_limits" ("window_start");
