import * as cheerio from "cheerio";
import { getSourceMeta } from "../sourceRegistry.js";
import {
  fetchHtml,
  cleanText,
  slugify,
  detectChannel,
  parseMoneyString,
  computeDiscountPercent,
  scoreDeal
} from "./shared.js";

export async function fetchAppsumoDeals(pages = [], options = {}) {
  const sourceMeta = getSourceMeta("appsumo");
  const deals = [];

  for (const page of pages) {
    const html = await fetchHtml(page.url);
    const $ = cheerio.load(html);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const title = cleanText($(el).find("h3, h2, h4").first().text() || $(el).text());

      if (!href || !title) return;
      if (!href.startsWith("/products/") && !href.startsWith("/")) return;

      const containerText = cleanText($(el).parent().text() || $(el).text());
      const reviewsMatch = containerText.match(/(\d+)\s+reviews?/i);
      const prices = [...containerText.matchAll(/\$([0-9]+(?:\.[0-9]{2})?)/g)].map((m) =>
        parseMoneyString(m[1])
      );

      const currentPrice = prices[0] ?? null;
      const originalPrice = prices[1] ?? null;
      const discountPercent = computeDiscountPercent(currentPrice, originalPrice);
      const reviewCount = reviewsMatch ? Number(reviewsMatch[1]) : 0;

      const description =
        cleanText($(el).parent().find("p").first().text()) ||
        cleanText($(el).parent().text()).replace(title, "").slice(0, 220);

      const pageUrl = href.startsWith("http") ? href : `https://appsumo.com${href}`;

      deals.push({
        name: title,
        slug: slugify(title),
        brand_key: slugify(title),
        description,
        url: pageUrl,
        vendor_url: pageUrl,
        affiliateLink: pageUrl,
        source: "appsumo",
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
          reviewCount,
          sourceUrl: pageUrl,
          lifetimeScoreBonus: Number(options.lifetimeScoreBonus || 0),
          enableScoringDebug: !!options.enableScoringDebug
        }),
        votes_count: reviewCount,
        review_count: reviewCount,
        discount_percent: discountPercent,
        current_price: currentPrice,
        original_price: originalPrice,
        offer_type: containerText.toLowerCase().includes("lifetime") ? "lifetime" : "discount",
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
