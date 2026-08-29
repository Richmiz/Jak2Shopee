# CatalogBridge
## JakMall -> Shopee Listing Automation
### Technical Project Blueprint and 48-Hour Implementation Plan

**Working product name:** CatalogBridge  
**Project type:** Internal operations web application / Proof of Concept  
**Primary goal:** Reduce the manual work required to move product information from JakMall into Shopee Seller while keeping the workflow reliable, explainable, secure, inexpensive, and easy to operate.

> **Project principle:** Build something that works end-to-end, explain why it works, and keep it simple. Polish the product experience without over-engineering the architecture.

---

## 1. What the Project Actually Is

This is **not** a customer-facing e-commerce website. It is an internal product-listing automation tool.

A normal manual workflow looks like this:

```text
JakMall product page
    -> copy title
    -> copy description
    -> copy price
    -> download images
    -> read variants / SKU / stock
    -> open Shopee Seller
    -> create product
    -> re-enter all data
    -> upload images
    -> review
    -> publish
```

CatalogBridge shortens that workflow to:

```text
Paste one or more JakMall URLs
    -> Extract
    -> Normalize + validate
    -> Review only uncertain fields
    -> Apply pricing rules
    -> Publish / prepare Shopee listing
    -> Show result and logs
```

The candidate assessment specifically rewards end-to-end execution, engineering judgment, simplicity, code quality, reliability, usability, and the ability to explain the design.

---

## 2. Recommended Product Direction

### Recommended format: Web application

A web application is the strongest choice for this assessment because:

- Shopee Seller is already browser-centered.
- Browser automation is easier to integrate and debug in a web/backend environment.
- The user can work from a laptop without installing a mobile app.
- One Next.js project can contain both the interface and server-side logic.
- It reduces development and deployment complexity during a 48-hour build.
- A polished admin-style interface still demonstrates creativity and product thinking.

### Product positioning

Present it as an **operations automation product**, not as "a scraper".

Suggested description:

> CatalogBridge is a lightweight product-listing operations tool that transforms supplier product pages into reviewable, normalized marketplace listings and publishes them to Shopee with minimal repeated manual input.

This framing makes the project feel useful enough to continue beyond the assessment.

---

## 3. Development Stack

| Layer | Technology | Why it fits this project |
|---|---|---|
| Frontend | Next.js + React + TypeScript | Familiar stack, fast full-stack development, strong maintainability |
| UI system | shadcn/ui + Tailwind CSS | Professional dashboard components, accessible patterns, fast visual polish |
| Backend | Next.js Route Handlers / Server Actions + Node.js runtime | Keeps frontend and backend in one repository while still separating business logic |
| Browser automation | Playwright | Reliable waits, screenshots, file uploads, multiple browser contexts, strong debugging |
| Validation | Zod | Runtime validation of extracted and mapped product data |
| ORM | Prisma | Clear data model, migrations, easy transition to PostgreSQL later |
| Database | SQLite | Zero server setup, low cost, perfect for a local/single-user PoC |
| Logging | Pino or structured application logger | Searchable, structured execution and error logs |
| Tests | Vitest | Fast unit tests for parsing, normalization, pricing, mapping, and validation |
| Auth | Minimal session-based admin authentication | Protects the internal dashboard without building a full identity platform |
| Packaging | Docker optional | Easy repeatable setup if time permits |

### Important clarification

**Next.js is both the frontend framework and part of the backend.** Node.js is the runtime underneath the server-side parts. Prisma talks to SQLite. Playwright performs page interaction when browser automation is needed.

```text
Browser UI
   |
   v
Next.js application
   |-- UI / React / shadcn
   |-- API / server actions
   |-- business services
   |-- Playwright automation
   |
   v
Prisma
   |
   v
SQLite
```

---

## 4. High-Level Architecture

Use adapters so the extraction source and publishing destination are not tightly coupled.

