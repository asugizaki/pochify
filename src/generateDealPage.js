import fs from "fs";
import path from "path";

const SITE_URL = "https://pochify.com";
const TRACKING_BASE = "https://go.pochify.com/go";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function decodeHtmlEntities(text = "") {
  return String(text)
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&nbsp;/gi, " ");
}

function normalizeWhitespace(text = "") {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

function escapeHtml(text = "") {
  return normalizeWhitespace(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getDealPagePath(slug) {
  return path.join("docs", "deals", `${slug}.html`);
}

function buildSectionTitle(text) {
  return `<h2>${escapeHtml(text)}</h2>`;
}

function buildBenefitsHtml(benefits = []) {
  const safeBenefits = Array.isArray(benefits) ? benefits.filter(Boolean).slice(0, 4) : [];

  if (safeBenefits.length === 0) {
    return `
      <ul>
        <li>Could be useful if this category is relevant to your workflow</li>
        <li>Worth testing before committing to a long-term tool</li>
        <li>May help save time depending on your use case</li>
      </ul>
    `;
  }

  return `
    <ul>
      ${safeBenefits.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
    </ul>
  `;
}

function buildImageHtml(deal) {
  if (!deal.og_image) return "";

  return `
    <div class="hero-image-wrap">
      <img
        class="hero-image"
        src="${escapeHtml(deal.og_image)}"
        alt="${escapeHtml(deal.name)}"
        loading="lazy"
      />
    </div>
  `;
}

function buildDealHtml(deal) {
  const title = escapeHtml(deal.name || "Untitled Product");
  const description = escapeHtml(
    deal.description || "A useful product worth checking out."
  );
  const hook = escapeHtml(
    deal.hook || `${deal.name || "This product"} may be worth a closer look.`
  );
  const audience = escapeHtml(
    deal.audience || "Founders, creators, teams, and professionals"
  );
  const whyNow = escapeHtml(
    deal.why_now || "This looks worth checking now if the category is relevant to you."
  );
  const caution = escapeHtml(
    deal.caution || "It is usually worth testing a product first before fully adopting it."
  );
  const valueHook = escapeHtml(
    deal.value_hook || "There may not be a direct discount, but it may still offer meaningful value if it fits your workflow."
  );

  const metaDescription = escapeHtml(
    deal.meta_description || deal.description || "Pochify breakdown and review"
  );

  const ctaUrl = `${TRACKING_BASE}/${deal.slug}`;
  const pageUrl = `${SITE_URL}/deals/${deal.slug}.html`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title} | Pochify</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${metaDescription}" />
  <link rel="canonical" href="${pageUrl}" />
  <meta property="og:title" content="${title} | Pochify" />
  <meta property="og:description" content="${metaDescription}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${pageUrl}" />
  ${deal.og_image ? `<meta property="og:image" content="${escapeHtml(deal.og_image)}" />` : ""}
  <style>
    :root {
      --bg: #0b1220;
      --card: #111827;
      --card-border: #1f2937;
      --text: #e5e7eb;
      --muted: #94a3b8;
      --accent: #22c55e;
      --accent-dark: #04130a;
      --link: #93c5fd;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
    }

    .container {
      max-width: 920px;
      margin: 0 auto;
      padding: 40px 20px 80px;
    }

    .eyebrow {
      color: var(--accent);
      font-weight: bold;
      letter-spacing: 0.08em;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    h1 {
      font-size: 40px;
      line-height: 1.15;
      margin: 0 0 14px;
    }

    h2 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 24px;
    }

    .sub {
      color: var(--muted);
      font-size: 19px;
      margin-bottom: 24px;
    }

    .hero-image-wrap {
      margin: 0 0 24px;
    }

    .hero-image {
      display: block;
      width: 100%;
      max-width: 100%;
      border-radius: 16px;
      border: 1px solid var(--card-border);
      background: #0f172a;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      margin: 20px 0;
    }

    .cta-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }

    .cta {
      display: inline-block;
      background: var(--accent);
      color: var(--accent-dark);
      text-decoration: none;
      padding: 14px 22px;
      border-radius: 12px;
      font-weight: bold;
    }

    .secondary {
      display: inline-block;
      color: var(--text);
      text-decoration: none;
      padding: 14px 22px;
      border-radius: 12px;
      border: 1px solid #334155;
    }

    .muted {
      color: var(--muted);
    }

    ul {
      padding-left: 22px;
      margin-bottom: 0;
    }

    li + li {
      margin-top: 8px;
    }

    .footer {
      margin-top: 48px;
      color: #64748b;
      font-size: 14px;
    }

    .footer a {
      color: var(--link);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="eyebrow">Pochify Pick</div>

    <h1>${title}</h1>
    <div class="sub">${description}</div>

    ${buildImageHtml(deal)}

    <div class="card">
      ${buildSectionTitle("What this product is")}
      <p>${description}</p>
      <p>${hook}</p>

      <div class="cta-row">
        <a class="cta" href="${ctaUrl}" rel="nofollow sponsored">Try ${title}</a>
        <a class="secondary" href="https://t.me/pochify" target="_blank" rel="noopener">Join Telegram</a>
      </div>
    </div>

    <div class="card">
      ${buildSectionTitle("Why someone might use it")}
      ${buildBenefitsHtml(deal.benefits)}
    </div>

    <div class="card">
      ${buildSectionTitle("Who this looks best for")}
      <p>${audience}</p>
    </div>

    <div class="card">
      ${buildSectionTitle("What’s the value here")}
      <p>${valueHook}</p>
    </div>

    <div class="card">
      ${buildSectionTitle("Why it may be worth checking now")}
      <p>${whyNow}</p>
    </div>

    <div class="card">
      ${buildSectionTitle("One thing to keep in mind")}
      <p class="muted">${caution}</p>

      <div class="cta-row">
        <a class="cta" href="${ctaUrl}" rel="nofollow sponsored">Go to ${title}</a>
      </div>
    </div>

    <div class="footer">
      <p>
        <a href="${SITE_URL}">Pochify</a> curates AI tools, SaaS products, and useful software finds.
      </p>
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
