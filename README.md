# CatalogBridge

CatalogBridge is a responsive operations workspace for moving normalized JakMall product data through review and into a controlled Shopee publishing workflow.

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

Production sign-in fails closed when any required authentication variable is missing. Session cookies are signed, HttpOnly, SameSite=Lax, Secure in production, and expire after eight hours.

## Stage 1 local workflow

Stage 1 accepts one or up to 20 HTTPS JakMall product URLs, persists durable jobs in SQLite, extracts product data in local Chrome, validates images, detects duplicates, and saves normalized products for review. No Shopee submission is attempted.

The browser worker is visible by default. If JakMall presents a legitimate human-verification screen, complete it in the opened Chrome window. The worker reuses its local browser profile, never automates CAPTCHA challenges, and records bounded failure evidence under `data/evidence` when extraction cannot continue.

SQLite runs in WAL mode and is appropriate for the current local, single-operator stage. Replace the storage adapter with PostgreSQL before deploying a multi-user or multi-instance worker setup.

## Quality checks

```bash
npm run lint
npm test
npm run build
```
