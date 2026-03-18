CREATE TABLE IF NOT EXISTS "prompt_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "users"("id") ON DELETE set null,
  "session_id" text REFERENCES "sessions"("id") ON DELETE set null,
  "request_id" text,
  "endpoint" text NOT NULL,
  "original_prompt" text NOT NULL,
  "normalized_prompt" text,
  "role" text NOT NULL,
  "mode" text NOT NULL,
  "rewrite_preference" text,
  "overall_score" integer,
  "score_band" text,
  "rewrite_recommendation" text,
  "inference_data" jsonb NOT NULL,
  "response_data" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "prompt_rewrites" (
  "id" text PRIMARY KEY NOT NULL,
  "prompt_run_id" text NOT NULL REFERENCES "prompt_runs"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "position" integer NOT NULL,
  "role" text NOT NULL,
  "mode" text NOT NULL,
  "rewritten_prompt" text NOT NULL,
  "explanation" text,
  "changes" jsonb,
  "evaluation_data" jsonb,
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "prompt_runs_user_created_at_idx" ON "prompt_runs" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "prompt_runs_session_created_at_idx" ON "prompt_runs" ("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "prompt_runs_request_id_idx" ON "prompt_runs" ("request_id");
CREATE INDEX IF NOT EXISTS "prompt_rewrites_run_position_idx" ON "prompt_rewrites" ("prompt_run_id", "position");
