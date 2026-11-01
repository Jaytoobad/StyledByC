ALTER TABLE "admin_audit_logs" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ALTER COLUMN "actor_email" DROP NOT NULL;