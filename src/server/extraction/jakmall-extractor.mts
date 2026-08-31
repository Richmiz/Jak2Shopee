import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { assertJakMallUrl, CatalogError, type ImportOptions, type NormalizedProduct } from "../catalog-types.mts";
import { parseJakMallProduct } from "./jakmall-parser.mts";

type StageReporter = (stage: string, message: string, level?: "INFO" | "SUCCESS" | "WARNING" | "ERROR") => void;

function envBoolean(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === undefined ? fallback : value === "true" || value === "1";
}

function isVerificationPage(text: string, title: string) {
  return /human verification|verify you are human|captcha|security check|access denied/i.test(`${title} ${text}`);
}

function isJakMallHost(value: string) {
  try {
    const host = new URL(value).hostname;
    return host === "jakmall.com" || host.endsWith(".jakmall.com");
  } catch {
    return false;
  }
}

export class JakMallExtractor {
  private context?: BrowserContext;

  private async getContext() {
    if (this.context) return this.context;
    const profilePath = path.resolve(process.env.CATALOGBRIDGE_BROWSER_PROFILE || path.join(process.cwd(), "data", "browser-profile"));
    await mkdir(profilePath, { recursive: true });
    this.context = await chromium.launchPersistentContext(profilePath, {
      channel: process.env.CATALOGBRIDGE_CHROME_CHANNEL || "chrome",
      executablePath: process.env.CATALOGBRIDGE_CHROME_PATH || undefined,
      headless: envBoolean("CATALOGBRIDGE_BROWSER_HEADLESS", false),
      viewport: { width: 1440, height: 960 },
      locale: "id-ID",
      timezoneId: "Asia/Jakarta",
      acceptDownloads: false,
    });
    return this.context;
  }

  async close() {
    await this.context?.close();
    this.context = undefined;
  }

  private async captureEvidence(page: Page, jobId: string) {
    const directory = path.resolve(process.env.CATALOGBRIDGE_EVIDENCE_PATH || path.join(process.cwd(), "data", "evidence"));
    await mkdir(directory, { recursive: true });
    const filename = `${jobId}-${Date.now()}.png`;
    const target = path.join(directory, filename);
    await page.screenshot({ path: target, fullPage: true }).catch(() => undefined);
    return target;
  }

  async extract(jobId: string, sourceUrl: string, options: ImportOptions, report: StageReporter): Promise<NormalizedProduct> {
    assertJakMallUrl(sourceUrl);
    const context = await this.getContext();
    const page = await context.newPage();
    page.setDefaultTimeout(Number(process.env.CATALOGBRIDGE_PAGE_TIMEOUT_MS || 45_000));
    try {
      report("NAVIGATING", "Opening the JakMall product in local Chrome.");
      const response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: Number(process.env.CATALOGBRIDGE_PAGE_TIMEOUT_MS || 45_000) });
      if (response?.status() === 404) throw new CatalogError("SOURCE_NOT_FOUND", "The JakMall product page returned 404.");
      if (!isJakMallHost(page.url())) throw new CatalogError("INVALID_SOURCE_URL", "JakMall redirected outside the allowed domain.");
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

      let bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      let pageTitle = await page.title();
      if (isVerificationPage(bodyText, pageTitle)) {
        report("WAITING_FOR_INPUT", "JakMall requires human verification in the opened Chrome window.", "WARNING");
        if (envBoolean("CATALOGBRIDGE_BROWSER_HEADLESS", false)) {
          const evidencePath = await this.captureEvidence(page, jobId);
          throw new CatalogError("SOURCE_VERIFICATION_REQUIRED", "Human verification is required; run the worker with a visible browser.", false, evidencePath);
        }
        const verificationTimeout = Number(process.env.CATALOGBRIDGE_VERIFICATION_TIMEOUT_MS || 120_000);
        const deadline = Date.now() + verificationTimeout;
        while (Date.now() < deadline) {
          await page.waitForTimeout(1000);
          bodyText = await page.locator("body").innerText().catch(() => "");
          pageTitle = await page.title();
          if (!isVerificationPage(bodyText, pageTitle)) break;
        }
        if (isVerificationPage(bodyText, pageTitle)) {
          const evidencePath = await this.captureEvidence(page, jobId);
          throw new CatalogError("SOURCE_VERIFICATION_REQUIRED", "Human verification was not completed before the local timeout.", false, evidencePath);
        }
        report("NAVIGATING", "Human verification completed; continuing extraction.", "SUCCESS");
      }

      report("EXTRACTING", "Reading structured product data and visible specifications.");
      const product = parseJakMallProduct(await page.content(), sourceUrl, options);
      if (options.validateImages && product.images.length) {
        report("VALIDATING_IMAGES", `Validating ${product.images.length} product image${product.images.length === 1 ? "" : "s"}.`);
        for (const image of product.images) {
          try {
            const imageResponse = await context.request.fetch(image.sourceUrl, { method: "HEAD", timeout: 12_000, failOnStatusCode: false });
            image.mimeType = imageResponse.headers()["content-type"];
            image.status = imageResponse.ok() && Boolean(image.mimeType?.startsWith("image/")) ? "VALID" : "INVALID";
          } catch {
            image.status = "INVALID";
          }
        }
        const invalidCount = product.images.filter((image) => image.status === "INVALID").length;
        if (invalidCount) product.warnings.push(`${invalidCount} product image${invalidCount === 1 ? "" : "s"} could not be validated.`);
      }
      report("NORMALIZING", "Product fields normalized into the CatalogBridge schema.", "SUCCESS");
      return product;
    } catch (error) {
      if (error instanceof CatalogError) throw error;
      const evidencePath = await this.captureEvidence(page, jobId);
      const message = error instanceof Error ? error.message : "Unknown browser extraction error.";
      const timedOut = /timeout/i.test(message);
      throw new CatalogError(timedOut ? "EXTRACTION_TIMEOUT" : "WORKER_ERROR", message, timedOut, evidencePath);
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}