```text
+--------------------+
|     Web UI         |
| shadcn / Next.js   |
+---------+----------+
          |
          v
+--------------------+
| Application Layer  |
| jobs / validation  |
| pricing / mapping  |
+----+-----------+---+
     |           |
     v           v
+----------+  +----------------+
| JakMall  |  | Shopee         |
| Adapter  |  | Publisher      |
+----+-----+  +-------+--------+
     |                |
     v                v
Product page      API or browser
     |            automation
     +-------+--------+
             |
             v
     +----------------+
     | Normalized     |
     | Product Model  |
     +-------+--------+
             |
             v
       Prisma + SQLite
```

### Core design decision

The JakMall extractor should **not** directly know how Shopee works.

Instead:

```text
JakMall -> NormalizedProduct -> ShopeeMapper -> ShopeePublisher
```

This gives you a strong interview explanation:

> I separated source extraction from marketplace publishing. If the company later adds another supplier or marketplace, the core workflow can remain the same and only a new adapter needs to be added.

That demonstrates scalability thinking without creating microservices.

---

## 5. Core Domain Model

### Normalized product contract

```ts
export type ProductStatus =
  | "DRAFT"
  | "EXTRACTING"
  | "NEEDS_REVIEW"
  | "READY"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED";

export interface NormalizedProduct {
  id: string;
  sourceUrl: string;
  sourceProductId?: string;

  title: string;
  description: string;

  sourcePrice: number;
  sellingPrice: number;
  currency: "IDR";

  sku?: string;
  stock?: number;
  weightGrams?: number;

  category?: string;
  attributes: Record<string, string>;

  images: ProductImage[];
  variants: ProductVariant[];

  warnings: string[];
  status: ProductStatus;
  extractedAt: string;
}
```

### Why normalization matters

JakMall and Shopee do not necessarily use the same field names, structure, categories, or required attributes. A normalized model provides a stable middle layer that can be validated before publishing.

---

## 6. Suggested Database Model

Keep the schema small.

### Product

- id
- sourceUrl
- sourceProductId
- title
- description
- sourcePrice
- sellingPrice
- sku
- stock
- weightGrams
- category
- status
- fingerprint
- createdAt
- updatedAt

### ProductVariant

- id
- productId
- name
- option
- sku
- price
- stock

### ProductImage

- id
- productId
- sourceUrl
- localPath or remoteUrl
- position
- hash

### Job

- id
- productId
- type: EXTRACT / PUBLISH / RETRY
- status
- attempts
- startedAt
- finishedAt
- errorCode
- errorMessage

### JobEvent

- id
- jobId
- level: INFO / WARNING / ERROR
- message
- metadata
- createdAt

### Setting

- defaultMarkupPercent
- defaultStockFallback
- defaultWeightFallback
- publishMode

A single-user PoC does not need organizations, permissions, subscriptions, invoices, teams, or complex audit infrastructure.

---

## 7. Functional Flow

### Step 1 - Authentication

The operator signs into the internal dashboard.

Minimum secure behavior:

- credentials are not hard-coded in source code;
- secrets are loaded from environment variables;
- authenticated session is required for dashboard and server actions;
- Shopee cookies/tokens are never committed to Git.

### Step 2 - Product input

Support two entry methods if time allows:

1. Single JakMall URL.
2. Batch paste: one URL per line.

Batch paste is a high-value, low-effort creativity feature.

### Step 3 - Extraction

For every URL:

1. Validate the URL format.
2. Open the page.
3. Prefer structured page data when available.
4. Extract title, description, price, images, SKU, stock, weight, variants, and relevant attributes.
5. Validate the result.
6. Store the normalized product and extraction job.
7. Flag uncertain or missing fields for review.

### Step 4 - Normalization and mapping

Example mapping:

| Normalized field | JakMall source | Shopee destination | Fallback |
|---|---|---|---|
| title | Product title | Product name | User review if missing |
| description | Description | Description | Plain-text cleanup |
| sourcePrice | Product price | Used for calculation | Required |
| sellingPrice | Calculated | Price | Manual override allowed |
| images | Gallery | Product images | Require at least one |
| SKU | SKU/code | Seller SKU | Generate only if business rule allows |
| stock | Availability | Stock | Manual/default fallback |
| weight | Weight data | Shipping weight | Needs review if unavailable |
| category | Source/category clues | Shopee category | Manual confirmation when uncertain |

### Step 5 - Review

Do not blindly publish incomplete data.

Use three levels:

