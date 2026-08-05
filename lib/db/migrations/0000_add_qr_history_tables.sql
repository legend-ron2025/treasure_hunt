-- Migration: add QR history tables only.

CREATE TABLE IF NOT EXISTS registration_qr_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  qr_url text NOT NULL,
  styled_qr_png bytea,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS stage_qr_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  stage_number smallint NOT NULL,
  qr_url text NOT NULL,
  styled_qr_card_png bytea,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT chk_stage_number_hist CHECK (stage_number BETWEEN 1 AND 5)
);
