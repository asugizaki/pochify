import fs from "fs";
import path from "path";
import {
  escapeHtml,
  layout,
  footerHtml,
  shareButtonsHtml,
  structuredArticleData,
  dealCardHtml
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
    description: "Discover