- **Ready** - all required fields valid.
- **Needs review** - one or more fields require confirmation.
- **Blocked** - cannot continue safely.

### Step 6 - Publish

Use a publisher abstraction:

```ts
interface MarketplacePublisher {
  publish(product: NormalizedProduct): Promise<PublishResult>;
}
```

Possible implementations:

```text
ShopeeApiPublisher
ShopeeBrowserPublisher
ShopeeDryRunPublisher
```

The assessment allows official API integration, browser automation, and a verifiable simulated/final reachable stage when direct seller publication is not possible.

### Step 7 - Result

Every job should end with one visible result:

```text
PUBLISHED
READY
NEEDS_REVIEW
FAILED
DUPLICATE
```

The UI should always tell the operator what happened and what they can do next.

---

## 8. Shopee Strategy

### Preferred approach

Use the official/authorized route if appropriate test access is available.

### Practical PoC fallback

If direct API access is unavailable during the assessment, isolate Shopee browser automation in its own adapter and use Playwright to perform the final seller workflow.

### Safety rules

Do not:

- bypass CAPTCHA;
- bypass 2FA;
- steal or embed credentials;
- hard-code session cookies;
- evade access controls.

If a login or verification step requires the seller, pause the automation and clearly ask the user to complete that step.

### Demo resilience

Add a **Dry Run** mode that validates and maps the entire listing without submitting the final publish action.

This is useful when:

- the seller account is temporarily unavailable;
- platform login requires manual verification;
- you want to rehearse safely;
- the interviewer wants to inspect mapped data before publication.

Dry Run is not a replacement for a real end-to-end demonstration when a real seller flow is available, but it is an excellent backup.

---

## 9. Reliability Design

Reliability should be visible in the product, not only mentioned in the README.

### 9.1 Selector strategy

Avoid scattering page selectors across the project.

```text
adapters/jakmall/
  extractor.ts
  selectors.ts
  parser.ts
  fixtures/
```

Prefer extraction in this order:

```text
1. structured page data
2. stable data attributes
3. primary DOM selector
4. fallback selector
5. warning / needs review
```

### 9.2 Retry policy

Use a small bounded retry policy for temporary failures.

```text
Attempt 1 -> fail -> wait 1s
Attempt 2 -> fail -> wait 2s
Attempt 3 -> fail -> mark FAILED
```

Do not retry validation errors that require user input.

### 9.3 Timeouts

Every network/browser operation must have a reasonable timeout. A hung browser is worse than a clear failure.

### 9.4 Screenshots on automation failure

When a Shopee or JakMall browser action fails, save a screenshot and the current page URL to the job log.

This is a strong demonstration of practical debugging discipline.

### 9.5 Idempotency and duplicate detection

Create a fingerprint from stable values such as:

```text
source site + source product ID / canonical URL + selected variant
```

Before creating a new listing, check whether that fingerprint has already been published.

### 9.6 Structured logs

Good:

```json
{
  "jobId": "job_123",
  "stage": "image_upload",
  "attempt": 2,
  "status": "failed",
  "message": "Upload timed out"
}
```

Bad:

```text
Something went wrong!
```

---

## 10. Cost Efficiency

A good PoC can run at close to zero infrastructure cost.

| Component | PoC cost approach |
|---|---|
| Next.js | Local machine / free hosting if compatible with automation |
| SQLite | Free |
| Prisma | Free |
| Playwright | Free |
| shadcn/ui | Free |
| Tailwind CSS | Free |
| Testing | Free |
| Logging | Local structured logs |
| Images | Temporary local files during processing |

### Important deployment note

Browser automation may not fit every serverless hosting environment. For the PoC, local execution or a small container/VM is easier to explain and control.

If production volume grows, move long-running jobs to a worker process and SQLite to PostgreSQL.

---

## 11. Security Baseline

For this assessment, demonstrate security awareness without building an enterprise identity system.

### Required

- `.env.local` for secrets.
- `.env.example` with placeholder names only.
- `.gitignore` includes environment files, local database, screenshots, and temporary image folders.
- server-side validation for every product submission.
- no raw credentials in logs.
- protected dashboard routes.
- no arbitrary URL fetching: allow only expected JakMall hosts.
- safe file handling and MIME/type checks for downloaded images.

