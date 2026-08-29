# ListFlow / Jak2Shopee — Completed UI Feature Map

This prototype now covers the full candidate-facing product workflow rather than only the dashboard.

## Included screens and interactions

1. **Authentication / demo login**
   - Internal-tool sign-in screen
   - Account/security section in Settings
   - Demonstrates that the dashboard should not be publicly exposed

2. **Dashboard**
   - Published / Processing / Needs Review / Failed summary cards
   - Recent product jobs
   - Automation health
   - Quick import
   - Automation efficiency and reliability snapshot

3. **Import Products**
   - Single JakMall URL import
   - Batch URL import
   - Price markup configuration
   - Image-validation toggle
   - Duplicate-detection toggle
   - Review-on-uncertain-mapping toggle
   - Simulated extraction workflow
   - Normalized product preview

4. **Review & Normalize**
   - Editable title, SKU, price, stock, weight, category, variants and description
   - Manual category fallback rather than unsafe auto-guessing
   - Save draft
   - Publish action

5. **Products**
   - Search
   - Status filtering
   - Product detail modal
   - CSV export
   - Sync action placeholder

6. **Review Queue**
   - Products requiring human confirmation
   - Issue labels
   - Review / later workflow

7. **Processing History**
   - Job ID, status, retries, duration and start time
   - Selected job timeline
   - Retry action

8. **Structured Logs**
   - INFO / OK / WARN / ERROR filters
   - Search
   - Redaction note for sensitive tokens
   - Clear/download UI

9. **Settings**
   - Shopee connection status/test
   - Pricing rules
   - Retry / concurrency / CAPTCHA-2FA safety rules
   - Temporary image handling
   - Account and session security

10. **Reliability / engineering details visible in the UI**
    - Retry policy
    - Status transitions
    - Duplicate prevention
    - Human fallback on uncertain mapping
    - Token/secret handling notes
    - Explicit non-bypass handling for CAPTCHA / 2FA

## What is mocked vs. what belongs in the backend

The standalone HTML is an interactive **UI prototype**. These pieces are intentionally mocked:

- JakMall extraction
- Shopee API / browser automation
- Persistent database
- Authentication backend
- Real queue workers
- Image downloads/uploads

For the actual technical test, those should be implemented behind the same UI flow using the proposed stack:

- Next.js + TypeScript
- Playwright for browser automation where authorized/appropriate
- Prisma + SQLite for the PoC
- Zod for normalization/validation
- Environment variables for credentials
- A simple retry/backoff helper

The UI is designed so those backend pieces can be connected without changing the user flow.
