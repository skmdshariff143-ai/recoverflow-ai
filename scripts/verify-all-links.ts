import fs from 'fs';
import path from 'path';

interface LinkCheckResult {
  url: string;
  sourceFile: string;
  type: 'INTERNAL' | 'EXTERNAL';
  status: 'PASS' | 'FAIL' | 'UNVERIFIED';
  httpStatus?: number;
  reason?: string;
}

const PUBLIC_KNOWN_ROUTES = new Set([
  '/',
  '/demo',
  '/login',
  '/privacy',
  '/terms',
  '/trigger',
  '/ecommerce',
  '/icon',
  '/apple-icon',
  '/manifest.webmanifest',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/opengraph-image',
  '/robots.txt',
  '/sitemap.xml',
  // Console / app routes
  '/overview',
  '/recovery/cases',
  '/recovery/approvals',
  '/recovery/queue',
  '/recovery/promises',
  '/policies',
  '/operations',
  '/commerce',
  '/commerce/carts',
  '/commerce/payments',
  '/commerce/subscriptions',
  '/intelligence',
  '/intelligence/copilot',
  '/intelligence/experiments',
  '/intelligence/model-lab',
  '/communications',
  '/customers',
  '/developers',
  '/integrations',
  '/audit',
  '/analytics',
  '/settings',
  '/team',
]);

async function checkExternalUrl(url: string): Promise<{ status: 'PASS' | 'FAIL' | 'UNVERIFIED'; httpStatus?: number; reason?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RecoverFlow-Link-Verifier/1.0',
        Accept: '*/*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok || (res.status >= 200 && res.status < 400)) {
      return { status: 'PASS', httpStatus: res.status };
    } else if (res.status === 403 || res.status === 401 || res.status === 429) {
      return { status: 'UNVERIFIED', httpStatus: res.status, reason: `WAF / Auth / Rate-limited (${res.status})` };
    } else {
      return { status: 'FAIL', httpStatus: res.status, reason: `HTTP status ${res.status}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort') || message.includes('timeout')) {
      return { status: 'UNVERIFIED', reason: 'Network timeout (exceeded 6s)' };
    }
    return { status: 'UNVERIFIED', reason: `Network error: ${message}` };
  }
}

async function run() {
  console.log('--- Starting Link Verification Pass ---');

  const projectRoot = path.resolve(__dirname, '..');
  const webSrc = path.join(projectRoot, 'apps', 'web', 'src');

  const filesToScan: string[] = [];

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.next') {
          scanDir(fullPath);
        }
      } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        filesToScan.push(fullPath);
      }
    }
  }

  scanDir(webSrc);

  const foundLinks = new Map<string, string>(); // url -> first source file
  const hrefRegex = /href=["']([^"']+)["']/g;
  const targetRegex = /url=["']([^"']+)["']/g;

  for (const file of filesToScan) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
      let u = match[1].trim();
      if (u && !u.startsWith('#') && !u.startsWith('data:') && !u.includes('${')) {
        u = u.replace(/['",;)]+$/, '');
        if (!foundLinks.has(u)) foundLinks.set(u, path.relative(projectRoot, file));
      }
    }
    while ((match = targetRegex.exec(content)) !== null) {
      let u = match[1].trim();
      if (u && u.startsWith('http') && !u.includes('${')) {
        u = u.replace(/['",;)]+$/, '');
        if (!foundLinks.has(u)) foundLinks.set(u, path.relative(projectRoot, file));
      }
    }
  }

  // Also include key public anchors & demo links
  const explicitLinks = [
    'https://github.com/skmdshariff143-ai/recoverflow-ai',
    'https://recoverflow-ai-kohl.vercel.app',
    'https://recurly.com/research/state-of-subscriptions/',
    'https://retentionlens.com',
    'https://dashboard.razorpay.com/app/subscriptions',
    'https://rzp.io/rzp/IjAxpIvF',
    'https://rzp.io/rzp/e5G8pcyS',
    'https://rzp.io/rzp/NHunz5h2',
    'https://rzp.io/rzp/x2ojWWF',
    'https://rzp.io/rzp/Qv4oz6Bg',
    'https://rzp.io/rzp/ZML9D7m',
    'https://rzp.io/rzp/0UOWVfS',
    'https://rzp.io/rzp/JL1VfBVU',
    'https://rzp.io/rzp/l7Lmydn',
  ];

  for (const link of explicitLinks) {
    if (!foundLinks.has(link)) {
      foundLinks.set(link, 'apps/web/src/app/trigger/page.tsx');
    }
  }

  console.log(`Discovered ${foundLinks.size} user-facing navigation URLs.`);

  const results: LinkCheckResult[] = [];

  for (const [rawUrl, sourceFile] of foundLinks.entries()) {
    const cleanUrl = rawUrl.split('#')[0].split('?')[0];

    if (cleanUrl.startsWith('/')) {
      const isKnown = PUBLIC_KNOWN_ROUTES.has(cleanUrl) || cleanUrl.startsWith('/api/');
      results.push({
        url: rawUrl,
        sourceFile,
        type: 'INTERNAL',
        status: isKnown ? 'PASS' : 'FAIL',
        reason: isKnown ? undefined : 'Route does not exist in app directory',
      });
    } else if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      console.log(`Verifying external URL: ${cleanUrl}...`);
      const check = await checkExternalUrl(cleanUrl);
      results.push({
        url: rawUrl,
        sourceFile,
        type: 'EXTERNAL',
        status: check.status,
        httpStatus: check.httpStatus,
        reason: check.reason,
      });
    }
  }

  console.log('\n--- Link Check Summary Table ---');
  console.table(
    results.map((r) => ({
      URL: r.url.length > 50 ? r.url.slice(0, 47) + '...' : r.url,
      Type: r.type,
      Status: r.status,
      HTTP: r.httpStatus || '-',
      Reason: r.reason || 'OK',
    }))
  );

  const failed = results.filter((r) => r.status === 'FAIL');
  const unverified = results.filter((r) => r.status === 'UNVERIFIED');
  const passed = results.filter((r) => r.status === 'PASS');

  console.log(`\nResults: ${passed.length} PASS | ${unverified.length} UNVERIFIED | ${failed.length} FAIL (Total ${results.length})`);

  if (failed.length > 0) {
    console.error('FAILED LINKS:', failed);
  }
}

run().catch(console.error);
