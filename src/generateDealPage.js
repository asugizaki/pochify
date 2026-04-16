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
  const description = escapeHtml(deal.description || "A useful tool worth checking out.");
  const audience = escapeHtml(deal.audience || "Founders, creators, teams, and professionals");
  const whyNow = escapeHtml(deal.why_now || "This is worth a closer look right now.");
  const caution = escapeHtml(deal.caution || "It is usually worth testing fit before fully adopting a new tool.");
  const ctaUrl = `${TRACKING_BASE}/${deal.slug}`;
  const pageUrl = `${SITE_URL}/deals/${deal.slug}.html`;
  const benefits = Array.isArray(deal.benefits) ? deal.benefits.slice(0, 3) : [];
  const imageHtml = deal.og_image
    ? `<img src="${escapeHtml(deal.og_image)}" alt="${title}" style="max-width:100%;border-radius:14px;margin:16px 0 8px;" />`
    : "";

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
  ${deal.og_image ? `<meta property="og:image" content="${escapeHtml(deal.og_image)}" />` : ""}
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0b1220; color: #e5e7eb; line-height: 1.7; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px 80px; }
    .eyebrow { color: #22c55e; font-weight: bold; letter-spacing: 0.08em; font-size: 12px; text-transform: uppercase; }
    h1 { font-size: 40px; margin: 10px 0 12px; }
    .sub { color: #94a3b8; font-size: 18px; margin-bottom: 28px; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 24px; margin: 20px 0; }
    .cta { display: inline-block; background: #22c55e; color: #04130a; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: bold; margin-top: 8px; }
    ul { padding-left: 22px; }
    .muted { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="eyebrow">Pochify Pick</div>
    <h1>${title}</h1>
    <div class="sub">${description}</div>
    ${imageHtml}

    <div class="card">
      <h2>What this product is</h2>
      <p>${description}</p>
      <p>${escapeHtml(deal.hook || "")}</p>
      <a class="cta" href="${ctaUrl}" rel="nofollow sponsored">Try ${title}</a>
    </div>

    <div class="card">
      <h2>What’s the deal here</h2>
      <p>${deal.value_hook || "There may not be a direct discount, but this could still be valuable depending on your workflow."}</p>
    </div>

    <div class="card">
      <h2>Who this looks best for</h2>
      <p>${audience}</p>
    </div>

    <div class="card">
      <h2>Why someone might use it</h2>
      <ul>
        ${benefits.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
      </ul>
    </div>

    <div class="card">
      <h2>Why it may be worth checking now</h2>
      <p>${whyNow}</p>
    </div>

    <div class="card">
      <h2>One thing to keep in mind</h2>
      <p class="muted">${caution}</p>
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
