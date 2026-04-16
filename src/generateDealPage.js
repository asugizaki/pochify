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

function getCategoryPagePath(category) {
  return path.join("docs", "categories", `${category}.html`);
}

function navHtml() {
  return `
    <header class="site-header">
      <div class="nav-wrap">
        <a class="brand" href="/">Pochify</a>
        <nav class="nav-links">
          <a href="/">Home</a>
          <a href="/deals/">Browse Deals</a>
          <a href="/categories/ai.html">AI</a>
          <a href="/categories/saas.html">SaaS</a>
          <a href="https://t.me/pochify" target="_blank" rel="noopener">Telegram</a>
        </nav>
      </div>
    </header>
  `;
}

function globalStyles() {
  return `
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

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.7;
      }

      .site-header {
        position: sticky;
        top: 0;
        z-index: 20;
        background: rgba(11, 18, 32, 0.92);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid #1e293b;
      }

      .nav-wrap {
        max-width: 1100px;
        margin: 0 auto;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .brand {
        color: var(--text);
        text-decoration: none;
        font-weight: bold;
        font-size: 22px;
      }

      .nav-links {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
      }

      .nav-links a {
        color: var(--muted);
        text-decoration: none;
        font-size: 15px;
      }

      .nav-links a:hover,
      .brand:hover {
        color: var(--text);
      }

      .container {
        max-width: 1100px;
        margin: 0 auto;
        padding: 36px 20px 80px;
      }

      .narrow {
        max-width: 920px;
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
        font-size: 42px;
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

      .breadcrumbs {
        margin-bottom: 18px;
        color: var(--muted);
        font-size: 14px;
      }

      .breadcrumbs a {
        color: var(--link);
        text-decoration: none;
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

      .muted { color: var(--muted); }

      ul {
        padding-left: 22px;
        margin-bottom: 0;
      }

      li + li { margin-top: 8px; }

      .grid {
        display: grid;
        gap: 20px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .deal-card img {
        width: 100%;
        border-radius: 12px;
        margin-bottom: 14px;
        border: 1px solid #243041;
        background: #0f172a;
      }

      .deal-card h3,
      .deal-card h2 {
        margin-top: 0;
        margin-bottom: 10px;
      }

      .deal-card p {
        color: var(--muted);
      }

      .deal-card a.inline-link {
        display: inline-block;
        margin-top: 12px;
        color: var(--accent);
        text-decoration: none;
        font-weight: bold;
      }

      .share-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .share-btn {
        display: inline-block;
        padding: 10px 14px;
        border-radius: 10px;
        text-decoration: none;
        border: 1px solid #334155;
        color: var(--text);
        font-size: 14px;
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

      @media (max-width: 700px) {
        .nav-wrap {
          flex-direction: column;
          align-items: flex-start;
        }

        h1 {
          font-size: 34px;
        }
      }
    </style>
  `;
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

function getRelatedDeals(allDeals, currentDeal) {
  return allDeals
    .filter((d) => d.slug !== currentDeal.slug)
    .sort((a, b) => {
      const aSameChannel = a.channel === currentDeal.channel ? 1 : 0;
      const bSameChannel = b.channel === currentDeal.channel ? 1 : 0;
      if (aSameChannel !== bSameChannel) return bSameChannel - aSameChannel;
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, 3);
}

function buildRelatedDealsHtml(relatedDeals = []) {
  if (!relatedDeals.length) return "";

  return `
    <div class="card">
      <h2>Related tools worth browsing</h2>
      <div class="grid">
        ${relatedDeals.map((deal) => `
          <div class="deal-card">
            ${deal.og_image ? `<img src="${escapeHtml(deal.og_image)}" alt="${escapeHtml(deal.name)}" loading="lazy" />` : ""}
            <h3>${escapeHtml(deal.name)}</h3>
            <p>${escapeHtml(deal.hook || deal.description || "Read the full breakdown.")}</p>
            <a class="inline-link" href="/deals/${deal.slug}.html">Read full breakdown</a>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function buildShareHtml(deal) {
  const pageUrl = `${SITE_URL}/deals/${deal.slug}.html`;
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(`${deal.name} — ${deal.hook || deal.description || "Worth a look"}`);

  return `
    <div class="card">
      <h2>Share this pick</h2>
      <div class="share-row">
        <a class="share-btn" href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" rel="noopener">Share on X</a>
        <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener">Share on LinkedIn</a>
        <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener">Share on Facebook</a>
        <button class="share-btn" onclick="navigator.clipboard.writeText('${pageUrl}').then(() => alert('Link copied'))">Copy link</button>
      </div>
    </div>
  `;
}

function buildStructuredData(deal) {
  const pageUrl = `${SITE_URL}/deals/${deal.slug}.html`;
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: deal.name,
    description: deal.meta_description || deal.description || "",
    mainEntityOfPage: pageUrl,
    url: pageUrl,
    image: deal.og_image ? [deal.og_image] : [],
    author: {
      "@type": "Organization",
      name: "Pochify"
    },
    publisher: {
      "@type": "Organization",
      name: "Pochify"
    }
  };

  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function buildDealHtml(deal, allDeals) {
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
  const benefits = Array.isArray(deal.benefits) ? deal.benefits.slice(0, 4) : [];
  const relatedDeals = getRelatedDeals(allDeals, deal);

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
  <meta name="twitter:card" content="summary_large_image" />
  ${globalStyles()}
  ${buildStructuredData(deal)}
</head>
<body>
  ${navHtml()}
  <div class="container narrow">
    <div class="breadcrumbs">
      <a href="/">Home</a> / <a href="/deals/">Deals</a> / <a href="/categories/${escapeHtml(deal.channel || "general")}.html">${escapeHtml(deal.channel || "general")}</a> / ${title}
    </div>

    <div class="eyebrow">Pochify Pick</div>
    <h1>${title}</h1>
    <div class="sub">${description}</div>

    ${buildImageHtml(deal)}

    <div class="card">
      <h2>What this product is</h2>
      <p>${description}</p>
      <p>${hook}</p>

      <div class="cta-row">
        <a class="cta" href="${ctaUrl}" rel="nofollow sponsored">Try ${title}</a>
        <a class="secondary" href="/deals/">Browse more deals</a>
      </div>
    </div>

    <div class="card">
      <h2>Why someone might use it</h2>
      ${buildBenefitsHtml(benefits)}
    </div>

    <div class="card">
      <h2>Who this looks best for</h2>
      <p>${audience}</p>
    </div>

    <div class="card">
      <h2>What’s the value here</h2>
      <p>${valueHook}</p>
    </div>

    <div class="card">
      <h2>Why it may be worth checking now</h2>
      <p>${whyNow}</p>
    </div>

    <div class="card">
      <h2>One thing to keep in mind</h2>
      <p class="muted">${caution}</p>

      <div class="cta-row">
        <a class="cta" href="${ctaUrl}" rel="nofollow sponsored">Go to ${title}</a>
      </div>
    </div>

    ${buildRelatedDealsHtml(relatedDeals)}
    ${buildShareHtml(deal)}

    <div class="footer">
      <p>
        <a href="${SITE_URL}">Pochify</a> curates AI tools, SaaS products, and useful software finds.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildDealsIndexHtml(deals) {
  const items = deals
    .map((deal) => {
      const imageHtml = deal.og_image
        ? `<img src="${escapeHtml(deal.og_image)}" alt="${escapeHtml(deal.name)}" loading="lazy" />`
        : "";

      const summary = escapeHtml(deal.hook || deal.description || "Read the full breakdown.");

      return `
        <div class="card deal-card">
          ${imageHtml}
          <h2>${escapeHtml(deal.name)}</h2>
          <p>${summary}</p>
          <a class="inline-link" href="/deals/${deal.slug}.html">Read full breakdown</a>
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Browse Deals | Pochify</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Browse Pochify’s latest AI tools, SaaS products, and useful software picks." />
  <link rel="canonical" href="${SITE_URL}/deals/" />
  <meta name="robots" content="index,follow" />
  ${globalStyles()}
</head>
<body>
  ${navHtml()}
  <div class="container">
    <div class="breadcrumbs">
      <a href="/">Home</a> / Deals
    </div>

    <h1>Browse Deals</h1>
    <div class="sub">
      Explore Pochify’s latest AI tools, SaaS products, and software picks with full breakdowns.
    </div>

    <div class="grid">
      ${items || `<div class="card">No deals yet.</div>`}
    </div>
  </div>
</body>
</html>`;
}

function buildCategoryPageHtml(category, deals) {
  const pretty = category === "ai" ? "AI" : category === "saas" ? "SaaS" : "General";

  const items = deals.map((deal) => `
    <div class="card deal-card">
      ${deal.og_image ? `<img src="${escapeHtml(deal.og_image)}" alt="${escapeHtml(deal.name)}" loading="lazy" />` : ""}
      <h2>${escapeHtml(deal.name)}</h2>
      <p>${escapeHtml(deal.hook || deal.description || "Read the full breakdown.")}</p>
      <a class="inline-link" href="/deals/${deal.slug}.html">Read full breakdown</a>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${pretty} Tools | Pochify</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Browse ${pretty} tools and picks curated by Pochify." />
  <link rel="canonical" href="${SITE_URL}/categories/${category}.html" />
  <meta name="robots" content="index,follow" />
  ${globalStyles()}
</head>
<body>
  ${navHtml()}
  <div class="container">
    <div class="breadcrumbs">
      <a href="/">Home</a> / <a href="/deals/">Deals</a> / ${pretty}
    </div>

    <h1>${pretty} Tools</h1>
    <div class="sub">
      Browse curated ${pretty} products and breakdowns from Pochify.
    </div>

    <div class="grid">
      ${items || `<div class="card">No ${pretty} deals yet.</div>`}
    </div>
  </div>
</body>
</html>`;
}

export function generateDealPage(deal, allDeals) {
  ensureDir(path.join("docs", "deals"));
  const filePath = getDealPagePath(deal.slug);
  fs.writeFileSync(filePath, buildDealHtml(deal, allDeals), "utf8");
  return filePath;
}

export function generateDealsIndex(deals) {
  ensureDir(path.join("docs", "deals"));
  const filePath = path.join("docs", "deals", "index.html");
  fs.writeFileSync(filePath, buildDealsIndexHtml(deals), "utf8");
  return filePath;
}

export function generateCategoryPages(deals) {
  ensureDir(path.join("docs", "categories"));
  const categories = ["ai", "saas", "general"];

  const generated = [];

  for (const category of categories) {
    const filtered = deals.filter((d) => (d.channel || "general") === category);
    const filePath = getCategoryPagePath(category);
    fs.writeFileSync(filePath, buildCategoryPageHtml(category, filtered), "utf8");
    generated.push(filePath);
  }

  return generated;
}

export function generateRobotsTxt() {
  ensureDir("docs");
  fs.writeFileSync(
    path.join("docs", "robots.txt"),
    `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`,
    "utf8"
  );
}

export function generateSitemap(deals) {
  ensureDir("docs");

  const categoryUrls = [
    `${SITE_URL}/categories/ai.html`,
    `${SITE_URL}/categories/saas.html`,
    `${SITE_URL}/categories/general.html`
  ];

  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/deals/`,
    ...categoryUrls,
    ...deals.map((d) => `${SITE_URL}/deals/${d.slug}.html`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(path.join("docs", "sitemap.xml"), xml, "utf8");
}
