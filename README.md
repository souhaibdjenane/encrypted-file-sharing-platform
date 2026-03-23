# VaultShare

> **Zero-knowledge end-to-end encrypted file sharing.** Every file is encrypted in your browser using the WebCrypto API before it reaches the server. The server never sees plaintext file content, names, or metadata.

![CI](https://github.com/souhaibdjenane/encrypted-file-sharing-platform/actions/workflows/ci.yml/badge.svg)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│                                                             │
│  FileUploader ──► encrypt.worker.ts ──► AES-256-GCM         │
│       │           (Web Worker / Comlink)  ciphertext + IV   │
│       │                                                     │
│  RSA-OAEP 4096 key pair (IndexedDB, never exported in clear)│
│       │                                                     │
│  wrapFileKey(AES key, RSA-pub) ──► wrappedKey (base64)      │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
          ┌─────────────▼──────────────┐
          │    Supabase Edge Functions  │
          │  (Deno, rate-limited, JWT)  │
          │                            │
          │  upload-presign            │
          │  download-presign          │
          │  share-file                │
          │  revoke-access             │
          │  health                    │
          └──────┬──────────┬──────────┘
                 │          │
    ┌────────────▼──┐  ┌────▼──────────────┐
    │  Supabase DB  │  │ Supabase Storage  │
    │  (Postgres)   │  │ (encrypted blobs) │
    │               │  │                   │
    │  files        │  │ encrypted-files/  │
    │  file_keys    │  │   {uuid}.bin      │
    │  shares       │  └───────────────────┘
    │  audit_logs   │
    └───────────────┘
```

### Key Security Properties

| Property | Implementation |
|---|---|
| **Zero server knowledge** | Files encrypted in browser (AES-256-GCM) before upload |
| **End-to-end sharing** | File key wrapped with recipient's RSA-4096 public key in browser |
| **No shared secrets** | Each user has an independent RSA-OAEP key pair stored in IndexedDB |
| **Metadata encryption** | Filename, size, type encrypted with same AES key |
| **Key recovery** | PBKDF2 (600k SHA-256 iterations) encrypted backup, downloadable as JSON |
| **Audit trail** | All actions logged to `audit_logs` table (RLS: owners see their own) |
| **Rate limiting** | Every Edge Function rate-limited via Upstash Redis |
| **CSP** | `Content-Security-Policy` meta-tag restricts scripts, workers, and connections |

---

## Local Setup

### Prerequisites
- Node.js ≥ 20
- Supabase account + project
- Supabase CLI (`npm install -g supabase`)

### Steps

```bash
# 1. Clone
git clone https://github.com/souhaibdjenane/encrypted-file-sharing-platform.git
cd encrypted-file-sharing-platform

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Fill in your Supabase credentials (see table below)

# 4. Link Supabase and run migrations
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push

# 5. Deploy Edge Functions
npx supabase functions deploy

# 6. Set Edge Function secrets
npx supabase secrets set ALLOWED_ORIGIN=http://localhost:5173
npx supabase secrets set UPSTASH_REDIS_REST_URL=...
npx supabase secrets set UPSTASH_REDIS_REST_TOKEN=...

# 7. Start dev server
npm run dev
```

### Environment Variables

Create `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase `anon` public key |
| `VITE_SENTRY_DSN` | ⬜ | Sentry DSN (omit to disable monitoring) |

Edge Function secrets:

| Secret | Description |
|---|---|
| `ALLOWED_ORIGIN` | CORS allowed origin (`https://your-domain.com`) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

### GitHub Actions Secrets

Add in **Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_SENTRY_DSN` | Sentry DSN |
| `SUPABASE_PROJECT_REF` | Project ref (e.g. `duqbxtucdgrhwcfohfqd`) |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token |

---

## Security Model

### Key Generation (on first login)
1. Browser generates RSA-OAEP 4096-bit key pair via `crypto.subtle.generateKey`
2. Public key exported as SPKI base64, stored in Supabase `user_metadata`
3. Private key stored in browser IndexedDB — never sent to server

### File Upload
1. File type validated via magic bytes (first 12 bytes matched against known signatures)
2. `encryptFile()` runs in a **Web Worker** so the UI stays responsive
3. AES-256-GCM key generated per-file
4. File + metadata encrypted; AES key wrapped with user's RSA public key
5. Ciphertext uploaded via presigned Storage URL

### File Sharing (E2E re-encryption)
1. Owner gets recipient's public key from server
2. **Client** unwraps AES key with owner private key
3. **Client** re-wraps AES key with recipient public key
4. New `file_keys` row stored for recipient — server never sees plaintext key

### Public Share Links
- Format: `https://domain.com/s/TOKEN#key=BASE64_AES_KEY`
- The `#key=` fragment **never leaves the browser** (URL fragment semantics)
- Share can be revoked server-side at any time

---

## Pre-Launch Security Checklist

- [x] All file content encrypted before leaving browser (AES-256-GCM)
- [x] Metadata (filename, size, type) also encrypted
- [x] RSA-4096 OAEP key pairs for key wrapping
- [x] File key never transmitted in plaintext
- [x] E2E re-encryption for sharing (client-side)
- [x] Magic byte file type validation
- [x] PBKDF2 key backup with 600k iterations
- [x] Rate limiting on all Edge Functions (Upstash Redis)
- [x] RLS policies on all Supabase tables
- [x] JWT verification on all authenticated Edge Functions
- [x] Audit log for all file actions
- [x] Content-Security-Policy meta-tag
- [x] X-Frame-Options: DENY
- [x] Web Worker for encryption (UI thread isolation)
- [x] Sentry error monitoring with sensitive field scrubbing
- [x] CI: type-check + lint + test + `npm audit` on every PR
- [x] CD: automated deploy to GitHub Pages + Supabase on `main`

---

## Project Structure

```
src/
├── api/          — Supabase client, filesApi
├── assets/       — SVG icons, logo
├── components/
│   ├── auth/     — AuthGuard
│   ├── files/    — FileUploader, FileList, FileCard, DownloadButton, AuditLogPanel
│   ├── layout/   — Layout, Navbar
│   ├── sharing/  — ShareModal
│   └── ui/       — Button, Input
├── contexts/     — CryptoContext (key pair lifecycle)
├── crypto/       — keys, encrypt, decrypt, keyWrap, keyBackup, magicBytes, utils
├── hooks/        — useAuth, useUpload, useFiles, useDownload, useSharedFiles
├── pages/        — Landing, Login, Register, Dashboard, Shared, Settings, PublicShare
├── store/        — authStore, themeStore
├── workers/      — encrypt.worker.ts (Comlink)
└── lib/          — i18n, supabase client

supabase/
├── functions/    — upload-presign, download-presign, share-file, revoke-access, health
└── migrations/   — 001–006 SQL migration files

.github/
└── workflows/    — ci.yml, deploy.yml
```
