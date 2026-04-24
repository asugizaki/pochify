import fs from "fs";
import path from "path";
import {
  escapeHtml,
  layout,
  shareButtonsHtml,
  structuredArticleData,
  ensureSharedAssets
} from "./siteRenderer.js";

const SITE_URL = "https://pochify.com";
const TRACKING_BASE = "https://go.pochify.com/go";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeIfMissing(filePath, content) {
  ensureDir(path.dirname(filePath));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function listHtml(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function priceBox(deal) {
  if (!deal.current_price && !deal.original_price && !deal.discount_percent && !deal.offer_type) {
    return "";
  }

  return `
    <div class="price-box">
      ${deal.current_price ? `<span class="price-current">$${escapeHtml(String(deal.current_price))}</span>` : ""}
      ${deal.original_price ? `<span class="price-old">$${escapeHtml(String(deal.original_price))}</span>` : ""}
      ${deal.discount_percent ? `<span class="badge badge-sale">${escapeHtml(String(deal.discount_percent))}% off</span>` : ""}
      ${deal.offer_type === "lifetime" ? `<span class="badge">Lifetime deal</span>` : ""}
    </div>
  `;
}

function heroImage(deal) {
  if (!deal.og_image) return "";
  return `<img class="hero-image" src="${escapeHtml(deal.og_image)}" alt="${escapeHtml(deal.name)}" loading="lazy" />`;
}

function sourceLogoOnly(deal) {
  if (!deal.source_logo_path) return "";
  return `
    <div style="display:flex;align-items:center;justify-content:flex-start;margin-top:14px;">
      <img
        src="${escapeHtml(deal.source_logo_path)}"
        alt="${escapeHtml(deal.source_name || "Source")}"
        style="height:36px;width:auto;display:block;"
        loading="lazy"
      />
    </div>
  `;
}

function stickyDealCard(deal) {
  const ctaUrl = `${TRACKING_BASE}/${deal.slug}`;

  return `
    <aside class="card" style="position:sticky; top:90px;">
      ${sourceLogoOnly(deal)}
      <h3 style="font-size:18px;line-height:1.35;margin:14px 0 10px;">${escapeHtml(deal.name)}</h3>
      ${priceBox(deal)}
      <div class="cta-row" style="margin-top:16px;">
        <a class="cta" href="${ctaUrl}" target="_blank" rel="nofollow sponsored noopener noreferrer">Get Deal</a>
      </div>
    </aside>
  `;
}

function buildDealHtml(deal) {
  const title = deal.name || "Untitled Product";
  const description = deal.description || "A useful product worth checking out.";
  const pageUrl = `${SITE_URL}/deals/${deal.slug}.html`;
  const ctaUrl = `${TRACKING_BASE}/${deal.slug}`;

  const bodyContent = `
    ${shareButtonsHtml({
      pageUrl,
      title,
      summary: deal.hook || deal.description || ""
    })}

    <div class="container" style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:28px;">
      <main class="narrow" style="max-width:none;">
        <div class="breadcrumbs">
          <a href="/">Home</a> / <a href="/deals/">Deals</a> / ${escapeHtml(title)}
        </div>

        <div class="eyebrow">Pochify Pick</div>
        <h1>${escapeHtml(title)}</h1>
        <div class="sub">${escapeHtml(description)}</div>

        ${heroImage(deal)}
        ${priceBox(deal)}
        ${sourceLogoOnly(deal)}

        <div class="card">
          <h2>What this product is</h2>
          <p>${escapeHtml(description)}</p>
          ${Array.isArray(deal.overview_paragraphs) ? deal.overview_paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("") : ""}
        </div>

        <div class="card">
          <h2>Deal snapshot</h2>
          ${priceBox(deal)}
          ${sourceLogoOnly(deal)}
          <p style="margin-top:16px;">${escapeHtml(
            deal.deal_summary ||
            "This page summarizes the offer and sends you to the original deal page to buy."
          )}</p>
        </div>

        ${deal.audience ? `
          <div class="card">
            <h2>Who this looks best for</h2>
            <p>${escapeHtml(deal.audience)}</p>
          </div>
        ` : ""}

        ${Array.isArray(deal.feature_highlights) && deal.feature_highlights.length ? `
          <div class="card">
            <h2>Feature highlights</h2>
            ${listHtml(deal.feature_highlights)}
          </div>
        ` : ""}

        ${Array.isArray(deal.use_cases) && deal.use_cases.length ? `
          <div class="card">
            <h2>Where it may fit</h2>
            ${listHtml(deal.use_cases)}
          </div>
        ` : ""}

        <div class="card">
          <h2>Why someone might use it</h2>
          ${listHtml(
            Array.isArray(deal.benefits) && deal.benefits.length
              ? deal.benefits
              : [
                  "Could be useful if this category is relevant to your workflow",
                  "Worth testing before committing long term",
                  "May help save time depending on how you work"
                ]
          )}
        </div>

        <div class="card">
          <h2>Get the deal</h2>
          <div class="cta-row">
            <a class="cta" href="${ctaUrl}" target="_blank" rel="nofollow sponsored noopener noreferrer">Get Deal</a>
          </div>
        </div>
      </main>

      <div class="desktop-sticky-deal-card">
        ${stickyDealCard(deal)}
      </div>
    </div>

    <style>
      @media (max-width: 980px) {
        .desktop-sticky-deal-card { display:none; }
        .container[style*="grid-template-columns:minmax(0,1fr) 320px"] {
          display:block !important;
        }
      }
    </style>
  `;

  return layout({
    title: `${title} | Pochify`,
    description: deal.meta_description || description,
    canonicalUrl: pageUrl,
    ogImage: deal.og_image || "",
    extraHead: structuredArticleData({
      title,
      description: deal.meta_description || description,
      url: pageUrl,
      image: deal.og_image || ""
    }),
    bodyContent
  });
}

function buildTopAiDealsShell() {
  return layout({
    title: "Best AI Software Deals & Lifetime AI Tool Discounts | Pochify",
    description:
      "Browse curated AI software deals, lifetime AI tool discounts, and discounted automation, writing, image, voice, and productivity tools.",
    canonicalUrl: `${SITE_URL}/best-ai-deals.html`,
    bodyContent: `
      <div class="container">
        <div class="breadcrumbs">
          <a href="/">Home</a> / Best AI Deals
        </div>

        <section class="hero-panel">
          <div class="eyebrow">Curated AI Deals</div>
          <h1 class="hero-title">Best AI software deals worth checking today.</h1>
          <p class="hero-copy">
            Discover discounted AI tools, lifetime AI subscriptions, writing assistants,
            automation platforms, voice tools, image tools, and productivity software deals.
          </p>
        </section>

        <div class="card">
          <h2>AI Software Deals, Lifetime AI Tools & Discounted Automation Apps</h2>
          <p>
            This page tracks curated AI software deals from multiple deal platforms.
            Pochify focuses on offers with meaningful discounts, useful product categories,
            and clear pricing so you can quickly compare AI tools before buying.
          </p>
          <p>
            You’ll find AI writing tools, AI content generators, AI voice tools,
            AI automation apps, transcription software, image tools, chatbot builders,
            and other productivity-focused AI products.
          </p>
          <p>
            Many AI tools use recurring monthly pricing, so lifetime AI deals and large
            software discounts can be especially attractive if the product fits your workflow.
            Always review the original deal page before purchasing because pricing,
            plan limits, and availability can change.
          </p>
        </div>

        <div class="section-header">
          <div>
            <h2 style="margin:0;">Top AI deals</h2>
            <p>Curated AI software discounts and lifetime AI tool offers.</p>
          </div>
          <a class="secondary" href="/categories/ai.html">View all AI deals</a>
        </div>

        <div id="topAiDeals" class="grid">
          <div class="empty">Loading AI deals…</div>
        </div>

        <div class="card">
          <h2>How Pochify chooses AI deals</h2>
          <ul>
            <li>Meaningful discount, usually 50% off or better</li>
            <li>Clear pricing and source deal page</li>
            <li>Product image available for better review quality</li>
            <li>Useful AI or SaaS category fit</li>
          </ul>
        </div>

        <script>
          function sourceLogo(item) {
            return item.source_logo_path
              ? '<img src="' + item.source_logo_path + '" alt="' + (item.source_name || 'Source') + '" style="height:22px;width:auto;display:block;" />'
              : '';
          }

          function card(item) {
            return \`
              <a class="deal-card-link" href="/deals/\${item.slug}.html">
                <div class="card deal-card">
                  \${(item.card_image || item.og_image) ? '<img src="' + (item.card_image || item.og_image) + '" alt="' + item.name + '" loading="lazy" />' : ''}
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <h3>\${item.name}</h3>
                    \${sourceLogo(item)}
                  </div>
                  <div class="card-price-row">
                    \${item.current_price ? '<span class="card-price-current">$' + item.current_price + '</span>' : ''}
                    \${item.original_price ? '<span class="card-price-old">$' + item.original_price + '</span>' : ''}
                    \${item.discount_percent ? '<span class="badge badge-sale">' + item.discount_percent + '% off</span>' : ''}
                    \${item.offer_type === 'lifetime' ? '<span class="badge">Lifetime deal</span>' : ''}
                  </div>
                </div>
              </a>
            \`;
          }

          async function loadTopAiDeals() {
            const container = document.getElementById("topAiDeals");
            try {
              const res = await fetch("https://go.pochify.com/api/public/deals?category=ai&limit=24");
              const data = await res.json();
              const items = data.items || [];
              container.innerHTML = items.length ? items.map(card).join("") : '<div class="empty">No AI deals found.</div>';
            } catch {
              container.innerHTML = '<div class="empty">AI deals are temporarily unavailable.</div>';
            }
          }

          loadTopAiDeals();
        </script>
      </div>
    `
  });
}

function buildStaticPage({ title, description, canonicalPath, contentHtml }) {
  return layout({
    title: `${title} | Pochify`,
    description,
    canonicalUrl: `${SITE_URL}${canonicalPath}`,
    bodyContent: `
      <div class="container narrow">
        <div class="breadcrumbs"><a href="/">Home</a> / ${escapeHtml(title)}</div>
        <h1>${escapeHtml(title)}</h1>
        <div class="card">${contentHtml}</div>
      </div>
    `
  });
}

function buildHomeShell() {
  return layout({
    title: "Pochify — Find software deals worth your time",
    description: "Discover discounted AI tools, SaaS products, and useful software deals with pricing context and clean breakdowns.",
    canonicalUrl: `${SITE_URL}/`,
    bodyContent: `
      <div class="container">
        <section class="hero-panel">
          <div class="eyebrow">Fresh software deals</div>
          <h1 class="hero-title">Find better tools without paying full price.</h1>
          <p class="hero-copy">
            Pochify surfaces discounted AI tools, SaaS products, and lifetime software deals worth checking before they disappear.
          </p>
          <div class="cta-row">
            <a href="/deals/" class="cta">Browse deals</a>
            <a href="https://t.me/pochify" class="secondary" target="_blank" rel="noopener noreferrer">Join Telegram</a>
          </div>
        </section>

        <div class="section-header">
          <div>
            <h2 style="margin:0;">Latest picks</h2>
            <p>Newest high-quality pages on Pochify.</p>
          </div>
          <a class="secondary" href="/deals/">View all deals</a>
        </div>

        <div id="latestDeals" class="grid"><div class="empty">Loading latest picks…</div></div>

        <div class="section-header">
          <div>
            <h2 style="margin:0;">Top clicked this week</h2>
            <p>What visitors are opening the most.</p>
          </div>
        </div>

        <div id="topClickedDeals" class="grid"><div class="empty">Loading top clicked picks…</div></div>

        <script>
          function sourceLogo(item) {
            return item.source_logo_path
              ? '<img src="' + item.source_logo_path + '" alt="' + (item.source_name || 'Source') + '" style="height:22px;width:auto;display:block;" />'
              : '';
          }

          function card(item) {
            return \`
              <a class="deal-card-link" href="/deals/\${item.slug}.html">
                <div class="card deal-card">
                  \${(item.card_image || item.og_image) ? '<img src="' + (item.card_image || item.og_image) + '" alt="' + item.name + '" loading="lazy" />' : ''}
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <h3>\${item.name}</h3>
                    \${sourceLogo(item)}
                  </div>
                  <div class="card-price-row">
                    \${item.current_price ? '<span class="card-price-current">$' + item.current_price + '</span>' : ''}
                    \${item.original_price ? '<span class="card-price-old">$' + item.original_price + '</span>' : ''}
                    \${item.discount_percent ? '<span class="badge badge-sale">' + item.discount_percent + '% off</span>' : ''}
                    \${item.offer_type === 'lifetime' ? '<span class="badge">Lifetime deal</span>' : ''}
                  </div>
                </div>
              </a>
            \`;
          }

          async function loadLatestDeals() {
            const container = document.getElementById("latestDeals");
            try {
              const res = await fetch("https://go.pochify.com/api/public/latest-deals?limit=16");
              const data = await res.json();
              const items = data.items || [];
              container.innerHTML = items.length ? items.map(card).join("") : '<div class="empty">No picks yet.</div>';
            } catch {
              container.innerHTML = '<div class="empty">Latest picks are temporarily unavailable.</div>';
            }
          }

          async function loadTopClickedDeals() {
            const container = document.getElementById("topClickedDeals");
            try {
              const res = await fetch("https://go.pochify.com/api/public/top-clicked?days=7&limit=8");
              const data = await res.json();
              const items = data.items || [];
              container.innerHTML = items.length ? items.map(card).join("") : '<div class="empty">No top clicked data yet.</div>';
            } catch {
              container.innerHTML = '<div class="empty">Top clicked picks are temporarily unavailable.</div>';
            }
          }

          loadLatestDeals();
          loadTopClickedDeals();
        </script>
      </div>
    `
  });
}

function buildDealsShell(title, category = "") {
  const canonicalUrl = category
    ? `${SITE_URL}/categories/${category}.html`
    : `${SITE_URL}/deals/`;

  return layout({
    title,
    description: "Browse discounted AI tools and software deals from Pochify.",
    canonicalUrl,
    bodyContent: `
      <div class="container">
        <div class="breadcrumbs">
          <a href="/">Home</a> / ${category ? `<a href="/deals/">Deals</a> / ${escapeHtml(category.toUpperCase())}` : "Deals"}
        </div>

        <h1>${escapeHtml(title)}</h1>
        <div class="sub">Browse the latest high-quality deal pages from Pochify.</div>

        <div id="dealsGrid" class="grid"><div class="empty">Loading deals…</div></div>

        <script>
          function sourceLogo(item) {
            return item.source_logo_path
              ? '<img src="' + item.source_logo_path + '" alt="' + (item.source_name || 'Source') + '" style="height:22px;width:auto;display:block;" />'
              : '';
          }

          function card(item) {
            return \`
              <a class="deal-card-link" href="/deals/\${item.slug}.html">
                <div class="card deal-card">
                  \${(item.card_image || item.og_image) ? '<img src="' + (item.card_image || item.og_image) + '" alt="' + item.name + '" loading="lazy" />' : ''}
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <h3>\${item.name}</h3>
                    \${sourceLogo(item)}
                  </div>
                  <div class="card-price-row">
                    \${item.current_price ? '<span class="card-price-current">$' + item.current_price + '</span>' : ''}
                    \${item.original_price ? '<span class="card-price-old">$' + item.original_price + '</span>' : ''}
                    \${item.discount_percent ? '<span class="badge badge-sale">' + item.discount_percent + '% off</span>' : ''}
                    \${item.offer_type === 'lifetime' ? '<span class="badge">Lifetime deal</span>' : ''}
                  </div>
                </div>
              </a>
            \`;
          }

          async function loadDeals() {
            const container = document.getElementById("dealsGrid");
            const url = "https://go.pochify.com/api/public/deals?limit=40${category ? `&category=${category}` : ""}";
            try {
              const res = await fetch(url);
              const data = await res.json();
              const items = data.items || [];
              container.innerHTML = items.length ? items.map(card).join("") : '<div class="empty">No deals found.</div>';
            } catch {
              container.innerHTML = '<div class="empty">Deals are temporarily unavailable.</div>';
            }
          }

          loadDeals();
        </script>
      </div>
    `
  });
}

export function ensureShellPages() {
  ensureSharedAssets();

  writeIfMissing(path.join("docs", "index.html"), buildHomeShell());
  writeIfMissing(path.join("docs", "deals", "index.html"), buildDealsShell("Deals"));
  writeIfMissing(path.join("docs", "categories", "ai.html"), buildDealsShell("AI Tools", "ai"));
  writeIfMissing(path.join("docs", "categories", "saas.html"), buildDealsShell("SaaS Tools", "saas"));
  writeIfMissing(path.join("docs", "best-ai-deals.html"), buildTopAiDealsShell());

  writeIfMissing(
    path.join("docs", "faq.html"),
    buildStaticPage({
      title: "FAQ",
      description: "Frequently asked questions about how Pochify works.",
      canonicalPath: "/faq.html",
      contentHtml: `
        <h2>What is Pochify?</h2>
        <p>Pochify curates discounted AI tools, SaaS products, and useful software picks.</p>

        <h2>How are deals chosen?</h2>
        <p>Pochify reviews software deals and highlights offers that meet pricing and quality thresholds.</p>

        <h2>Do prices change?</h2>
        <p>Yes. Prices and discounts can change at any time on the original seller’s site.</p>
      `
    })
  );

  writeIfMissing(
    path.join("docs", "privacy.html"),
    buildStaticPage({
      title: "Privacy Policy",
      description: "Privacy policy for Pochify.",
      canonicalPath: "/privacy.html",
      contentHtml: `
        <p>Pochify may collect basic analytics, referral click data, and standard technical information needed to operate and improve the site.</p>
        <p>We do not sell personal information. Third-party services such as analytics providers or external deal platforms may also process data according to their own policies.</p>
        <p>By using Pochify, you agree to the use of cookies or similar technologies where applicable for analytics and site performance.</p>
      `
    })
  );

  writeIfMissing(
    path.join("docs", "terms.html"),
    buildStaticPage({
      title: "Terms and Conditions",
      description: "Terms and conditions for Pochify.",
      canonicalPath: "/terms.html",
      contentHtml: `
        <p>Pochify provides informational summaries of third-party software deals. We do not guarantee availability, pricing accuracy, or seller fulfillment.</p>
        <p>All purchases are made on third-party websites and are subject to those providers’ policies, warranties, and refund terms.</p>
        <p>Pochify may earn referral commissions from qualifying clicks or purchases.</p>
      `
    })
  );

  ensureDir(path.join("docs", "partials"));
  ensureDir(path.join("docs", "assets"));

  writeFile(
    path.join("docs", "partials", "header.html"),
    `<header class="site-header">
  <div class="nav-wrap">
    <a class="brand" href="/">
      <img src="/assets/pochify_logo.png" alt="Pochify" />
    </a>
    <button class="menu-toggle" aria-label="Toggle menu" onclick="toggleMenu()">☰</button>
    <nav class="nav-links" id="siteNav">
      <a href="/deals/">Deals</a>
      <a href="/best-ai-deals.html">Top AI Deals</a>
      <a href="/categories/ai.html">AI</a>
      <a href="/categories/saas.html">SaaS</a>
      <a href="https://t.me/pochify" target="_blank" rel="noopener">Telegram</a>
    </nav>
  </div>
</header>`
  );

  writeFile(
    path.join("docs", "partials", "footer.html"),
    `<div class="container">
  <div class="footer">
    <p><a href="https://pochify.com">Pochify</a> curates AI tools, SaaS products, and useful software finds.</p>
    <p class="footer-links">
      <a href="/faq.html">FAQ</a>
      <a href="/privacy.html">Privacy Policy</a>
      <a href="/terms.html">Terms & Conditions</a>
    </p>
  </div>
</div>`
  );

  writeFile(
    path.join("docs", "assets", "layout.js"),
    `async function injectPartial(targetId, url) {
  const el = document.getElementById(targetId);
  if (!el) return;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(\`Failed to load \${url}\`);
    el.innerHTML = await res.text();
  } catch (error) {
    console.error(error);
  }
}

function toggleMenu() {
  const nav = document.getElementById("siteNav");
  if (nav) nav.classList.toggle("open");
}

async function initLayout() {
  await injectPartial("site-header", "/partials/header.html");
  await injectPartial("site-footer", "/partials/footer.html");
}

initLayout();
window.toggleMenu = toggleMenu;`
  );

  console.log("📄 Ensured static pages exist:", [
    "docs/faq.html",
    "docs/privacy.html",
    "docs/terms.html"
  ]);
}

export function generateDealPage(deal) {
  ensureSharedAssets();
  const filePath = path.join("docs", "deals", `${deal.slug}.html`);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buildDealHtml(deal), "utf8");
  return filePath;
}

export function generateRobotsTxtIfMissing() {
  const filePath = path.join("docs", "robots.txt");
  writeIfMissing(filePath, `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);
  console.log("🤖 Ensured robots.txt exists");
}

export function generateSitemapFromDeals(deals) {
  ensureDir("docs");
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/deals/`,
    `${SITE_URL}/categories/ai.html`,
    `${SITE_URL}/categories/saas.html`,
    `${SITE_URL}/faq.html`,
    `${SITE_URL}/privacy.html`,
    `${SITE_URL}/terms.html`,
    ...deals.map((d) => `${SITE_URL}/deals/${d.slug}.html`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(path.join("docs", "sitemap.xml"), xml, "utf8");
  console.log("🗺️ Generated sitemap");
}
