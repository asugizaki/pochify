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

export function normalizeWhitespace(text = "") {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

export function escapeHtml(text = "") {
  return normalizeWhitespace(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function iconX() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.77 7.74L23.2 22H16.9l-4.94-6.94L5.88 22H2.76l7.24-8.28L.8 2h6.46l4.46 6.3L18.9 2zm-1.1 18h1.74L6.22 3.9H4.36L17.8 20z"/></svg>`;
}

function iconLinkedIn() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.94 8.5H3.56V20h3.38V8.5zM5.25 3A1.97 1.97 0 1 0 5.3 6.94 1.97 1.97 0 0 0 5.25 3zM20.44 12.77c0-3.43-1.83-5.02-4.27-5.02-1.97 0-2.85 1.08-3.34 1.84V8.5H9.45c.04.72 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.68.12-.92.27-.68.88-1.38 1.91-1.38 1.35 0 1.89 1.03 1.89 2.54V20h3.38v-7.23z"/></svg>`;
}

function iconFacebook() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.88 3.77-3.88 1.09 0 2.23.19 2.23.19v2.46h-1.25c-1.23 0-1.61.76-1.61 1.55V12h2.74l-.44 2.89h-2.3v6.99A10 10 0 0 0 22 12z"/></svg>`;
}

function iconInstagram() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2.2A2.8 2.8 0 0 0 4.2 7v10A2.8 2.8 0 0 0 7 19.8h10a2.8 2.8 0 0 0 2.8-2.8V7A2.8 2.8 0 0 0 17 4.2H7zm5 3.3A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2.2A2.3 2.3 0 1 0 14.3 12 2.3 2.3 0 0 0 12 9.7zm4.8-3.5a1.05 1.05 0 1 1-1.05 1.05A1.05 1.05 0 0 1 16.8 6.2z"/></svg>`;
}

function iconLink() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.59 13.41a1 1 0 0 0 1.41 1.41l5-5a3 3 0 0 0-4.24-4.24l-1.88 1.88a1 1 0 1 0 1.41 1.41l1.88-1.88a1 1 0 1 1 1.41 1.41l-5 5z"/><path fill="currentColor" d="M13.41 10.59a1 1 0 0 0-1.41-1.41l-5 5a3 3 0 0 0 4.24 4.24l1.88-1.88a1 1 0 1 0-1.41-1.41l-1.88 1.88a1 1 0 1 1-1.41-1.41l5-5z"/></svg>`;
}

export function googleAnalyticsTag() {
  const measurementId = process.env.GA_MEASUREMENT_ID || "";
  if (!measurementId) return "";

  return `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(measurementId)}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${escapeHtml(measurementId)}');
    </script>
  `;
}