### Nice to have

- secure HTTP-only session cookie;
- rate limit for import actions;
- CSRF-safe server action pattern;
- masked secrets in the settings screen.

---

## 12. UI / UX Blueprint

Use shadcn/ui, clean spacing, a neutral background, one restrained accent color, and strong status feedback.

The UI should feel like an internal SaaS operations tool.

### Screen 1 - Login

Simple centered card:

```text
CatalogBridge
Product Listing Automation

Email
[_____________________]
Password
[_____________________]

[ Sign in ]
```

### Screen 2 - Overview Dashboard

Top cards:

```text
TOTAL IMPORTED     READY     NEEDS REVIEW     FAILED
     24              15            6             3
```

Main area:

```text
Recent processing jobs

Product              Source     Status         Updated
Wireless Mouse       JakMall    Published      2 min ago
USB-C Hub            JakMall    Ready          5 min ago
LED Lamp             JakMall    Needs Review   8 min ago
Keyboard             JakMall    Failed         12 min ago
```

Primary button:

```text
[ Import products ]
```

Do not turn the dashboard into a business-intelligence application. The metrics should support operations.

### Screen 3 - Import Products

```text
Import from JakMall

Paste one or more product URLs
+---------------------------------------------------+
| https://www.jakmall.com/...                       |
| https://www.jakmall.com/...                       |
+---------------------------------------------------+

Pricing rule
Markup: [ 20 ] %

[ Extract products ]
```

Useful touches:

- invalid URLs are highlighted before processing;
- URL count is shown;
- duplicate URLs are removed or flagged;
- progress is shown for batch extraction.

### Screen 4 - Product Review

Two-column desktop layout:

```text
LEFT                                   RIGHT
Product details                        Listing readiness
Title                                  [ READY ]
Description
Images                                 Warnings
Variants                               - category confirmation
SKU                                    - missing weight
Stock
Weight                                 Pricing
Category                               Source: Rp100,000
                                       Markup: 20%
                                       Sell:   Rp120,000

[ Save draft ] [ Publish to Shopee ]
```

Use badges:

```text
Ready
Needs review
Missing
Auto-mapped
Manual override
```

### Screen 5 - Processing History

Filterable table:

```text
All | Published | Review | Failed
```

Each row opens a detail drawer containing:

- extraction result;
- normalized data;
- mapping decisions;
- job timeline;
- warnings;
- retry button;
- automation screenshot when a browser step failed.

### Screen 6 - Settings

Keep it small:

- default markup percentage;
- default stock fallback;
- default weight fallback;
- publish mode: API / Browser / Dry Run;
- browser headless mode;
- masked integration status.

---

## 13. Creativity Features That Actually Improve Acceptance Chances

Creativity should increase business value or reliability, not just visual complexity.

### Priority A - Build these if possible

#### 1. Batch URL import

Paste 5-20 URLs at once. Huge usability improvement with little architecture cost.

#### 2. Smart review queue

Only send uncertain fields to the operator.

Example:

```text
Title          AUTO-MAPPED
Images         AUTO-MAPPED
Price          AUTO-MAPPED
Stock          AUTO-MAPPED
Category       NEEDS REVIEW
Weight         MISSING
```

This makes the product feel intelligent without requiring AI.

#### 3. Automatic pricing rule

```text
Source price + configurable margin = target listing price
```

Allow manual override before publication.

#### 4. Duplicate protection

Warn before re-publishing an already processed JakMall item.

#### 5. Dry Run / Preview mode

Prepare the exact Shopee payload/form mapping without final submission.

#### 6. Failure screenshot + retry

If automation fails, the history page shows the last screenshot, error stage, and a Retry button.

This is one of the strongest reliability-oriented polish features.

### Priority B - Add only after the core flow works

#### 7. Product diff

If the same JakMall URL is re-imported later, show changes:

```text
Price: Rp100,000 -> Rp95,000
Stock: 23 -> 8
```

This hints at a future product-sync capability.

#### 8. Downloadable debug bundle

Generate a small JSON file containing normalized product data and execution logs for one job. Useful for handoff and debugging.

#### 9. Demo mode

