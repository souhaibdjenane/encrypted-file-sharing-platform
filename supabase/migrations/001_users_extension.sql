-- Migration 001: Enable pgcrypto extension
-- Provides gen_random_uuid() and cryptographic helpers used by other migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
