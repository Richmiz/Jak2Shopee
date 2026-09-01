# CatalogBridge

CatalogBridge is a responsive operations workspace for extracting JakMall product data, normalizing it, and moving it through an operator review queue before later Shopee integration.

## Local development

```bash
npm install
npm run db:init
```

Run the web app and local extractor in separate terminals:

```bash
npm run dev
```

```bash
npm run worker
```

Open [http://localhost:3000](http://localhost:3000). In development, any valid email and password of at least six characters can access the local workspace when authentication variables are not configured.

## Authentication configuration

Copy `.env.example` to `.env.local` and set all three values before a production deployment:

- `AUTH_SECRET`: a cryptographically random value of at least 32 bytes.
- `AUTH_EMAIL`: the single-operator sign-in email.
- `AUTH_PASSWORD_HASH`: a PBKDF2-SHA256 password hash in `iterations:salt:hash` format.

Generate an authentication secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Generate a password hash:

```bash
node -e "const c=require('node:crypto');const s=c.randomBytes(16).toString('hex');const i=210000;console.log(i+':'+s+':'+c.pbkdf2Sync(process.argv[1],s,i,32,'sha256').toString('hex'))" "replace-with-your-password"
```

Production sign-in fails closed when any required authentication variable is missing. Session cookies are signed, HttpOnly, SameSite=Lax, Secure in production, and use the persisted session timeout configured in Settings.

## Stage 1 local workflow

Stage 1 accepts one or up to 20 HTTPS JakMall product URLs, persists durable jobs in SQLite, extracts product data in local Chrome, validates images, detects duplicates, and saves normalized products for review. The current parser preserves exact visible stock quantities, removes adjacent storefront labels from seller SKUs, normalizes sales prefixes in titles, records its parser version, and supports in-place product refreshes when extraction rules improve. No Shopee submission is attempted.

Products can be reviewed, edited, exported to CSV, refreshed from JakMall, and deleted with confirmation. Processing history supports live status refresh, pagination, search, cancellation, bounded single or batch retry, duplicate resolution, and authenticated failure screenshots. Pricing, retry, verification, image validation, duplicate detection, concurrency, browser timeout, and session settings are persisted in SQLite and applied to newly queued jobs.

The browser worker uses adaptive mode by default: normal extraction stays in the background. If JakMall presents a legitimate human-verification screen, one temporary Chrome window opens for that verification and closes when the job finishes. The worker reuses its local browser profile, never automates CAPTCHA challenges, recovers cleanly if the window is closed, and records bounded failure evidence under `data/evidence` when extraction cannot continue. Set `CATALOGBRIDGE_BROWSER_MODE` to `headless`, `adaptive`, or `visible` when a different operating mode is required. Adaptive and visible modes intentionally serialize jobs so only one operator window can request attention; configured concurrency up to three is used in headless mode with isolated browser profiles.

SQLite runs in WAL mode and is appropriate for the current local, single-operator stage. Replace the storage adapter with PostgreSQL before deploying a multi-user or multi-instance worker setup.

## Quality checks

```bash
npm run lint
npm test
npm run build
```