Provide 2-3 safe sample products or fixtures so the UI can still be demonstrated if the source site is temporarily unavailable.

#### 10. Keyboard-first workflow

Useful shortcuts such as:

```text
N - new import
R - retry failed job
P - publish ready product
```

Only add this if it is quick.

---

## 14. Features to Avoid During the 48-Hour Build

These sound impressive but are not worth the risk before the core flow is complete:

- multi-tenant SaaS architecture;
- complex role-based access control;
- revenue analytics;
- real-time WebSocket infrastructure;
- microservices;
- Redis unless a real need appears;
- Kubernetes;
- AI-generated descriptions before basic mapping is reliable;
- mobile application in addition to the web app;
- elaborate animations;
- customer storefront/cart/payment features.

A finished, polished, explainable system scores better than an unfinished ambitious system.

---

## 15. Suggested Project Structure

```text
catalogbridge/
|- prisma/
|  |- schema.prisma
|  `- dev.db
|- src/
|  |- app/
|  |  |- (auth)/
|  |  |- (dashboard)/
|  |  |  |- page.tsx
|  |  |  |- import/
|  |  |  |- products/[id]/
|  |  |  |- jobs/
|  |  |  `- settings/
|  |  `- api/
|  |- components/
|  |  |- product/
|  |  |- jobs/
|  |  `- ui/
|  |- adapters/
|  |  |- jakmall/
|  |  |  |- extractor.ts
|  |  |  |- parser.ts
|  |  |  `- selectors.ts
|  |  `- shopee/
|  |     |- api-publisher.ts
|  |     |- browser-publisher.ts
|  |     `- dry-run-publisher.ts
|  |- services/
|  |  |- import.service.ts
|  |  |- normalization.service.ts
|  |  |- pricing.service.ts
|  |  |- image.service.ts
|  |  |- publish.service.ts
|  |  `- duplicate.service.ts
|  |- schemas/
|  |  |- product.schema.ts
|  |  `- import.schema.ts
|  |- db/
|  |  `- prisma.ts
|  `- lib/
|     |- logger.ts
|     |- retry.ts
|     |- errors.ts
|     `- env.ts
|- tests/
|  |- normalization.test.ts
|  |- pricing.test.ts
|  `- mapping.test.ts
|- public/
|- .env.example
|- .gitignore
|- README.md
|- Dockerfile
`- package.json
```

---

## 16. Error Model

Define errors instead of throwing generic messages everywhere.

Possible codes:

```text
INVALID_SOURCE_URL
SOURCE_NOT_FOUND
EXTRACTION_TIMEOUT
REQUIRED_FIELD_MISSING
IMAGE_DOWNLOAD_FAILED
DUPLICATE_PRODUCT
SHOPEE_AUTH_REQUIRED
SHOPEE_MAPPING_INVALID
SHOPEE_UPLOAD_FAILED
PUBLISH_TIMEOUT
```

Every error should contain:

```ts
{
  code: string;
  message: string;
  retryable: boolean;
  userAction?: string;
  technicalDetails?: unknown;
}
```

The user-facing interface should not expose secrets or raw stack traces.

---

## 17. Testing Strategy

Do not try to test the entire internet.

### Unit tests

Test deterministic logic:

- price markup;
- price rounding;
- required field validation;
- URL validation;
- normalization;
- duplicate fingerprint generation;
- category/manual-review decisions;
- variant transformation.

### Extraction fixture tests

Save a small sanitized HTML fixture from a product page and test the parser against it. This protects your extraction logic from accidental code regressions.

### Integration smoke test

At minimum:

```text
input URL
 -> extracted product
 -> validated normalized product
 -> mapped Shopee payload / dry-run result
```

### Manual end-to-end test

Use at least three product types:

1. simple product;
2. product with variants;
3. product with one missing/uncertain field.

Also test one invalid URL deliberately.

---

## 18. 48-Hour Execution Plan

### Hours 0-3 - Foundation

- create repository;
- Next.js + TypeScript;
- Tailwind + shadcn/ui;
- Prisma + SQLite;
- environment validation;
- basic application shell;
- define product/job schemas.

**Checkpoint:** project starts cleanly and database migration works.

