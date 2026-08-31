import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { assertJakMallUrl, CatalogError, type ImportOptions, type NormalizedProduct } from "../catalog-types.mts";
import { parseJakMallProduct } from "./jakmall-parser.mts";

type StageReporter = (stage: string, message: string, level?: "INFO" | "SUCCESS" | "WARNING" | "ERROR") => void;
type BrowserMode = "adaptive" | "headless" | "visible";

function browserMode(): BrowserMode {
  const configured = process.env.CATALOGBRIDGE_BROWSER_MODE?.trim().toLowerCase();
  if (configured === "headless" || configured === "visible" || configured === "adaptive") return configured;
  // Preserve an explicitly headless legacy configuration. The old `false`
  // value now uses adaptive mode so upgrading does not keep opening Chrome.
  return process.env.CATALOGBRIDGE_BROWSER_HEADLESS?.trim().toLowerCase() === "true" ? "headless" : "adaptive";
}

function isVerificationPage(text: string, title: string) {
  return /human verification|confirm you are human|verify you are human|captcha|security check|access denied/i.test(`${title} ${text}`);
}

function isJakMallHost(value: string) {
  try {
    const host = new URL(value).hostname;
    return host === "jakmall.com" || host.endsWith(".jakmall.com");
  } catch {
    return false;
  }
}

function targetWasClosed(error: unknown) {
  return error instanceof Error && /target page, context or browser has been closed|browser has been closed|page has been closed/i.test(error.message);
}

export class JakMallExtractor {
  private context?: BrowserContext;
  private contextHeadless?: boolean;

  private async resetContext() {
    const context = this.context;
    this.context = undefined;
    this.contextHeadless = undefined;
    await context?.close().catch(() => undefined);
  }

  private async getContext(headless: boolean) {
    if (this.context && this.contextHeadless === headless) return this.context;
    if (this.context) await this.resetContext();
    const profilePath = path.resolve(process.env.CATALOGBRIDGE_BROWSER_PROFILE || path.join(process.cwd(), "data", "browser-profile"));
    await mkdir(profilePath, { recursive: true });
    const context = await chromium.launchPersistentContext(profilePath, {
      channel: process.env.CATALOGBRIDGE_CHROME_CHANNEL || "chrome",
      executablePath: process.env.CATALOGBRIDGE_CHROME_PATH || undefined,
      headless,
      viewport: { width: 1440, height: 960 },
      locale: "id-ID",
      timezoneId: "Asia/Jakarta",
      acceptDownloads: false,
    });
    this.context = context;
    this.contextHeadless = headless;
    context.on("close", () => {
      if (this.context === context) {
        this.context = undefined;
        this.contextHeadless = undefined;
      }
    });
    return context;
  }