export function sharedStyles() {
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
      --btn-dark: #0f172a;
      --price: #f8fafc;
      --old-price: #94a3b8;
      --badge-bg: #052e16;
      --badge-text: #86efac;
      --sale-bg: #3f0d12;
      --sale-text: #fda4af;
      --hero-grad-1: #111827;
      --hero-grad-2: #0f172a;
      --hero-grad-3: #1d4ed8;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: linear-gradient(180deg, #0b1220 0%, #0a1020 100%);
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
      max-width: 1180px;
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

    .menu-toggle {
      display: none;
      background: transparent;
      border: 1px solid #334155;
      color: var(--text);
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 20px;
      cursor: pointer;
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
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 20px 80px;
    }

    .narrow {
      max-width: 980px;
    }

    h1 {
      font-size: 42px;
      line-height: 1.12;
      margin: 0 0 14px;
    }

    h2, h3 {
      margin-top: 0;
      margin-bottom: 12px;
    }

    .eyebrow {
      color: var(--accent);
      font-weight: bold;
      letter-spacing: 0.08em;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 10px;
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

    .card {
      background: rgba(17, 24, 39, 0.9);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 24px;
      margin: 20px 0;
      box-shadow: 0 12px 40px rgba(0,0,0,0.18);
    }

    .hero-home {
      position: relative;
      overflow: hidden;
      padding: 34px;
      border-radius: 24px;
      border: 1px solid #1f2937;
      background:
        radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 28%),
        radial-gradient(circle at bottom left, rgba(29,78,216,0.20), transparent 32%),
        linear-gradient(135deg, var(--hero-grad-1), var(--hero-grad-2) 58%, var(--hero-grad-3) 130%);
      box-shadow: 0 18px 50px rgba(0,0,0,0.28);
      margin-bottom: 26px;
    }

    .hero-home-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 28px;
      align-items: center;
    }

    .hero-home h1 {
      font-size: 54px;
      margin-bottom: 16px;
    }

    .hero-home p {
      color: #cbd5e1;
      font-size: 18px;
      margin: 0 0 24px;
      max-width: 720px;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .hero-stat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }

    .hero-stat {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px;
      padding: 18px;
    }

    .hero-stat strong {
      display: block;
      font-size: 24px;
      margin-bottom: 6px;
      color: #fff;
    }

    .hero-stat span {
      color: #cbd5e1;
      font-size: 14px;
    }

    .hero-quick-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    .hero-quick-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      padding: 16px;
    }

    .hero-quick-card strong {
      display: block;
      margin-bottom: 6px;
      font-size: 15px;
    }

    .hero-quick-card span {
      display: block;
      color: #cbd5e1;
      font-size: 13px;
      line-height: 1.45;
    }

    .hero-image {
      display: block;
      width: 100%;
      max-width: 100%;
      border-radius: 16px;
      border: 1px solid var(--card-border);
      background: #0f172a;
      margin-bottom: 24px;
      aspect-ratio: 16 / 9;
      object-fit: cover;
    }

    .price-box {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 16px;
      margin: 12px 0 0;
    }

    .price-current {
      font-size: 34px;
      font-weight: bold;
      color: var(--price);
    }

    .price-old {
      font-size: 18px;
      color: var(--old-price);
      text-decoration: line-through;
    }

    .badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: bold;
      background: var(--badge-bg);
      color: var(--badge-text);
    }

    .badge-sale {
      background: var(--sale-bg);
      color: var(--sale-text);
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

    .section-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 16px;
    }

    .section-head p {
      margin: 0;
      color: var(--muted);
    }

    .grid {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }

    .deal-link-card {
      display: block;
      text-decoration: none;
      color: inherit;
      transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
      height: 100%;
    }

    .deal-link-card:hover {
      transform: translateY(-4px);
    }

    .deal-card {
      position: relative;
      height: 100%;
      min-height: 100%;
    }

    .deal-card img {
      width: 100%;
      border-radius: 12px;
      margin-bottom: 14px;
      border: 1px solid #243041;
      background: #0f172a;
      aspect-ratio: 16 / 9;
      object-fit: cover;
    }

    .deal-link-card:hover .deal-card {
      border-color: #2f435f;
      box-shadow: 0 18px 48px rgba(0,0,0,0.28);
    }

    .deal-card h3 {
      margin-bottom: 8px;
      line-height: 1.3;
      font-size: 20px;
    }

    .card-price-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
      margin-bottom: 2px;
    }

    .card-price-current {
      font-weight: bold;
      font-size: 20px;
      color: var(--price);
    }

    .card-price-old {
      color: var(--old-price);
      text-decoration: line-through;
      font-size: 14px;
    }

    .inline-link {
      display: inline-block;
      margin-top: 12px;
      color: var(--accent);
      text-decoration: none;
      font-weight: bold;
    }

    .floating-share {
      position: fixed;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 18;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .floating-share a,
    .floating-share button {
      width: 42px;
      height: 42px;
      border: 1px solid #334155;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.95);
      color: var(--text);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 10px 22px rgba(0,0,0,0.2);
    }

    .floating-share svg {
      width: 18px;
      height: 18px;
    }

    .share-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .share-btn,
    .share-btn-copy {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 10px;
      text-decoration: none;
      border: 1px solid #334155;
      color: var(--text);
      background: var(--btn-dark);
      font-size: 14px;
      cursor: pointer;
    }

    .share-btn svg,
    .share-btn-copy svg {
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
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

    .footer-links {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    .empty {
      color: var(--muted);
      padding: 10px 0;
    }

    @media (max-width: 980px) {
      .hero-home-grid {
        grid-template-columns: 1fr;
      }

      .hero-home h1 {
        font-size: 42px;
      }

      .hero-quick-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .menu-toggle {
        display: inline-block;
      }

      .nav-links {
        display: none;
        width: 100%;
        flex-direction: column;
        padding-top: 10px;
      }

      .nav-links.open {
        display: flex;
      }

      .nav-wrap {
        flex-wrap: wrap;
      }

      h1 {
        font-size: 34px;
      }

      .price-current {
        font-size: 28px;
      }

      .hero-home {
        padding: 22px;
      }

      .hero-home h1 {
        font-size: 34px;
      }

      .hero-quick-grid,
      .hero-stat-grid {
        grid-template-columns: 1fr;
      }

      .floating-share {
        left: 10px;
        bottom: 12px;
        top: auto;
        transform: none;
        flex-direction: row;
        overflow-x: auto;
        max-width: calc(100vw - 20px);
        padding: 6px;
        border-radius: 14px;
        background: rgba(11,18,32,0.7);
        backdrop-filter: blur(8px);
      }
    }
  </style>
  `;
}

export function navHtml() {
  return `
    <header class="site-header">
      <div class="nav-wrap">
        <a class="brand" href="/">Pochify</a>
        <button class="menu-toggle" aria-label="Toggle menu" onclick="toggleMenu()">☰</button>
        <nav class="nav-links" id="siteNav">
          <a href="/deals/">Deals</a>
          <a href="/categories/ai.html">AI</a>
          <a href="/categories/saas.html">SaaS</a>
          <a href="https://t.me/pochify" target="_blank" rel="noopener">Telegram</a>
        </nav>
      </div>
    </header>
  `;
}

export function footerHtml(siteUrl) {
  return `
    <div class="footer">
      <p><a href="${siteUrl}">Pochify</a> curates AI tools, SaaS products, and useful software finds.</p>
      <p class="footer-links">
        <a href="/faq.html">FAQ</a>
        <a href="/privacy.html">Privacy Policy</a>
        <a href="/terms.html">Terms & Conditions</a>
      </p>
    </div>
  `;
}

export function sharedScripts() {
  return `
    <script>
      function toggleMenu() {
        const nav = document.getElementById("siteNav");
        if (nav) nav.classList.toggle("open");
      }

      async function copyText(text, label) {
        try {
          await navigator.clipboard.writeText(text);
          alert(label || "Link copied");
        } catch {
          alert("Could not copy link");
        }
      }
    </script>
  `;
}

export function layout({
  title,
  description,
  canonicalUrl,
  ogImage = "",
  extraHead = "",
  bodyContent = "",
  includeNav = true,
  includeFooterScripts = true
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  ${googleAnalyticsTag()}
  ${sharedStyles()}
  ${extraHead}
</head>
<body>
  ${includeNav ? navHtml() : ""}
  ${bodyContent}
  ${includeFooterScripts ? sharedScripts() : ""}
</body>
</html>`;
}

export function dealCardHtml(deal) {
  return `
    <a class="deal-link-card" href="/deals/${deal.slug}.html">
      <div class="card deal-card">
        ${deal.og_image ? `<img src="${escapeHtml(deal.og_image)}" alt="${escapeHtml(deal.name)}" loading="lazy" />` : ""}
        <h3>${escapeHtml(deal.name)}</h3>
        <div class="card-price-row">
          ${deal.current_price ? `<span class="card-price-current">$${escapeHtml(String(deal.current_price))}</span>` : ""}
          ${deal.original_price ? `<span class="card-price-old">$${escapeHtml(String(deal.original_price))}</span>` : ""}
          ${deal.discount_percent ? `<span class="badge badge-sale">${escapeHtml(String(deal.discount_percent))}% off</span>` : ""}
          ${deal.offer_type === "lifetime" ? `<span class="badge">Lifetime deal</span>` : ""}
        </div>
      </div>
    </a>
  `;
}

export function floatingShareButtonsHtml({ pageUrl, title, summary }) {
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(`${title} — ${summary}`);

  return `
    <div class="floating-share" aria-label="Share">
      <a href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" rel="noopener" aria-label="Share on X">${iconX()}</a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener" aria-label="Share on LinkedIn">${iconLinkedIn()}</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener" aria-label="Share on Facebook">${iconFacebook()}</a>
      <button onclick="copyText('${pageUrl}', 'Link copied for Instagram sharing')" aria-label="Copy for Instagram">${iconInstagram()}</button>
      <button onclick="copyText('${pageUrl}', 'Link copied')" aria-label="Copy link">${iconLink()}</button>
    </div>
  `;
}

export function shareButtonsHtml({ pageUrl, title, summary }) {
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(`${title} — ${summary}`);

  return `
    <div class="card">
      <h2>Share this pick</h2>
      <div class="share-row">
        <a class="share-btn" href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" rel="noopener">${iconX()}<span>X</span></a>
        <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener">${iconLinkedIn()}<span>LinkedIn</span></a>
        <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener">${iconFacebook()}<span>Facebook</span></a>
        <button class="share-btn-copy" onclick="copyText('${pageUrl}', 'Link copied for Instagram sharing')">${iconInstagram()}<span>Instagram</span></button>
        <button class="share-btn-copy" onclick="copyText('${pageUrl}', 'Link copied')">${iconLink()}<span>Copy link</span></button>
      </div>
    </div>
  `;
}

export function structuredArticleData({ title, description, url, image }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    mainEntityOfPage: url,
    url,
    image: image ? [image] : [],
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
