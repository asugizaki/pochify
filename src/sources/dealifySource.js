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

export async function fetchDealifyDeals(pages = [], options = {}) {
  const sourceMeta = getSourceMeta("dealify");
  const deals = [];

  for (const page of pages) {
    const html = await fetchHtml(page.url);
    const $ = cheerio.load(html);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const title = cleanText($(el).find("h3, h2, h4").first().text() || "");
      const text = cleanText($(el).parent().text() || $(el).text());

      if (!href || !title) return;

      const saleMatch = text.match(/Sale price\s*\$([0-9]+(?:\.[0-9]{1,2})?)/i);
      const regularMatch = text.match(/Regular price\s*\$([0-9]+(?:\.[0-9]{1,2})?)/i);
      const offMatch = text.match(/-?(\d{1,3})%\s*off/i);

      if (!saleMatch || !regularMatch) return;

      const currentPrice = parseMoneyString(saleMatch[1]);
      const originalPrice = parseMoneyString(regularMatch[1]);
      const discountPercent =
        offMatch?.[1] ? Number(offMatch[1]) : computeDiscountPercent(currentPrice, originalPrice);

      const description =
        cleanText($(el).parent().find("p").first().text()) ||
        text.replace(title, "").slice(0, 220);

      const pageUrl = absoluteUrl(page.url, href);

      deals.push({
        name: title,
        slug: slugify(title),
        brand_key: slugify(title),
        description,
        url: pageUrl,
        vendor_url: pageUrl,
        affiliateLink: pageUrl,
        source: "dealify",
        source_key: sourceMeta.key,
        source_name: sourceMeta.name,
        source_logo_path: sourceMeta.logo_path,
        source_home_url: sourceMeta.home_url,
        source_deal_url: pageUrl,
        merchant: sourceMeta.name,
        merchant_url: pageUrl,
        og_image: "",
        channel: detectChannel(`${title} ${description}`),
        score: scoreDeal({
          name: title,
          description,
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
        meta_description: description.slice(0, 155)
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
