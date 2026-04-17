import fs from "fs";
import path from "path";
import {
  escapeHtml,
  layout,
  dealCardHtml,
  footerHtml,
  paginationHtml,
  shareButtonsHtml,
  structuredArticleData
} from "./siteRenderer.js";

const SITE_URL = "https://pochify.com";
const TRACKING_BASE = "https://go.pochify.com/go";
const DEALS_PER_PAGE = 12;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getDealPagePath(slug) {
  return path.join("docs", "deals", `${slug}.html`);
}

function getCategoryPagePath(category) {
  return path.join("docs", "categories", `${category}.html`);
}

function getDealsIndexPagePath(pageNumber) {
  if (pageNumber === 1) {
    return path.join("docs", "deals", "index.html");
  }
  return path.join("docs", "deals", "page", String(pageNumber), "index.html");
}

function buildBenefitsHtml(benefits = []) {
  const safeBenefits = Array.isArray(benefits) ? benefits.filter(Boolean).slice(0, 4) : [];

  if (!safeBenefits.length) {
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
  return `<img class="hero-image" src="${escapeHtml(deal.og_image)}" alt="${escapeHtml(deal.name)}" loading="lazy" />`;
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

function buildRelatedDealsDynamic(deal) {
  return `
    <div class="card">
      <h2>Related tools worth browsing</h2>
      <div id="relatedDeals" class="grid">
        <div class="muted">Loading related tools…</div>
      </div>
    </div>

    <script>
      async function loadRelatedDeals() {
        const container = document.getElementById("relatedDeals");
        if (!container) return;

        try {
          const res = await fetch("https://go.pochify.com/api/public/related-deals?slug=${encodeURIComponent(deal.slug)}");
          if (!res.ok) throw new Error("HTTP " + res.status);
          const data = await res.json();
          const items = data.items || [];

          if (!items.length) {
            container.innerHTML = '<div class="muted">No related tools found yet.</div>';
            return;
          }

          container.innerHTML = items.map(item => \`
            <div class="deal-card">
              \${item.og_image ? '<img src="' + item.og_image + '" alt="' + item.name + '" loading="lazy" />' : ''}
              <h3>\${item.name}</h3>
              <p>\${item.hook || item.description || 'Read the full breakdown.'}</p>
              <a class="inline-link" href="/deals/\${item.slug}.html">Read full breakdown</a>
            </div>
          \`).join("");
        } catch (err) {
          console.error("Failed to load related deals", err);
          container.innerHTML = '<div class="muted">Related tools are temporarily unavailable.</div>';
        }
      }

      loadRelatedDeals();
    </script>
  `;
}

function buildDealHtml(deal, allDeals) {
  const title = deal.name || "Untitled Product";
  const description = deal.description || "A useful product worth checking out.";
  const hook = deal.hook || `${deal.name || "This product"} may be worth a closer look.`;
  const audience = deal.audience || "Founders, creators, teams, and professionals";
  const whyNow = deal.why_now || "This looks worth checking now if the category is relevant to you.";
  const caution = deal.caution || "It is usually worth testing a product first before fully adopting it.";
  const valueHook =
    deal.value_hook ||
    "There may not be a direct discount, but it may still offer meaningful value if it fits your workflow.";

  const metaDescription = deal.meta_description || deal.description || "Pochify breakdown and review";
  const pageUrl = `${SITE_URL}/deals/${deal.slug}.html`;
  const ctaUrl = `${TRACKING_BASE}/${deal.slug}`;
  const benefits = Array.isArray(deal.benefits) ? deal.benefits.slice(0, 4) : [];
  const relatedDeals = getRelatedDeals(allDeals, deal);

  const bodyContent = `
    <div class="container narrow">
      <div class="breadcrumbs">
        <a href="/">Home</a> / <a href="/deals/">Deals</a> / <a href="/categories/${escapeHtml(deal.channel || "general")}.html">${escapeHtml(deal.channel || "general")}</a> / ${escapeHtml(title)}
      </div>

      <div class="eyebrow">Pochify Pick</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">${escapeHtml(description)}</div>

      ${buildImageHtml(deal)}

      <div class="card">
        <h2>What this product is</h2>
        <p>${escapeHtml(description)}</p>
        <p>${escapeHtml(hook)}</p>

        <div class="cta-row">
          <a class="cta" href="${ctaUrl}" rel="nofollow sponsored">Try ${escapeHtml(title)}</a>
          <a class="secondary" href="/deals/">More deals</a>
        </div>
      </div>

      <div class="card">
        <h2>Why someone might use it</h2>
        ${buildBenefitsHtml(benefits)}
      </div>

      <div class="card">
        <h2>Who this looks best for</h2>
        <p>${escapeHtml(audience)}</p>
      </div>

      <div class="card">
        <h2>What’s the value here</h2>
        <p>${escapeHtml(valueHook)}</p>
      </div>

      <div class="card">
        <h2>Why it may be worth checking now</h2>
        <p>${escapeHtml(whyNow)}</p>
      </div>

      <div class="card">
        <h2>One thing to keep in mind</h2>
        <p class="muted">${escapeHtml(caution)}</p>

        <div class="cta-row">
          <a class="cta" href="${ctaUrl}" rel="nofollow sponsored">Go to ${escapeHtml(title)}</a>
        </div>
      </div>

      ${buildRelatedDealsDynamic(deal)}

      <div class="card">
        <h2>More picks from this batch</h2>
        <div class="grid">
          ${relatedDeals.map((item) => dealCardHtml(item)).join("")}
        </div>
      </div>

      ${shareButtonsHtml({
        pageUrl,
        title,
        summary: hook || description
      })}

      ${footerHtml(SITE_URL)}
    </div>
  `;

  return layout({
    title: `${title} | Pochify`,
    description: metaDescription,
    canonicalUrl: pageUrl,
    ogImage: deal.og_image || "",
    extraHead: structuredArticleData({
      title,
      description: metaDescription,
      url: pageUrl,
      image: deal.og_image || ""
    }),
    bodyContent,
    siteUrl: SITE_URL
  });
}

function buildDealsIndexHtml(deals, currentPage, totalPages) {
  const cards = deals.map((deal) => dealCardHtml(deal)).join("");

  const bodyContent = `
    <div class="container">
      <div class="breadcrumbs">
        <a href="/">Home</a> / Deals
      </div>

      <h1>Deals</h1>
      <div class="sub">
        Explore Pochify’s latest AI tools, SaaS products, and software picks with full breakdowns.
      </div>

      <div class="grid">
        ${cards || `<div class="card">No deals yet.</div>`}
      </div>

      ${paginationHtml({
        basePath: "/deals",
        currentPage,
        totalPages
      })}

      ${footerHtml(SITE_URL)}
    </div>
  `;

  const canonicalUrl =
    currentPage === 1
      ? `${SITE_URL}/deals/`
      : `${SITE_URL}/deals/page/${currentPage}/`;

  return layout({
    title: currentPage === 1 ? "Deals | Pochify" : `Deals - Page ${currentPage} | Pochify`,
    description: "Browse Pochify’s latest AI tools, SaaS products, and useful software picks.",
    canonicalUrl,
    bodyContent,
    siteUrl: SITE_URL
  });
}

function buildCategoryPageHtml(category, deals) {
  const pretty = category === "ai" ? "AI" : category === "saas" ? "SaaS" : "General";
  const cards = deals.map((deal) => dealCardHtml(deal)).join("");

  const bodyContent = `
    <div class="container">
      <div class="breadcrumbs">
        <a href="/">Home</a> / <a href="/deals/">Deals</a> / ${pretty}
      </div>

      <h1>${pretty} Tools</h1>
      <div class="sub">
        Browse curated ${pretty} products and breakdowns from Pochify.
      </div>

      <div class="grid">
        ${cards || `<div class="card">No ${pretty} deals yet.</div>`}
      </div>

      ${footerHtml(SITE_URL)}
    </div>
  `;

  return layout({
    title: `${pretty} Tools | Pochify`,
    description: `Browse ${pretty} tools and picks curated by Pochify.`,
    canonicalUrl: `${SITE_URL}/categories/${category}.html`,
    bodyContent,
    siteUrl: SITE_URL
  });
}

function buildHomePageHtml() {
  const bodyContent = `
    <div class="container">
      <div class="hero" style="text-align:center;">
        <h1>Find tools actually worth using</h1>
        <div class="sub">
          We surface AI tools and SaaS products that help you save time, save money, or get ahead early — not just random launches.
        </div>

        <a href="https://t.me/pochify" class="cta">Join Telegram</a>
        <a href="/deals/" class="secondary">Browse all deals</a>
      </div>

      <div class="card" style="margin-top:80px;">
        <h2>What you’ll get</h2>
        <div class="grid">
          <div>
            <h3>💰 Real value</h3>
            <p class="muted">Free tiers, trials, discounts, and tools that can replace paid ones.</p>
          </div>
          <div>
            <h3>⚡ Early advantage</h3>
            <p class="muted">Discover tools before they get expensive or saturated.</p>
          </div>
          <div>
            <h3>🧠 Clear breakdowns</h3>
            <p class="muted">We explain what the product actually does and who it’s for.</p>
          </div>
          <div>
            <h3>🚫 No fluff</h3>
            <p class="muted">No fake discounts, no spam — only products that pass a usefulness filter.</p>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:40px;">
        <h2>Browse by category</h2>
        <div class="grid">
          <div>
            <h3>AI</h3>
            <p class="muted">Products focused on AI workflows, assistants, generation, and automation.</p>
            <a class="inline-link" href="/categories/ai.html">Explore AI</a>
          </div>
          <div>
            <h3>SaaS</h3>
            <p class="muted">Software products built for productivity, teams, and recurring workflows.</p>
            <a class="inline-link" href="/categories/saas.html">Explore SaaS</a>
          </div>
          <div>
            <h3>General</h3>
            <p class="muted">Other useful tools that still look worth reviewing.</p>
            <a class="inline-link" href="/categories/general.html">Explore General</a>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:40px;">
        <h2>Latest picks</h2>
        <div id="latestDeals" class="grid">
          <div class="empty">Loading latest picks…</div>
        </div>
      </div>

      <div class="card" style="margin-top:40px;">
        <h2>Top clicked this week</h2>
        <div id="topClickedDeals" class="grid">
          <div class="empty">Loading top clicked picks…</div>
        </div>
      </div>

      ${footerHtml(SITE_URL)}
    </div>

    <script>
      async function loadLatestDeals() {
        const container = document.getElementById("latestDeals");

        try {
          const res = await fetch("https://go.pochify.com/api/public/latest-deals");
          if (!res.ok) throw new Error("HTTP " + res.status);

          const data = await res.json();
          const items = data.items || [];

          if (!items.length) {
            container.innerHTML = '<div class="empty">No picks yet. Check back soon.</div>';
            return;
          }

          container.innerHTML = items.map(item => \`
            <div class="deal-card">
              \${item.og_image ? '<img src="' + item.og_image + '" alt="' + item.name + '" loading="lazy" />' : ''}
              <h3>\${item.name}</h3>
              <p>\${item.hook || item.description || 'Read the full breakdown.'}</p>
              <a class="inline-link" href="/deals/\${item.slug}.html">Read full breakdown</a>
            </div>
          \`).join("");
        } catch (err) {
          console.error("Failed to load latest deals", err);
          container.innerHTML = '<div class="empty">Latest picks are temporarily unavailable.</div>';
        }
      }

      async function loadTopClickedDeals() {
        const container = document.getElementById("topClickedDeals");

        try {
          const res = await fetch("https://go.pochify.com/api/public/top-clicked?days=7");
          if (!res.ok) throw new Error("HTTP " + res.status);

          const data = await res.json();
          const items = data.items || [];

          if (!items.length) {
            container.innerHTML = '<div class="empty">No top clicked data yet.</div>';
            return;
          }

          container.innerHTML = items.map(item => \`
            <div class="deal-card">
              \${item.og_image ? '<img src="' + item.og_image + '" alt="' + item.name + '" loading="lazy" />' : ''}
              <h3>\${item.name}</h3>
              <p>\${item.hook || item.description || 'Read the full breakdown.'}</p>
              <a class="inline-link" href="/deals/\${item.slug}.html">Read full breakdown</a>
            </div>
          \`).join("");
        } catch (err) {
          console.error("Failed to load top clicked deals", err);
          container.innerHTML = '<div class="empty">Top clicked picks are temporarily unavailable.</div>';
        }
      }

      loadLatestDeals();
      loadTopClickedDeals();
    </script>
  `;

  return layout({
    title: "Pochify — Find tools worth your time (and money)",
    description: "Discover AI tools, SaaS products, and software that actually bring value — including free tiers, trials, and early opportunities before prices rise.",
    canonicalUrl: `${SITE_URL}/`,
    bodyContent,
    siteUrl: SITE_URL
  });
}

function buildStaticPage({ title, description, canonicalPath, contentHtml }) {
  const bodyContent = `
    <div class="container narrow">
      <div class="breadcrumbs">
        <a href="/">Home</a> / ${escapeHtml(title)}
      </div>

      <h1>${escapeHtml(title)}</h1>

      <div class="card">
        ${contentHtml}
      </div>

      ${footerHtml(SITE_URL)}
    </div>
  `;

  return layout({
    title: `${title} | Pochify`,
    description,
    canonicalUrl: `${SITE_URL}${canonicalPath}`,
    bodyContent,
    siteUrl: SITE_URL
  });
}

export function generateDealPage(deal, allDeals) {
  ensureDir(path.join("docs", "deals"));
  const filePath = getDealPagePath(deal.slug);
  fs.writeFileSync(filePath, buildDealHtml(deal, allDeals), "utf8");
  return filePath;
}

export function generateDealsIndex(deals) {
  ensureDir(path.join("docs", "deals"));

  const sortedDeals = [...deals].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const totalPages = Math.max(1, Math.ceil(sortedDeals.length / DEALS_PER_PAGE));
  const generated = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const start = (page - 1) * DEALS_PER_PAGE;
    const items = sortedDeals.slice(start, start + DEALS_PER_PAGE);
    const filePath = getDealsIndexPagePath(page);

    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, buildDealsIndexHtml(items, page, totalPages), "utf8");
    generated.push(filePath);
  }

  return generated;
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

export function generateHomePage() {
  ensureDir("docs");
  const filePath = path.join("docs", "index.html");
  fs.writeFileSync(filePath, buildHomePageHtml(), "utf8");
  return filePath;
}

export function generateStaticPages() {
  ensureDir("docs");

  const faqPath = path.join("docs", "faq.html");
  const privacyPath = path.join("docs", "privacy.html");
  const termsPath = path.join("docs", "terms.html");

  fs.writeFileSync(
    faqPath,
    buildStaticPage({
      title: "FAQ",
      description: "Frequently asked questions about how Pochify works.",
      canonicalPath: "/faq.html",
      contentHtml: `
        <h2>What is Pochify?</h2>
        <p>Pochify curates AI tools, SaaS products, and useful software picks. We focus on products that may help people save time, save money, or get ahead early.</p>

        <h2>Are all listings discounts?</h2>
        <p>No. Some picks may have discounts, free trials, or free tiers. Others may simply be strong tools that look valuable based on their use case and early traction.</p>

        <h2>How do you choose what to feature?</h2>
        <p>We monitor product launches and other signals, then filter for products that appear useful, relevant, and worth a closer look.</p>

        <h2>Do you use affiliate links?</h2>
        <p>Yes, some links may be tracked affiliate links. That helps support Pochify at no extra cost to the user in most cases.</p>

        <h2>How often is the site updated?</h2>
        <p>We update regularly as new products are discovered and reviewed.</p>
      `
    }),
    "utf8"
  );

  fs.writeFileSync(
    privacyPath,
    buildStaticPage({
      title: "Privacy Policy",
      description: "Privacy Policy for Pochify.",
      canonicalPath: "/privacy.html",
      contentHtml: `
        <p>Pochify may collect limited technical information such as click activity, user-agent data, and referring pages in order to understand which pages and links perform best.</p>
        <p>Pochify may use affiliate links, which can involve third-party tracking by affiliate networks or product providers.</p>
        <p>Pochify does not sell personal information. If email capture or additional data collection is added later, this policy should be updated accordingly.</p>
        <p>By using the site, you agree to the collection and processing of limited usage data for analytics, site improvement, and affiliate attribution purposes.</p>
      `
    }),
    "utf8"
  );

  fs.writeFileSync(
    termsPath,
    buildStaticPage({
      title: "Terms & Conditions",
      description: "Terms and Conditions for Pochify.",
      canonicalPath: "/terms.html",
      contentHtml: `
        <p>Pochify provides informational content about software products, tools, and offers. Content is provided for general informational purposes only and should not be considered professional, financial, legal, or technical advice.</p>
        <p>Pochify may include affiliate links. Clicking those links may result in commissions being earned by Pochify.</p>
        <p>Pochify does not guarantee that products, pricing, trials, discounts, or offers will remain available or unchanged.</p>
        <p>Use of the site is at your own risk. Pochify is not responsible for third-party services, websites, products, or outcomes resulting from their use.</p>
      `
    }),
    "utf8"
  );

  return [faqPath, privacyPath, termsPath];
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

  const totalPages = Math.max(1, Math.ceil(deals.length / DEALS_PER_PAGE));
  const dealListUrls = [];
  for (let page = 1; page <= totalPages; page += 1) {
    dealListUrls.push(page === 1 ? `${SITE_URL}/deals/` : `${SITE_URL}/deals/page/${page}/`);
  }

  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/faq.html`,
    `${SITE_URL}/privacy.html`,
    `${SITE_URL}/terms.html`,
    ...dealListUrls,
    ...categoryUrls,
    ...deals.map((d) => `${SITE_URL}/deals/${d.slug}.html`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(path.join("docs", "sitemap.xml"), xml, "utf8");
}
