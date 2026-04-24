import fs from "fs";
import path from "path";

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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

export function ensureSharedAssets() {
  const cssPath = path.join("docs", "assets", "site.css");
  ensureDir(path.dirname(cssPath));

  const css = `
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
  --badge-bg: #166534;
  --badge-text: #f0fdf4;
  --sale-bg: #dc2626;
  --sale-text: #fff1f2;
  --hero-grad-1: #111827;
  --hero-grad-2: #0f172a;
  --hero-grad-3: #1e293b;
}

* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; }

.site-header {
  position: sticky;
  top: 0;
  z-index: 30;
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

.brand { color: var(--text); text-decoration: none; font-weight: bold; font-size: 22px; display:inline-flex; align-items:center; }
.brand img { height: 50px; width: auto; display: block; }

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

.nav-links { display: flex; flex-wrap: wrap; gap: 14px; }
.nav-links a { color: var(--muted); text-decoration: none; font-size: 15px; }
.nav-links a:hover, .brand:hover { color: var(--text); }

.container { max-width: 1180px; margin: 0 auto; padding: 28px 20px 80px; }
.narrow { max-width: 980px; }

h1 { font-size: 42px; line-height: 1.15; margin: 0 0 14px; }
h2, h3 { margin-top: 0; margin-bottom: 12px; }

.eyebrow {
  color: var(--accent);
  font-weight: bold;
  letter-spacing: 0.08em;
  font-size: 12px;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.sub { color: var(--muted); font-size: 19px; margin-bottom: 24px; }
.breadcrumbs { margin-bottom: 18px; color: var(--muted); font-size: 14px; }
.breadcrumbs a { color: var(--link); text-decoration: none; }

.card {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 24px;
  margin: 20px 0;
}

.hero-image {
  display: block;
  width: 100%;
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

.price-current { font-size: 34px; font-weight: bold; color: var(--price); }
.price-old { font-size: 18px; color: var(--old-price); text-decoration: line-through; }

.badge {
  display: inline-block;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  background: var(--badge-bg);
  color: var(--badge-text);
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
}

.badge-sale {
  background: var(--sale-bg);
  color: var(--sale-text);
}

.cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }

.cta {
  display: inline-block;
  background: var(--accent);
  color: var(--accent-dark);
  text-decoration: none;
  padding: 14px 22px;
  border-radius: 12px;
  font-weight: bold;
}

.secondary, button.secondary {
  display: inline-block;
  color: var(--text);
  background: transparent;
  text-decoration: none;
  padding: 14px 22px;
  border-radius: 12px;
  border: 1px solid #334155;
  font: inherit;
  cursor: pointer;
}

.grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.hero-panel {
  background:
    radial-gradient(circle at top left, rgba(34,197,94,0.18), transparent 30%),
    linear-gradient(135deg, var(--hero-grad-1), var(--hero-grad-2), var(--hero-grad-3));
  border: 1px solid #243041;
  border-radius: 22px;
  padding: 30px;
  margin-bottom: 22px;
  position: relative;
  overflow: hidden;
}

.hero-panel::after {
  content: "";
  position: absolute;
  inset: auto -40px -40px auto;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  background: rgba(34,197,94,0.08);
  filter: blur(10px);
}

.hero-title {
  font-size: 48px;
  line-height: 1.04;
  margin: 0 0 14px;
  max-width: 10ch;
  position: relative;
  z-index: 1;
}

.hero-copy {
  color: #cbd5e1;
  font-size: 18px;
  max-width: 52ch;
  margin-bottom: 22px;
  position: relative;
  z-index: 1;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 28px 0 8px;
}

.section-header p {
  margin: 0;
  color: var(--muted);
}

.deal-card-link,
.deal-card-link:visited,
.deal-card-link:hover,
.deal-card-link:active {
  display: block;
  text-decoration: none;
  color: var(--text);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.deal-card-link * {
  color: inherit;
}

.deal-card-link:hover {
  transform: translateY(-4px);
}

.deal-card {
  position: relative;
  height: 100%;
  min-height: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 8px;
}

.deal-card-link:hover .deal-card {
  border-color: #31465f;
  box-shadow: 0 10px 30px rgba(0,0,0,0.22);
}

.deal-card img {
  width: 100%;
  border-radius: 12px;
  margin-bottom: 6px;
  border: 1px solid #243041;
  background: #0f172a;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.deal-card h3 {
  font-size: 18px;
  line-height: 1.3;
  margin: 0;
  color: var(--text);
}

.deal-card-description {
  color: var(--muted) !important;
  font-size: 14px;
  line-height: 1.45;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-price-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0;
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

.floating-share {
  position: fixed;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 25;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.floating-share a,
.floating-share button {
  width: 42px;
  height: 42px;
  border: 1px solid #334155;
  background: #111827;
  color: #fff;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-decoration: none;
  padding: 0;
}

.floating-share svg,
.mobile-share svg {
  width: 18px;
  height: 18px;
}

.mobile-share {
  display: none;
}

.footer {
  margin-top: 48px;
  color: #64748b;
  font-size: 14px;
}

.footer a { color: var(--link); text-decoration: none; }
.footer-links { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
.empty { color: var(--muted); padding: 10px 0; }

@media (max-width: 1024px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .menu-toggle { display: inline-block; }
  .nav-links { display: none; width: 100%; flex-direction: column; padding-top: 10px; }
  .nav-links.open { display: flex; }
  .nav-wrap { flex-wrap: wrap; }
  h1 { font-size: 34px; }
  .price-current { font-size: 28px; }
  .hero-panel { padding: 24px; }
  .hero-title { font-size: 34px; max-width: none; }
  .grid { grid-template-columns: 1fr; }

  .floating-share {
    display: none;
  }

  .mobile-share {
    position: fixed;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
    z-index: 35;
    display: flex;
    gap: 10px;
    background: rgba(17,24,39,0.96);
    border: 1px solid #334155;
    border-radius: 999px;
    padding: 8px 10px;
    backdrop-filter: blur(8px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.28);
  }

  .mobile-share a,
  .mobile-share button {
    width: 40px;
    height: 40px;
    border: 1px solid #334155;
    background: #0f172a;
    color: #fff;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    text-decoration: none;
    padding: 0;
  }
}
  `.trim();

  fs.writeFileSync(cssPath, css, "utf8");
}

