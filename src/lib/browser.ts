import Browserbase from "@browserbasehq/sdk";

// Domains that require a real browser (ArcGIS Hub, Esri web apps)
const JS_RENDERED = [
  /^https?:\/\/bikelanes\.ddot\.dc\.gov\//,
  /^https?:\/\/buspriority\.ddot\.dc\.gov\//,
  /^https?:\/\/ate\.ddot\.dc\.gov\//,
  /^https?:\/\/trails\.ddot\.dc\.gov\//,
  /^https?:\/\/[^/]+\.arcgis\.com\//,
  /^https?:\/\/[^/]+\.hub\.arcgis\.com\//,
];

export function needsBrowser(url: string): boolean {
  return JS_RENDERED.some((re) => re.test(url));
}

export function hasBrowserbaseConfig(): boolean {
  return !!(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID);
}

let bb: Browserbase | null = null;

function getClient(): Browserbase {
  if (!bb) bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
  return bb;
}

export async function fetchHtmlWithBrowser(url: string): Promise<string | null> {
  if (!hasBrowserbaseConfig()) return null;
  try {
    const session = await getClient().sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
    });
    const { chromium } = await import("playwright-core");
    const browser = await chromium.connectOverCDP(session.connectUrl);
    try {
      const ctx = browser.contexts()[0];
      const page = ctx.pages()[0] ?? (await ctx.newPage());
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      return await page.content();
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}