### Hours 3-8 - UI skeleton and authentication

- login;
- protected dashboard shell;
- sidebar/header;
- overview cards;
- empty jobs table;
- import screen;
- review page skeleton.

**Checkpoint:** complete navigation flow exists before automation complexity begins.

### Hours 8-15 - JakMall extraction

- URL validation;
- Playwright setup;
- extraction adapter;
- parse minimum expected fields;
- normalize output;
- save product + job;
- add clear errors.

**Checkpoint:** at least 3 JakMall products can be extracted repeatedly.

### Hours 15-20 - Product rules

- Zod validation;
- markup calculation;
- required field checks;
- review flags;
- duplicate fingerprint;
- image validation.

**Checkpoint:** every product ends in READY, NEEDS_REVIEW, or FAILED.

### Hours 20-28 - Full product UI

- review/edit product page;
- image gallery;
- variant display;
- pricing card;
- readiness checklist;
- status badges;
- save changes;
- job history.

**Checkpoint:** UI feels like a real internal product.

### Hours 28-36 - Shopee publisher

- publisher interface;
- preferred integration route;
- browser publisher fallback if needed;
- dry-run publisher;
- job status and failure capture.

**Checkpoint:** one product can reach the final demonstrable Shopee stage.

### Hours 36-40 - Reliability layer

- retries;
- timeouts;
- failure screenshots;
- structured logs;
- duplicate block;
- manual authentication pause handling.

**Checkpoint:** deliberately broken inputs fail gracefully.

### Hours 40-44 - High-value bonus features

Choose in this order:

1. batch URL import;
2. retry button;
3. pricing presets;
4. product diff;
5. demo fixtures.

### Hours 44-48 - Ship quality

- tests;
- README;
- `.env.example`;
- architecture diagram;
- cost section;
- limitation section;
- AI-assisted-development disclosure;
- clean Git history;
- record demo video;
- rehearse 5-7 minute explanation.

**Hard rule:** stop adding new features during the final 4 hours.

---

## 19. Definition of Done

Before calling the project finished, verify all of these:

### End-to-end

- accepts a JakMall product URL;
- extracts core fields;
- normalizes data;
- supports more than one product;
- displays reviewable mapped data;
- reaches Shopee publishing/preparation stage;
- shows proof of result.

### Reliability

- invalid URLs do not crash the app;
- timeouts are handled;
- missing fields trigger review;
- duplicate publishing is prevented;
- browser failures create useful diagnostics;
- retry behavior is bounded.

### Quality

- no secrets in Git;
- clean folder structure;
- no large duplicated functions;
- major domain rules are tested;
- README setup works from a clean clone;
- another developer can understand the architecture.

### Usability

- clear primary action;
- status visible everywhere;
- review screen explains exactly what needs attention;
- errors tell the operator what to do next;
- batch import is understandable without documentation.

---

## 20. Demo Script

A strong demo should be controlled and short.

### Part 1 - Problem

> Today, an operator must repeatedly copy product information, images, pricing, variants, and stock from a source catalog into Shopee. CatalogBridge reduces that repeated work while preserving a human review step for fields that cannot be mapped safely.

### Part 2 - Architecture

Show one diagram only:

```text
JakMall -> Extractor -> Normalized Product -> Review -> Shopee Publisher
                              |
                              v
                         Job history
```

### Part 3 - Happy path

Use one product that is known to work:

```text
Paste URL
 -> Extract
 -> show normalized data
 -> apply 20% markup
 -> review
 -> publish
 -> show result in Shopee
```

### Part 4 - Reliability proof

Demonstrate one controlled failure:

```text
invalid URL
 -> clear error
```

Then one incomplete product:

```text
missing weight/category
 -> NEEDS REVIEW
 -> user corrects field
 -> READY
```

### Part 5 - Engineering judgment

Explain:

- why Next.js and one repository;
- why SQLite for PoC;
- why normalized product model;
- why publisher adapters;
- why manual review is safer than inventing missing values;
- why retries are bounded;
- what changes for production scale.

### Part 6 - Cost and production path

PoC:

```text
local / low-cost deployment
SQLite
open-source dependencies
no unnecessary paid services
```

Production evolution:

