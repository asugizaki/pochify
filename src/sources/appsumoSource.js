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
  absoluteUrl,
  sleep
} from "./shared.js";

function dedupeBySlug(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.slug) continue;
    if (!map.has(item.slug)) map.set(item.slug, item);
  }
  return [...map.values()];
}

function isProductHref(href = "") {
  if (!href) return false;
  if (href.includes("#")) return false;
  return href.startsWith("/products/") || href.startsWith("https://appsumo.com/products/");
}

function findCategoryImage(anchor, wrapper) {
  const img =
    anchor.parent().find("img").first().attr("src") ||
    anchor.parent().find("img").first().attr("data-src") ||
    anchor.parent().find("img").first().attr("srcset") ||
    wrapper.find("img").first().attr("src") ||
    wrapper.find("img").first().attr("data-src") ||
    "";

  if (!img) return "";
  return String(img).split(" ")[0];
}

function parseCategoryCandidates($, pageUrl) {
  const candidates = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!isProductHref(href)) return;

    const anchor = $(el);
    const fullUrl = absoluteUrl(pageUrl, href);
    const title = cleanText(anchor.text());

    if (!title || title.length < 2) return;

    const wrapper = anchor.parent();
    const textBlock = cleanText(wrapper.text());

    const reviewAnchor = wrapper.find('a[href*="#reviews"]').first();
    const reviewText = cleanText(reviewAnchor.text());
    const reviewMatch = reviewText.match(/(\d+)\s+reviews?/i);
    const reviewCount = reviewMatch ? Number(reviewMatch[1]) : 0;

    const prices = [...textBlock.matchAll(/\$([0-9]+(?:\.[0-9]{1,2})?)/g)].map((m) =>
      parseMoneyString(m[1])
    );

    const currentPrice = prices[0] ?? null;
    const originalPrice = prices[1] ?? null;
    const discountPercent = computeDiscountPercent(currentPrice, originalPrice);

    const description = cleanText(
      textBlock
        .replace(title, "")
        .replace(reviewText, "")
        .replace(/\$[0-9.,/a-zA-Z]+/g, " ")
    ).slice(0, 220);

    const imageUrl = findCategoryImage(anchor, wrapper);
    const offerType = textBlock.toLowerCase().includes("lifetime") ? "lifetime" : "discount";

    candidates.push({
      href: fullUrl,
      title,
      description,
      reviewCount,
      currentPrice,
      originalPrice,
      discountPercent,
      imageUrl,
      offerType
    });
  });

  return dedupeBySlug(
    candidates.map((item) => ({
      slug: slugify(item.title),
      ...item
    }))
  );
}

function extractHeroImageFromDetail($, productName = "") {
  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    "";
  if (ogImage) return ogImage;

  const allImgs = [];
  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("srcset") ||
      "";
    const alt = cleanText($(el).attr("alt") || "");

    if (!src) return;
    if (/thumbnail/i.test(alt)) return;
    if (/thumbnail/i.test(src)) return;

    allImgs.push({ src: String(src).split(" ")[0], alt });
  });

  const productNamed = allImgs.find((img) =>
    productName ? img.alt.toLowerCase().includes(productName.toLowerCase()) : false
  );
  if (productNamed) return productNamed.src;

  const appsumoCdn = allImgs.find((img) => /appsumo/i.test(img.src));
  if (appsumoCdn) return appsumoCdn.src;

  return "";
}

async function enrichFromDetail(candidate, sourceMeta, options = {}) {
  console.log(`🟣 [AppSumo] Processing detail page: ${candidate.href}`);

  const html = await fetchHtml(candidate.href);
  const $ = cheerio.load(html);

  const h1 = cleanText($("h1").first().text());
  const title = h1 || candidate.title;

  const description =
    cleanText($('meta[name="description"]').attr("content") || "") ||
    cleanText($("h1").first().nextAll("p").first().text()) ||
    candidate.description ||
    "";

  const reviewText =
    cleanText($('a[href*="#reviews"]').first().text()) ||
    cleanText($("body").text()).match(/\b\d+\s+reviews?\b/i)?.[0] ||
    "";
  const reviewMatch = reviewText.match(/(\d+)\s+reviews?/i);
  const reviewCount = reviewMatch ? Number(reviewMatch[1]) : candidate.reviewCount || 0;

  let currentPrice = candidate.currentPrice;
  let originalPrice = candidate.originalPrice;

  const bodyText = cleanText($("body").text());
  const inlinePrices = [...bodyText.matchAll(/\$([0-9]+(?:\.[0-9]{1,2})?)/g)].map((m) =>
    parseMoneyString(m[1])
  );

  if (!currentPrice && inlinePrices.length > 0) currentPrice = inlinePrices[0];
  if (!originalPrice && inlinePrices.length > 1) originalPrice = inlinePrices[1];

  const discountPercent = computeDiscountPercent(currentPrice, originalPrice);
  const heroImage = extractHeroImageFromDetail($, title) || candidate.imageUrl || "";
  const offerType = bodyText.toLowerCase().includes("lifetime") ? "lifetime" : candidate.offerType || "discount";

  const built = {
    name: title,
    slug: slugify(title),
    brand_key: slugify(title),
    description,
    url: candidate.href,
    vendor_url: candidate.href,
    affiliateLink: candidate.href,
    source: "appsumo",
    source_key: sourceMeta.key,
    source_name: sourceMeta.name,
    source_logo_path: sourceMeta.logo_path,
    source_home_url: sourceMeta.home_url,
    source_deal_url: candidate.href,
    merchant: sourceMeta.name,
    merchant_url: candidate.href,
    og_image: heroImage,
    channel: detectChannel(`${title} ${description}`),
    score: scoreDeal({
      name: title,
      description,
      discountPercent,
      reviewCount,
      sourceUrl: candidate.href,
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

  return built;
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch (error) {
        console.error(`❌ [AppSumo] Detail parse failed for index ${currentIndex}:`, error.message);
        results[currentIndex] = null;
      }
      await sleep(100);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);

  return results.filter(Boolean);
}

export async function fetchAppsumoDeals(pages = [], options = {}) {
  const sourceMeta = getSourceMeta("appsumo");
  const categoryCandidates = [];

  for (const page of pages) {
    console.log(`🟣 [AppSumo] Processing page: ${page.url}`);

    const html = await fetchHtml(page.url);
    const $ = cheerio.load(html);

    const candidates = parseCategoryCandidates($, page.url);

    for (const candidate of candidates) {
      console.log("🟣 [AppSumo] Category candidate:", {
        title: candidate.title,
        href: candidate.href,
        image: candidate.imageUrl,
        current: candidate.currentPrice,
        original: candidate.originalPrice,
        discount: candidate.discountPercent,
        reviews: candidate.reviewCount
      });
    }

    categoryCandidates.push(...candidates);
  }

  const dedupedCategory = dedupeBySlug(
    categoryCandidates.map((item) => ({
      slug: item.slug,
      ...item
    }))
  );

  console.log(`🟣 [AppSumo] Category candidates after dedupe: ${dedupedCategory.length}`);

  const detailed = await mapLimit(dedupedCategory, 4, async (candidate) =>
    enrichFromDetail(candidate, sourceMeta, options)
  );

  const finalDeals = dedupeBySlug(detailed);
  console.log(`🟣 [AppSumo] Final deduped deals: ${finalDeals.length}`);
  return finalDeals;
}