  private async openPage(headless: boolean) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const context = await this.getContext(headless);
      try {
        const reusable = context.pages().find((page) => page.url() === "about:blank");
        return { context, page: reusable ?? await context.newPage() };
      } catch (error) {
        if (!targetWasClosed(error) || attempt === 1) throw error;
        await this.resetContext();
      }
    }
    throw new CatalogError("WORKER_ERROR", "The local browser could not be started.", true);
  }

  async close() {
    await this.resetContext();
  }

  private async captureEvidence(page: Page | undefined, jobId: string) {
    if (!page) return undefined;
    const directory = path.resolve(process.env.CATALOGBRIDGE_EVIDENCE_PATH || path.join(process.cwd(), "data", "evidence"));
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, `${jobId}-${Date.now()}.png`);
    try {
      await page.screenshot({ path: target, fullPage: true });
      return target;
    } catch {
      return undefined;
    }
  }

  private async navigate(page: Page, sourceUrl: string) {
    page.setDefaultTimeout(Number(process.env.CATALOGBRIDGE_PAGE_TIMEOUT_MS || 45_000));
    const response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: Number(process.env.CATALOGBRIDGE_PAGE_TIMEOUT_MS || 45_000) });
    if (response?.status() === 404) throw new CatalogError("SOURCE_NOT_FOUND", "The JakMall product page returned 404.");
    if (!isJakMallHost(page.url())) throw new CatalogError("INVALID_SOURCE_URL", "JakMall redirected outside the allowed domain.");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  }

  private async pageSignals(page: Page) {
    return {
      bodyText: await page.locator("body").innerText({ timeout: 10_000 }).catch(() => ""),
      title: await page.title().catch(() => ""),
    };
  }

  private async waitForVerification(page: Page) {
    const deadline = Date.now() + Number(process.env.CATALOGBRIDGE_VERIFICATION_TIMEOUT_MS || 120_000);
    let signals = await this.pageSignals(page);
    while (Date.now() < deadline && isVerificationPage(signals.bodyText, signals.title)) {
      await page.waitForTimeout(1000);
      signals = await this.pageSignals(page);
    }
    return !isVerificationPage(signals.bodyText, signals.title);
  }

  async extract(jobId: string, sourceUrl: string, options: ImportOptions, report: StageReporter): Promise<NormalizedProduct> {
    assertJakMallUrl(sourceUrl);
    const mode = browserMode();
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    let temporaryVisibleWindow = false;
    try {
      const initial = await this.openPage(mode !== "visible");
      context = initial.context;
      page = initial.page;
      report("NAVIGATING", "Opening the JakMall product in the background browser.");
      await this.navigate(page, sourceUrl);
      let signals = await this.pageSignals(page);

      if (isVerificationPage(signals.bodyText, signals.title) && mode === "adaptive") {
        report("WAITING_FOR_INPUT", "JakMall requires a one-time verification. Complete it in the temporary Chrome window.", "WARNING");
        await this.resetContext();
        const visible = await this.openPage(false);
        context = visible.context;
        page = visible.page;
        temporaryVisibleWindow = true;
        await this.navigate(page, sourceUrl);
        if (!await this.waitForVerification(page)) {
          const evidencePath = await this.captureEvidence(page, jobId);
          throw new CatalogError("SOURCE_VERIFICATION_REQUIRED", "JakMall verification was not completed before the local timeout.", false, evidencePath);
        }
        report("NAVIGATING", "JakMall verification completed; returning to the import.", "SUCCESS");
        signals = await this.pageSignals(page);
      } else if (isVerificationPage(signals.bodyText, signals.title)) {
        if (mode === "headless") {
          const evidencePath = await this.captureEvidence(page, jobId);
          throw new CatalogError("SOURCE_VERIFICATION_REQUIRED", "JakMall requires verification. Use adaptive browser mode for the one-time prompt.", false, evidencePath);
        }
        report("WAITING_FOR_INPUT", "Complete the JakMall verification in the Chrome window.", "WARNING");
        if (!await this.waitForVerification(page)) {
          const evidencePath = await this.captureEvidence(page, jobId);
          throw new CatalogError("SOURCE_VERIFICATION_REQUIRED", "JakMall verification was not completed before the local timeout.", false, evidencePath);
        }
        signals = await this.pageSignals(page);
      }

      if (isVerificationPage(signals.bodyText, signals.title)) {
        const evidencePath = await this.captureEvidence(page, jobId);
        throw new CatalogError("SOURCE_VERIFICATION_REQUIRED", "JakMall verification is still active.", false, evidencePath);
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
      if (targetWasClosed(error)) {
        await this.resetContext();
        throw new CatalogError("WORKER_ERROR", "The temporary browser was closed. Retry the import when you are ready to complete verification.", false);
      }
      if (error instanceof CatalogError) {
        error.evidencePath ??= await this.captureEvidence(page, jobId);
        throw error;
      }
      const evidencePath = await this.captureEvidence(page, jobId);
      const message = error instanceof Error ? error.message : "Unknown browser extraction error.";
      const timedOut = /timeout/i.test(message);
      throw new CatalogError(timedOut ? "EXTRACTION_TIMEOUT" : "WORKER_ERROR", message, timedOut, evidencePath);
    } finally {
      await page?.close().catch(() => undefined);
      if (temporaryVisibleWindow) await this.resetContext();
    }
  }
}
