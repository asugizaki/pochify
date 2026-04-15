import fs from "fs";
import path from "path";

const SITE_URL = "https://pochify.com";
const TRACKING_BASE = "https://go.pochify.com/go";

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getDealPagePath(slug) {
  return path.join("docs", "deals", `${slug}.html`);
}

function buildDealHtml(deal) {
  const title = escapeHtml(deal.name);
  const description = escapeHtml(
    deal.description || "A useful tool worth checking out."
  );
  const audience = escapeHtml(
    deal.audience || "Founders, creators, teams, and professionals"
  );

  const benefits = (deal.benefits || [
    "Helps you move faster",
    "Easy to get started with",
    "Can improve productivity quickly"
  ]).slice(0, 3);

  const whyNow = escapeHtml(
    deal.whyNow || "This is getting attention right now and is worth a closer look."
  );

  const pageUrl = `${SITE_URL}/deals/${deal.slug}.html`;
  const ctaUrl = `${TRACKING_BASE}/${deal.slug}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title} | Pochify</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${pageUrl}" />
  <meta property="og:title" content="${title} | Pochify" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${pageUrl}" />
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0b1220; color: #e5e7eb; line-height: 1.6; }
    .container { max-width: 860px; margin: 0 auto; padding: 40px 20px 80px; }
    .eyebrow { color: #22c55e; font-weight: bold; letter-spacing: 0.08em; font-size: 12px; text-transform: uppercase; }
    h1 { font-size: 40px; margin: 10px 0 12px; }
    .sub { color: #94a3b8; font-size: 18px; margin-bottom: 28px; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 24px; margin: 20px 0; }
    .cta { display: inline-block; background: #22c55e; color: #04130a; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: bold; margin-top: 8px; }
    ul { padding-left: 20px; }
    .muted { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="eyebrow">Pochify Pick</div>
    <h1>${title}</h1>
    <div class="sub">${description}</div>

    <div class="card">
      <h2>Why this tool stands out</h2>
      <p>${whyNow}</p>
      <a class="cta" href="${ctaUrl}" rel="nofollow sponsored">Try ${title}</a>
    </div>

    <div class="card">
      <h2>Best for</h2>
      <p>${audience}</p>
    </div>

    <div class="card">
      <h2>What people may like</h2>
      <ul>
        <li>${escapeHtml(benefits[0] || "")}</li>
        <li>${escapeHtml(benefits[1] || "")}</li>
        <li>${escapeHtml(benefits[2] || "")}</li>
      </ul>
    </div>

    <div class="card">
      <p class="muted">
        We curate tools and offers we think are worth checking out. Some links may be tracked so we can support Pochify.
      </p>
      <a class="cta" href="${ctaUrl}" rel="nofollow sponsored">Go to ${title}</a>
    </div>
  </div>
</body>
</html>`;
}

export function generateDealPage(deal) {
  ensureDir(path.join("docs", "deals"));
  const filePath = getDealPagePath(deal.slug);
  fs.writeFileSync(filePath, buildDealHtml(deal), "utf8");
  return filePath;
}

export function generateSitemap(deals) {
  ensureDir("docs");

  const urls = [
    `${SITE_URL}/`,
    ...deals.map((d) => `${SITE_URL}/deals/${d.slug}.html`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(path.join("docs", "sitemap.xml"), xml, "utf8");
}
