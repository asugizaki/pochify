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
  return href.startsWith("/products/") || href.startsWith("https://appsumo.com/products/");
}

export async function fetchAppsumoDeals(pages = [], options = {}) {
  const sourceMeta = getSourceMeta("appsumo");
  const deals = [];

  for (const page of pages) {
    console.log(`🟣 [AppSumo] Processing page: ${page.url}`);

    const html = await fetchHtml(page.url);
    const $ = cheerio.load(html);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (!isLikelyProductHref(href)) return;

      const title = cleanText($(el).text());
      if (!title || title.length < 3) return;

      const nextImg = $(el).nextAll("img").first();
      const imageUrl =
        nextImg.attr("src") ||
        nextImg.attr("data-src") ||
        nextImg.attr("srcset") ||
        "";

      const nextText = cleanText($(el).parent().text());

      const descMatch = nextText.replace(title, "").trim();
      const description = descMatch.slice(0, 220);

      const reviewAnchor = $(el).parent().find('a[href]').filter((_, a) => {
        return /reviews?/i.test(cleanText($(a).text()));
      }).first();

      const reviewText = cleanText(reviewAnchor.text());
      const reviewMatch = reviewText.match(/(\d+)\s+reviews?/i);
      const reviewCount = reviewMatch ? Number(reviewMatch[1]) : 0;

      const prices = [...nextText.matchAll(/\$([0-9]+(?:\.[0-9]{1,2})?)/g)].map((m) =>
        parseMoneyString(m[1])
      );

      const currentPrice = prices[0] ?? null;
      const originalPrice = prices[1] ?? null;
      const discountPercent = computeDiscountPercent(currentPrice, originalPrice);
      const offerType = nextText.toLowerCase().includes("lifetime") ? "lifetime" : "discount";

      const pageUrl = absoluteUrl(page.url, href);

      const built = {
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
        og_image: imageUrl || "",
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
        offer_type: offerType,
        meta_title: `${title} Deal Review | Pochify`,
        meta_description: description.slice(0, 155)
      };

      console.log("🟣 [AppSumo] Candidate:", {
        title: built.name,
        href: built.url,
        image: built.og_image,
        current: built.current_price,
        original: built.original_price,
        discount: built.discount_percent,
        reviews: built.review_count
      });

      deals.push(built);
    });
  }

  const deduped = dedupeBySlug(deals);
  console.log(`🟣 [AppSumo] Final deduped deals: ${deduped.length}`);
  return deduped;
}
