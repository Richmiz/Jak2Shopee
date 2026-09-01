import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { assertJakMallUrl, CatalogError, type ImportOptions, type NormalizedProduct } from "../catalog-types.mts";
import { parseJakMallProduct, type RenderedProductHints } from "./jakmall-parser.mts";
import { selectRenderedPrice, type RenderedPriceCandidate } from "./rendered-price.mts";

type StageReporter = (stage: string, message: string, level?: "INFO" | "SUCCESS" | "WARNING" | "ERROR") => void;
type BrowserMode = "adaptive" | "headless" | "visible";

export function configuredBrowserMode(): BrowserMode {
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
  private readonly profileSuffix: string;

  constructor(profileSuffix = "") {
    this.profileSuffix = profileSuffix;
  }

  private async resetContext() {
    const context = this.context;
    this.context = undefined;
    this.contextHeadless = undefined;
    await context?.close().catch(() => undefined);
  }

  private async getContext(headless: boolean) {
    if (this.context && this.contextHeadless === headless) return this.context;
    if (this.context) await this.resetContext();
    const baseProfilePath = path.resolve(process.env.CATALOGBRIDGE_BROWSER_PROFILE || path.join(process.cwd(), "data", "browser-profile"));
    const profilePath = this.profileSuffix ? `${baseProfilePath}-${this.profileSuffix}` : baseProfilePath;
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
      const [html] = await Promise.all([
        page.content(),
        page.screenshot({ path: target, fullPage: true }),
      ]);
      await writeFile(target.replace(/\.png$/, ".html"), html, "utf8");
      return target;
    } catch {
      return undefined;
    }
  }

  private async navigate(page: Page, sourceUrl: string, timeoutMs: number) {
    page.setDefaultTimeout(timeoutMs);
    const response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
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

  private async renderedProductHints(page: Page, sourceUrl: string): Promise<RenderedProductHints> {
    const rendered = await page.locator("body").evaluate((body, url) => {
      const clean = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() ?? "";
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
      };
      const slugTokens = new URL(url).pathname.split("/").at(-1)?.split("-").filter((token) => token.length > 2 && !["dan", "yang", "untuk", "with", "the"].includes(token)) ?? [];
      const candidates = [...body.querySelectorAll("h1,h2,h3,[class*='title'],[class*='name'],[class*='product']")]
        .filter(visible)
        .map((element) => {
          const value = clean(element.textContent);
          const style = getComputedStyle(element);
          const className = clean(element.getAttribute("class")).toLowerCase();
          const overlap = slugTokens.filter((token) => value.toLowerCase().includes(token)).length;
          let score = overlap * 18 + Math.min(parseFloat(style.fontSize) || 0, 36);
          if (element.tagName === "H1") score += 50;
          else if (element.tagName === "H2") score += 20;
          if (/product/.test(className)) score += 15;
          if (/title|name/.test(className)) score += 12;
          if (Number(style.fontWeight) >= 600 || /bold|semibold/.test(style.fontWeight)) score += 10;
          if (element.getBoundingClientRect().top < 900) score += 8;
          if (value.includes("\n") || value.length < 15 || value.length > 240) score -= 100;
          if (/jakmall|kategori|wishlist|customer service|login|daftar/i.test(value)) score -= 50;
          return { value, score, top: element.getBoundingClientRect().top };
        })
        .filter((candidate) => candidate.score > 20)
        .sort((left, right) => right.score - left.score);
      const title = candidates[0]?.value;
      const titleTop = candidates[0]?.top ?? 0;

      const moneyCandidates = [...body.querySelectorAll("*")]
        .filter((element) => visible(element) && element.children.length <= 4)
        .flatMap((element) => {
          const value = clean(element.textContent);
          const matches = [...value.matchAll(/Rp\s*((?:\d\s*)+(?:\.\s*(?:\d\s*)+)*)/gi)];
          if (!matches.length || value.length > 140) return [];
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const rgb = style.color.match(/\d+/g)?.map(Number) ?? [];
          const warmColor = rgb.length >= 3 && rgb[0] > rgb[1] * 1.25 && rgb[0] > rgb[2] * 1.25;
          const parent = element.parentElement;
          return matches.map((match) => ({
            amount: Number(match[1].replace(/\D/g, "")),
            text: match[0],
            parentText: clean(parent?.textContent).slice(0, 240),
            className: clean(element.getAttribute("class")).toLowerCase(),
            parentClassName: clean(parent?.getAttribute("class")).toLowerCase(),
            fontSize: parseFloat(style.fontSize) || 0,
            fontWeight: Number(style.fontWeight) || (/bold|semibold/.test(style.fontWeight) ? 700 : 400),
            warmColor,
            lineThrough: /line-through/.test(style.textDecorationLine),
            top: rect.top,
            titleTop,
            childCount: element.children.length,
          }));
        })
        .filter((candidate) => candidate.amount > 0);

      const bodyText = clean(body.textContent);
      const sku = bodyText.match(/(?:Kode\s+)?SKU\s*:?\s*([A-Z0-9][A-Z0-9_-]{2,99}?)(?=\s*(?:Garansi|Warranty|Stok|Stock|Berat|Weight|Harga|Price|$))/i)?.[1]
        ?? bodyText.match(/(?:Kode\s+)?SKU\s*:?\s*([A-Z0-9][A-Z0-9_-]{2,99})/i)?.[1];
      const weightMatch = bodyText.match(/(?:Berat|Weight)\s*:?\s*([\d.,]+)\s*(kg|g|gram)/i);
      const weightAmount = weightMatch ? Number(weightMatch[1].replace(",", ".")) : 0;
      const weightGrams = weightMatch ? Math.round(weightMatch[2].toLowerCase() === "kg" ? weightAmount * 1000 : weightAmount) : undefined;
      const stockMatch = bodyText.match(/(?:Stok|Stock)(?:\s+(?:Tersedia|Tersisa|Available))?\s*:?\s*(\d[\d.,]*)/i)
        ?? bodyText.match(/(?:Tersedia|Tersisa|Available)\s*:?\s*(\d[\d.,]*)\s*(?:pcs|buah|unit)?/i)
        ?? bodyText.match(/(\d[\d.,]*)\s*(?:pcs|buah|unit)\s*(?:tersedia|tersisa|available|in stock)/i);
      const stock = stockMatch ? Number(stockMatch[1].replace(/[^\d]/g, "")) : undefined;
      const descriptionHeading = [...body.querySelectorAll("h2,h3,h4")].find((element) => /Informasi Produk|Product Information|Deskripsi Produk|Product Description/i.test(clean(element.textContent)));
      const descriptionRoot = descriptionHeading?.nextElementSibling ?? descriptionHeading?.parentElement;
      const description = descriptionRoot
        ? (descriptionRoot as HTMLElement).innerText.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean).join("\n").slice(0, 10_000)
        : undefined;
      const images = [...new Set([...body.querySelectorAll("img")]
        .filter((element) => visible(element) && element.getBoundingClientRect().width >= 70 && element.getBoundingClientRect().height >= 70 && element.getBoundingClientRect().top < 1000)
        .map((element) => element.currentSrc || element.src)
        .filter((value) => /^https?:/i.test(value) && !/logo|icon|avatar|payment|courier/i.test(value)))]
        .slice(0, 12);

      return { title, moneyCandidates, description, sku, stock, weightGrams, images };
    }, sourceUrl);
    return {
      title: rendered.title,
      sourcePrice: selectRenderedPrice(rendered.moneyCandidates as RenderedPriceCandidate[]),
      description: rendered.description,
      sku: rendered.sku,
      stock: rendered.stock,
      weightGrams: rendered.weightGrams,
      images: rendered.images,
    };
  }

  private async waitForVerification(page: Page, timeoutMs: number) {
    const deadline = Date.now() + Number(process.env.CATALOGBRIDGE_VERIFICATION_TIMEOUT_MS || Math.max(timeoutMs, 120_000));
    let signals = await this.pageSignals(page);
    while (Date.now() < deadline && isVerificationPage(signals.bodyText, signals.title)) {
      await page.waitForTimeout(1000);
      signals = await this.pageSignals(page);
    }
    return !isVerificationPage(signals.bodyText, signals.title);
  }

  async extract(jobId: string, sourceUrl: string, options: ImportOptions, report: StageReporter): Promise<NormalizedProduct> {
    assertJakMallUrl(sourceUrl);
    const mode = configuredBrowserMode();
    const timeoutMs = options.browserTimeoutSeconds * 1000;
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    let temporaryVisibleWindow = false;
    try {
      const initial = await this.openPage(mode !== "visible");
      context = initial.context;
      page = initial.page;
      report("NAVIGATING", "Opening the JakMall product in the background browser.");
      await this.navigate(page, sourceUrl, timeoutMs);
      let signals = await this.pageSignals(page);

      if (isVerificationPage(signals.bodyText, signals.title) && !options.pauseOnVerification) {
        const evidencePath = await this.captureEvidence(page, jobId);
        throw new CatalogError("SOURCE_VERIFICATION_REQUIRED", "JakMall verification requires operator attention and pausing is disabled for this job.", false, evidencePath);
      }

      if (isVerificationPage(signals.bodyText, signals.title) && mode === "adaptive") {
        report("WAITING_FOR_INPUT", "JakMall requires a one-time verification. Complete it in the temporary Chrome window.", "WARNING");
        await this.resetContext();
        const visible = await this.openPage(false);
        context = visible.context;
        page = visible.page;
        temporaryVisibleWindow = true;
        await this.navigate(page, sourceUrl, timeoutMs);
        if (!await this.waitForVerification(page, timeoutMs)) {
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
        if (!await this.waitForVerification(page, timeoutMs)) {
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
      const hints = await this.renderedProductHints(page, sourceUrl);
      const product = parseJakMallProduct(await page.content(), sourceUrl, options, hints);
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
