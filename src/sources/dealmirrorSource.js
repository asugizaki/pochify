import * as cheerio from "cheerio";
import { getSourceMeta } from "../sourceRegistry.js";
import {
  fetchHtml,
  cleanText,
  slugify,
  detectChannel,
  parseMoneyString,
  computeDiscountPercent,
  scoreDeal,
  absoluteUrl
} from "./shared.js";

export async function fetchDealmirrorDeals(pages = [], options = {}) {
  const sourceMeta = getSourceMeta("dealmirror");
  const deals = [];

  for (const page of pages) {
    const html = await fetchHtml(page.url);
    const $ = cheerio.load(html);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = cleanText($(el).text());

      if (!href || !text) return;
      if (!/\$\s*[0-9]/.test(text)) return;

      const prices = [...text.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map((m) =>
        parseMoneyString(m[1])
      );

      if (prices.length < 2) return;

      const currentPrice = prices[1];
      const originalPrice = prices[0];
      const discountPercent = computeDiscountPercent(currentPrice, originalPrice);

      const title = text
        .replace(/\$\s*[0-9][^$]*$/g, "")
        .replace(/\b\d+%\s*OFF\b/i, "")
        .replace(/\bEnding In\b/i, "")
        .trim();

      if (!title) return;

      const pageUrl = absoluteUrl(page.url, href);

      deals.push({
        name: title,
        slug: slugify(title),
        brand_key: slugify(title),
        description: title,
        url: pageUrl,
        vendor_url: pageUrl,
        affiliateLink: pageUrl,
        source: "dealmirror",
        source_key: sourceMeta.key,
        source_name: sourceMeta.name,
        source_logo_path: sourceMeta.logo_path,
        source_home_url: sourceMeta.home_url,
        source_deal_url: pageUrl,
        merchant: sourceMeta.name,
        merchant_url: pageUrl,
        og_image: "",
        channel: detectChannel(title),
        score: scoreDeal({
          name: title,
          description: title,
          discountPercent,
          reviewCount: 0,
          sourceUrl: pageUrl,
          lifetimeScoreBonus: Number(options.lifetimeScoreBonus || 0),
          enableScoringDebug: !!options.enableScoringDebug
        }),
        votes_count: 0,
        review_count: 0,
        discount_percent: discountPercent,
        current_price: currentPrice,
        original_price: originalPrice,
        offer_type: text.toLowerCase().includes("lifetime") ? "lifetime" : "discount",
        meta_title: `${title} Deal Review | Pochify`,
        meta_description: title.slice(0, 155)
      });
    });
  }

  return dedupeBySlug(deals);
}

function dedupeBySlug(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.slug) continue;
    if (!map.has(item.slug)) map.set(item.slug, item);
  }
  return [...map.values()];
}
