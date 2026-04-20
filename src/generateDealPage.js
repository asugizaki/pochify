import fs from "fs";
import path from "path";
import {
  escapeHtml,
  layout,
  footerHtml,
  shareButtonsHtml,
  structuredArticleData
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

function listHtml(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function faqHtml(faq = []) {
  if (!Array.isArray(faq) || !faq.length) return "";
  return faq
    .map(
      (item) => `
        <div style="margin-bottom:16px;">
          <strong>${escapeHtml(item.q)}</strong>
          <p>${escapeHtml(item.a)}</p>
        </div>
      `
    )
    .join("");
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

function buildDealHtml(deal) {
  const title = deal.name || "Untitled Product";
  const description = deal.description || "A useful product worth checking out.";
  const pageUrl = `${SITE_URL}/deals/${deal.slug}.html`;
  const ctaUrl = `${TRACKING_BASE}/${deal.slug}`;

  const bodyContent = `
    ${shareButtonsHtml({
      pageUrl,
      title,
      summary: deal.hook || description
    })}

    <div class="container narrow">
      <div class="breadcrumbs">
        <a href="/">Home</a> / <a href="/deals/">Deals</a> / ${escapeHtml(title)}
      </div>

      <div class="eyebrow">Pochify Pick</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">${escapeHtml(description)}</div>

      ${heroImage(deal)}
      ${priceBox(deal)}

      <div class="card">
        <h2>What this product is</h2>
        <p>${escapeHtml(description)}</p>
        ${Array.isArray(deal.overview_paragraphs) ? deal.overview_paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("") : ""}
        <div class="cta-row">
          <a class="cta" href="${ctaUrl}" target="_blank" rel="nofollow sponsored noopener noreferrer">Open deal on StackSocial</a>
          <a class="secondary" href="/deals/">More deals</a>
        </div>
      </div>

      <div class="card">
        <h2>Deal snapshot</h2>
        ${priceBox(deal)}
        <p style="margin-top:16px;">${escapeHtml(
          deal.deal_summary ||
          "This page summarizes the offer and sends you to the original StackSocial deal page to buy."
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

      ${deal.why_now ? `
        <div class="card">
          <h2>Why it may be worth checking now</h2>
          <p>${escapeHtml(deal.why_now)}</p>
        </div>
      ` : ""}

      ${deal.caution ? `
        <div class="card">
          <h2>One thing to keep in mind</h2>
          <p class="muted">${escapeHtml(deal.caution)}</p>
        </div>
      ` : ""}

      <div class="card">
        <h2>Get the deal</h2>
        <p>This page summarizes the offer, but the purchase happens on StackSocial.</p>
        <div class="cta-row">
          <a class="cta" href="${ctaUrl}" target="_blank" rel="nofollow sponsored noopener noreferrer">Go to StackSocial deal</a>
          ${deal.stacksocial_url ? `<a class="secondary" href="${escapeHtml(deal.stacksocial_url)}" target="_blank" rel="noopener noreferrer sponsored">View original deal page</a>` : ""}
        </div>
      </div>

      ${Array.isArray(deal.faq) && deal.faq.length ? `
        <div class="card">
          <h2>FAQ</h2>
          ${faqHtml(deal.faq)}
        </div>
      ` : ""}

      ${footerHtml(SITE_URL)}
    </div>
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
          <div class="hero-stats">
            <div class="hero-stat">
              <strong>AI</strong>
              <span>Tools for creators, builders, and teams</span>
            </div>
            <div class="hero-stat">
              <strong>Lifetime</strong>
              <span>One-time payment deals when available</span>
            </div>
            <div class="hero-stat">
              <strong>Fast</strong>
              <span>Quick price-first deal scanning</span>
            </div>
          </div>
        </section>

        <div class="section-header">
          <div>
            <h2 style="margin:0;">Latest picks</h2>
            <p>Newest high-quality pages on Pochify.</p>
          </div>
          <a class="secondary" href="/deals/">View all deals</a>
        </div>

        <div id="latestDeals" class="grid">
          <div class="empty">Loading latest picks…</div>
        </div>

        <div class="section-header">
          <div>
            <h2 style="margin:0;">Top clicked this week</h2>
            <p>What visitors are opening the most.</p>
          </div>
        </div>

        <div id="topClickedDeals" class="grid">
          <div class="empty">Loading top clicked picks…</div>
        </div>

        ${footerHtml(SITE_URL)}
      </div>

      <script>
        function card(item) {
          return \`
            <a class="deal-card-link" href="/deals/\${item.slug}.html">
              <div class="card deal-card">
                \${item.og_image ? '<img src="' + item.og_image + '" alt="' + item.name + '" loading="lazy" />' : ''}
                <h3>\${item.name}</h3>
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
            const res = await fetch("https://go.pochify.com/api/public/latest-deals");
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
            const res = await fetch("https://go.pochify.com/api/public/top-clicked?days=7");
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

        ${footerHtml(SITE_URL)}
      </div>

      <script>
        function card(item) {
          return \`
            <a class="deal-card-link" href="/deals/\${item.slug}.html">
              <div class="card deal-card">
                \${item.og_image ? '<img src="' + item.og_image + '" alt="' + item.name + '" loading="lazy" />' : ''}
                <h3>\${item.name}</h3>
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
          const url = "https://go.pochify.com/api/public/deals?limit=50${category ? `&category=${category}` : ""}";
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
        ${footerHtml(SITE_URL)}
      </div>
    `
  });
}

export function ensureShellPages() {
  writeIfMissing(path.join("docs", "index.html"), buildHomeShell());
  writeIfMissing(path.join("docs", "deals", "index.html"), buildDealsShell("Deals"));
  writeIfMissing(path.join("docs", "categories", "ai.html"), buildDealsShell("AI Tools", "ai"));
  writeIfMissing(path.join("docs", "categories", "saas.html"), buildDealsShell("SaaS Tools", "saas"));

  writeIfMissing(
    path.join("docs", "faq.html"),
    buildStaticPage({
      title: "FAQ",
      description: "Frequently asked questions about how Pochify works.",
      canonicalPath: "/faq.html",
      contentHtml: `
        <h2>What is Pochify?</h2>
        <p>Pochify curates discounted AI tools, SaaS products, and useful software picks.</p>
        <h2>Do I buy through Pochify?</h2>
        <p>No. Pochify summarizes the deal and links you to the original product or marketplace offer page.</p>
        <h2>Are all listings affiliate links?</h2>
        <p>No. During this phase, many links go directly to the source deal page while we focus on traffic and quality.</p>
      `
    })
  );

  writeIfMissing(
    path.join("docs", "privacy.html"),
    buildStaticPage({
      title: "Privacy Policy",
      description: "Privacy Policy for Pochify.",
      canonicalPath: "/privacy.html",
      contentHtml: `
        <p>Pochify may collect limited technical information such as page views, click activity, user-agent data, and referring pages.</p>
        <p>Pochify may use analytics services such as Google Analytics to measure site usage.</p>
      `
    })
  );

  writeIfMissing(
    path.join("docs", "terms.html"),
    buildStaticPage({
      title: "Terms & Conditions",
      description: "Terms and Conditions for Pochify.",
      canonicalPath: "/terms.html",
      contentHtml: `
        <p>Pochify provides informational content about software products, tools, and offers for general informational purposes only.</p>
        <p>Pochify does not guarantee that products, pricing, discounts, or offers will remain available or unchanged.</p>
      `
    })
  );
}

export function generateDealPage(deal) {
  const filePath = path.join("docs", "deals", `${deal.slug}.html`);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buildDealHtml(deal), "utf8");
  return filePath;
}

export function generateRobotsTxtIfMissing() {
  const filePath = path.join("docs", "robots.txt");
  writeIfMissing(
    filePath,
    `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
  );
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
}