export function sharedScripts() {
  return `
    <script>
      async function copyText(text, label) {
        try {
          await navigator.clipboard.writeText(text);
          alert(label || "Link copied");
        } catch {
          alert("Could not copy link");
        }
      }
    </script>
    <script src="/assets/layout.js"></script>
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
  <link rel="stylesheet" href="/assets/site.css" />
  ${googleAnalyticsTag()}
  ${extraHead}
</head>
<body>
  ${includeNav ? `<div id="site-header"></div>` : ""}
  ${bodyContent}
  <div id="site-footer"></div>
  ${includeFooterScripts ? sharedScripts() : ""}
</body>
</html>`;
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

function iconLink() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.59 13.41a1 1 0 0 0 1.41 1.41l5-5a3 3 0 0 0-4.24-4.24l-1.88 1.88a1 1 0 1 0 1.41 1.41l1.88-1.88a1 1 0 1 1 1.41 1.41l-5 5z"/><path fill="currentColor" d="M13.41 10.59a1 1 0 0 0-1.41-1.41l-5 5a3 3 0 0 0 4.24 4.24l1.88-1.88a1 1 0 1 0-1.41-1.41l-1.88 1.88a1 1 0 1 1-1.41-1.41l5-5z"/></svg>`;
}

export function shareButtonsHtml({ pageUrl, title, summary }) {
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(`${title} — ${summary}`);

  return `
    <div class="floating-share" aria-label="Share">
      <a href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" rel="noopener" title="Share on X">${iconX()}</a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener" title="Share on LinkedIn">${iconLinkedIn()}</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener" title="Share on Facebook">${iconFacebook()}</a>
      <button onclick="copyText('${pageUrl}', 'Link copied')" title="Copy link">${iconLink()}</button>
    </div>

    <div class="mobile-share" aria-label="Share">
      <a href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" rel="noopener" title="Share on X">${iconX()}</a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener" title="Share on LinkedIn">${iconLinkedIn()}</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener" title="Share on Facebook">${iconFacebook()}</a>
      <button onclick="copyText('${pageUrl}', 'Link copied')" title="Copy link">${iconLink()}</button>
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