```text
SQLite -> PostgreSQL
in-process jobs -> dedicated worker/queue
single operator -> roles if needed
manual category review -> maintained mapping rules
browser publisher -> authorized API where appropriate
```

---

## 21. Interview Answers to Prepare

### Why web instead of mobile?

> The workflow is centered on supplier pages and Shopee Seller, both of which are naturally browser-based. A web application reduces development cost, integrates cleanly with browser automation, and is easier to operate from a seller workstation.

### Why SQLite?

> The assessment asks for a PoC and values cost efficiency. SQLite requires no database server, is reliable for this workload, and is very easy to demonstrate. Prisma keeps the data layer portable so PostgreSQL can replace it later.

### Why not Supabase?

> Supabase is a strong platform, but it would add hosted infrastructure that is not necessary for this single-operator PoC. The main challenge is extraction and marketplace automation, not cloud database management. I would move to hosted PostgreSQL when multi-user or deployment requirements justify it.

### Why Playwright?

> It provides reliable browser control, explicit waits, file-upload handling, screenshots, isolated contexts, and strong debugging. It also lets the automation be contained in an adapter instead of leaking browser logic across the codebase.

### Why review before publish?

> The source and destination schemas are not guaranteed to map one-to-one. Reliability means knowing when automation is uncertain. The application automates confident mappings and asks for human confirmation only where necessary.

### What happens if JakMall changes its HTML?

> Extraction logic is isolated in one adapter, selectors are centralized, structured data is preferred where available, fallback selectors are used, and failures become visible job errors rather than corrupt listings.

### What happens at higher scale?

> I would move publishing and extraction to background workers, use PostgreSQL, introduce a durable queue, store media externally, add rate controls, and separate the browser worker from the web process. I would not introduce those costs until the workload requires them.

---

## 22. README Deliverables Checklist

The repository README should contain:

1. Project overview.
2. Architecture diagram.
3. Features.
4. Tech stack.
5. Requirements.
6. Installation.
7. Environment variables.
8. Database setup.
9. Running locally.
10. Running tests.
11. Shopee integration mode.
12. Security notes.
13. Cost estimate.
14. Known limitations.
15. Production scaling path.
16. AI-assisted development disclosure.
17. Demo video link.

---

## 23. AI-Assisted Development Disclosure

Because the assessment explicitly allows AI-assisted development while requiring candidate understanding, keep this short and transparent.

Suggested wording:

> AI-assisted development tools were used for selected implementation support, code review, documentation drafting, and debugging suggestions. Architecture decisions, integration choices, testing, verification, and final source-code review were performed by the candidate. All AI-assisted outputs were inspected and validated before inclusion.

Do not claim AI wrote nothing if AI was used. Be ready to explain every important function yourself.

---

## 24. Product Polish Checklist

Before recording the demo:

- consistent spacing and typography;
- no placeholder text;
- no unfinished menu items;
- loading skeletons for extraction;
- empty states that explain the next action;
- success toast after actions;
- destructive action confirmation;
- useful status badges;
- mobile responsiveness is acceptable, but desktop is the priority;
- no console errors;
- no broken images;
- no secrets visible on screen;
- no demo URLs containing sensitive information.

---

## 25. Final Recommendation

The winning version is not the project with the largest number of features. It is the version where the interviewer can see that the candidate made deliberate engineering decisions.

Build in this priority order:

```text
1. Working extraction
2. Correct normalization
3. Reviewable mapping
4. Demonstrable Shopee flow
5. Clear failure handling
6. Clean UI
7. High-value bonus features
8. Documentation and explanation
```

The strongest final product should feel like a **small internal tool that a real operations team could continue developing**, not a one-off technical script wrapped in a dashboard.

---

## 26. Immediate Next Development Step

Start with three artifacts before writing the main automation logic:

```text
A. Prisma schema
B. NormalizedProduct Zod schema
C. UI wireframe for Dashboard -> Import -> Review -> History
```

Once those contracts are stable, implement JakMall extraction against the normalized schema. This prevents the scraper from dictating the rest of the application design.

---

**Document status:** Initial implementation blueprint  
**Intended use:** Living development guide, README source material, interview preparation, and project planning.
