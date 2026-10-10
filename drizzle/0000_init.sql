CREATE TABLE "access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash" text NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "access_tokens_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone,
	"name" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"comment" text
);
