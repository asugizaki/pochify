import fs from "fs";
import path from "path";
import {
  escapeHtml,
  layout,
  footerHtml,
  shareButtonsHtml,
  floatingShareButtonsHtml,
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
  return `<img class="hero-image" src="${escapeHtml(deal.og_image)}" alt="${escapeHtml(deal.name)}" loading="lazy" />
