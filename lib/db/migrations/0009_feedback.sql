CREATE TABLE "feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sender_name" varchar(255) NOT NULL DEFAULT '',
  "is_anonymous" boolean NOT NULL DEFAULT false,
  "rating" integer NOT NULL DEFAULT 5,
  "content" text NOT NULL DEFAULT '',
  "type" varchar(50) NOT NULL DEFAULT 'Student -> Teacher',
  "status" varchar(30) NOT NULL DEFAULT 'Submitted',
  "subject" varchar(255) DEFAULT '',
  "batch" varchar(255) DEFAULT '',
  "category" varchar(255) DEFAULT '',
  "date" varchar(10) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
