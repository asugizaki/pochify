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

function dedupeBySlug(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.slug) continue;
    if (!map.has(item.slug)) map.set(item.slug, item);
  }
  return [...map.values()];
}

function isLikelyProductHref(href = "") {
  if (!href) return false;
  if (href.includes("/collections/")) return false;
  if (href.includes("/pages/")) return false;
  if (href.includes("/account")) return false;
  if (href.includes("/cart")) return false;
  if (href.includes("/policies/")) return false;
  return href.includes("/products/");
}

export async function fetchDealifyDeals(pages = [], options = {}) {
  const sourceMeta = getSourceMeta("dealify");
  const deals = [];

  for (const page of pages) {
    console.log(`🔵 [Dealify] Processing page: ${page.url}`);

    const html = await fetchHtml(page.url);
    const $ = cheerio.load(html);

    $("a[href]").each((_, el) => {
      const href = absoluteUrl(page.url, $(el).attr("href") || "");
      if (!isLikelyProductHref(href)) return;

      const wrapper = $(el).closest("li, article, div");
      const title =
        cleanText($(el).find("h2,h3,h4").first().text()) ||
        cleanText(wrapper.find("h2,h3,h4").first().text()) ||
        cleanText($(el).text());

      if (!title || title.length < 3) return;

      const imageUrl =
        $(el).find("img").first().attr("src") ||
        $(el).find("img").first().attr("data-src") ||
        wrapper.find("img").first().attr("src") ||
        wrapper.find("img").first().attr("data-src") ||
        "";

      const text = cleanText(wrapper.text());

      const saleMatch = text.match(/sale price\s*\$([0-9]+(?:\.[0-9]{1,2})?)/i);
      const regularMatch = text.match(/regular price\s*\$([0-9]+(?:\.[0-9]{1,2})?)/i);

      if (!saleMatch || !regularMatch) return;

      const currentPrice = parseMoneyString(saleMatch[1]);
      const originalPrice = parseMoneyString(regularMatch[1]);
      const discountPercent = computeDiscountPercent(currentPrice, originalPrice);

      const description =
        cleanText(wrapper.find("p").first().text()) ||
        cleanText(text.replace(title, "")).slice(0, 220);

      const built = {
        name: title,
        slug: slugify(title),
        brand_key: slugify(title),
        description,
        url: href,
        vendor_url: href,
        affiliateLink: href,
        source: "dealify",
        source_key: sourceMeta.key,
        source_name: sourceMeta.name,
        source_logo_path: sourceMeta.logo_path,
        source_home_url: sourceMeta.home_url,
        source_deal_url: href,
        merchant: sourceMeta.name,
        merchant_url: href,
        og_image: imageUrl || "",
        channel: detectChannel(`${title} ${description}`),
        score: scoreDeal({
          name: title,
          description,
          discountPercent,
          reviewCount: 0,
          sourceUrl: href,
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
      };

      console.log("🔵 [Dealify] Candidate:", {
        title: built.name,
        href: built.url,
        image: built.og_image,
        current: built.current_price,
        original: built.original_price,
        discount: built.discount_percent
      });

      deals.push(built);
    });
  }

  const deduped = dedupeBySlug(deals);
  console.log(`🔵 [Dealify] Final deduped deals: ${deduped.length}`);
  return deduped;
}
