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
  if (href.includes("/collections/")) return false;
  if (href.includes("/pages/")) return false;
  if (href.includes("/account")) return false;
  if (href.includes("/cart")) return false;
  if (href.includes("/policies/")) return false;
  return href.includes("/products/");
}

function extractCardTitle(anchor, wrapper) {
  return (
    cleanText(anchor.find("h1,h2,h3,h4,h5").first().text()) ||
    cleanText(wrapper.find("h1,h2,h3,h4,h5").first().text()) ||
    cleanText(anchor.attr("title") || "") ||
    cleanText(anchor.text())
  );
}

function extractCardImage(anchor, wrapper) {
  const src =
    anchor.find("img").first().attr("src") ||
    anchor.find("img").first().attr("data-src") ||
    anchor.find("img").first().attr("srcset") ||
    wrapper.find("img").first().attr("src") ||
    wrapper.find("img").first().attr("data-src") ||
    wrapper.find("img").first().attr("srcset") ||
    "";

  return String(src).split(" ")[0];
}

function extractCardPrices(text = "") {
  const saleMatch = text.match(/sale price\s*\$([0-9]+(?:\.[0-9]{1,2})?)/i);
  const regularMatch = text.match(/regular price\s*\$([0-9]+(?:\.[0-9]{1,2})?)/i);
  const offMatch = text.match(/-?(\d{1,3})%\s*off/i);

  const currentPrice = saleMatch ? parseMoneyString(saleMatch[1]) : null;
  const originalPrice = regularMatch ? parseMoneyString(regularMatch[1]) : null;

  let discountPercent = offMatch?.[1] ? Number(offMatch[1]) : null;
  if (!discountPercent) {
    discountPercent = computeDiscountPercent(currentPrice, originalPrice);
  }

  return {
    currentPrice,
    originalPrice,
    discountPercent
  };
}

function parseCategoryCandidates($, pageUrl) {
  const rawEntries = [];

  $('a[href*="/products/"]').each((_, el) => {
    const anchor = $(el);
    const href = absoluteUrl(pageUrl, anchor.attr("href") || "");

    if (!isProductHref(href)) return;

    const wrapper = anchor.closest("li, article, .card, .product, div");
    const title = extractCardTitle(anchor, wrapper);
    const text = cleanText(wrapper.text());
    const cardImage = extractCardImage(anchor, wrapper);
    const { currentPrice, originalPrice, discountPercent } = extractCardPrices(text);

    rawEntries.push({
      href,
      title,
      cardImage,
      text,
      currentPrice,
      originalPrice,
      discountPercent
    });
  });

  console.log(`🔵 [Dealify] Product href anchors found: ${rawEntries.length}`);
  rawEntries.slice(0, 30).forEach((item, index) => {
    console.log(`🔵 [Dealify] Product anchor ${index + 1}:`, {
      href: item.href,
      title: item.title,
      image: item.cardImage,
      currentPrice: item.currentPrice,
      originalPrice: item.originalPrice,
      discountPercent: item.discountPercent,
      text: item.text.slice(0, 260)
    });
  });

  const mergedByHref = new Map();

  for (const entry of rawEntries) {
    const existing = mergedByHref.get(entry.href) || {
      href: entry.href,
      title: "",
      cardImage: "",
      textParts: [],
      currentPrice: null,
      originalPrice: null,
      discountPercent: null
    };

    if (!existing.title && entry.title) existing.title = entry.title;
    if (!existing.cardImage && entry.cardImage) existing.cardImage = entry.cardImage;
    if (entry.text) existing.textParts.push(entry.text);
    if (!existing.currentPrice && entry.currentPrice) existing.currentPrice = entry.currentPrice;
    if (!existing.originalPrice && entry.originalPrice) existing.originalPrice = entry.originalPrice;
    if (!existing.discountPercent && entry.discountPercent) existing.discountPercent = entry.discountPercent;

    mergedByHref.set(entry.href, existing);
  }

  const merged = [...mergedByHref.values()].map((item) => {
    const mergedText = cleanText(item.textParts.join(" "));
    const prices = extractCardPrices(mergedText);

    return {
      href: item.href,
      title: item.title,
      cardImage: item.cardImage,
      heroImage: item.cardImage,
      text: mergedText,
      currentPrice: item.currentPrice || prices.currentPrice,
      originalPrice: item.originalPrice || prices.originalPrice,
      discountPercent: item.discountPercent || prices.discountPercent
    };
  });

  console.log(`🔵 [Dealify] Product entries after href merge: ${merged.length}`);
  merged.slice(0, 20).forEach((item, index) => {
    console.log(`🔵 [Dealify] Merged entry ${index + 1}:`, {
      href: item.href,
      title: item.title,
      image: item.cardImage,
      currentPrice: item.currentPrice,
      originalPrice: item.originalPrice,
      discountPercent: item.discountPercent,
      text: item.text.slice(0, 260)
    });
  });

  const candidates = merged
    .filter((item) => item.href && item.title && item.title.length >= 3)
    .filter((item) => item.cardImage)
    .filter((item) => item.currentPrice && item.originalPrice && item.discountPercent)
    .map((item) => {
      const description = cleanText(
        item.text
          .replace(item.title, "")
          .replace(/\$[0-9.,]+/g, " ")
          .replace(/\bSale price\b/gi, " ")
          .replace(/\bRegular price\b/gi, " ")
          .replace(/\bChoose options\b/gi, " ")
          .replace(/\bQuick view\b/gi, " ")
          .replace(/\bAdd to cart\b/gi, " ")
      ).slice(0, 220);

      const offerType =
        item.text.toLowerCase().includes("lifetime") || item.text.toLowerCase().includes("ltd")
          ? "lifetime"
          : "discount";

      return {
        href: item.href,
        title: item.title,
        description,
        currentPrice: item.currentPrice,
        originalPrice: item.originalPrice,
        discountPercent: item.discountPercent,
        cardImage: item.cardImage,
        heroImage: item.heroImage || item.cardImage,
        offerType,
        slug: slugify(item.title)
      };
    });

  return dedupeBySlug(candidates);
}

function extractDetailTitle($, fallback = "") {
  return (
    cleanText($("main h1").first().text()) ||
    cleanText($("h1").first().text()) ||
    fallback
  );
}

function extractDetailDescription($, fallback = "") {
  return (
    cleanText($('meta[name="description"]').attr("content") || "") ||
    cleanText($("main p").first().text()) ||
    fallback
  );
}

function extractDetailHeroImage($, fallback = "") {
  const candidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $("main img").first().attr("src"),
    $("main img").first().attr("data-src"),
    $(".product img").first().attr("src"),
    $(".product img").first().attr("data-src"),
    fallback
  ];

  const finalImage = candidates.find((item) => item && String(item).trim()) || "";

  console.log("🔵 [Dealify] Detail image debug:", {
    candidates,
    finalImage
  });

  return String(finalImage).split(" ")[0];
}

function extractDetailPricing($, fallbackCurrent = null, fallbackOriginal = null) {
  const bodyText = cleanText($("body").text());

  const prices = extractCardPrices(bodyText);

  return {
    currentPrice: prices.currentPrice || fallbackCurrent,
    originalPrice: prices.originalPrice || fallbackOriginal
  };
}

async function enrichFromDetail(candidate, sourceMeta, options = {}) {
  console.log(`🔵 [Dealify] Processing detail page: ${candidate.href}`);

  const html = await fetchHtml(candidate.href);
  const $ = cheerio.load(html);

  const title = extractDetailTitle($, candidate.title);
  const description = extractDetailDescription($, candidate.description || "");
  const heroImage = extractDetailHeroImage($, candidate.heroImage || candidate.cardImage || "");
  const cardImage = candidate.cardImage || heroImage;

  const { currentPrice, originalPrice } = extractDetailPricing(
    $,
    candidate.currentPrice,
    candidate.originalPrice
  );

  const discountPercent = computeDiscountPercent(currentPrice, originalPrice) || candidate.discountPercent;
  const bodyText = cleanText($("body").text());
  const offerType =
    bodyText.toLowerCase().includes("lifetime") || bodyText.toLowerCase().includes("ltd")
      ? "lifetime"
      : candidate.offerType || "discount";

  const built = {
    name: title,
    slug: slugify(title),
    brand_key: slugify(title),
    description,
    url: candidate.href,
    vendor_url: candidate.href,
    affiliateLink: candidate.href,
    source: "dealify",
    source_key: sourceMeta.key,
    source_name: sourceMeta.name,
    source_logo_path: sourceMeta.logo_path,
    source_home_url: sourceMeta.home_url,
    source_deal_url: candidate.href,
    merchant: sourceMeta.name,
    merchant_url: candidate.href,
    og_image: heroImage,
    card_image: cardImage,
    channel: detectChannel(`${title} ${description}`),
    score: scoreDeal({
      name: title,
      description,
      discountPercent,
      reviewCount: 0,
      sourceUrl: candidate.href,
      lifetimeScoreBonus: Number(options.lifetimeScoreBonus || 0),
      enableScoringDebug: !!options.enableScoringDebug
    }),
    votes_count: 0,
    review_count: 0,
    discount_percent: discountPercent,
    current_price: currentPrice,
    original_price: originalPrice,
    offer_type: offerType,
    meta_title: `${title} Deal Review | Pochify`,
    meta_description: description.slice(0, 155)
  };

  console.log("🔵 [Dealify] Candidate:", {
    title: built.name,
    href: built.url,
    card_image: built.card_image,
    hero_image: built.og_image,
    current: built.current_price,
    original: built.original_price,
    discount: built.discount_percent
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
        console.error(`❌ [Dealify] Detail parse failed for index ${currentIndex}:`, error.message);
        results[currentIndex] = null;
      }
      await sleep(100);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);

  return results.filter(Boolean);
}

export async function fetchDealifyDeals(pages = [], options = {}) {
  const sourceMeta = getSourceMeta("dealify");
  const categoryCandidates = [];

  for (const page of pages) {
    console.log(`🔵 [Dealify] Processing page: ${page.url}`);

    const html = await fetchHtml(page.url);
    const $ = cheerio.load(html);

    const candidates = parseCategoryCandidates($, page.url);
    categoryCandidates.push(...candidates);
  }

  const dedupedCategory = dedupeBySlug(
    categoryCandidates.map((item) => ({
      slug: item.slug,
      ...item
    }))
  );

  console.log(`🔵 [Dealify] Category candidates after dedupe: ${dedupedCategory.length}`);

  const detailed = await mapLimit(dedupedCategory, 4, async (candidate) =>
    enrichFromDetail(candidate, sourceMeta, options)
  );

  const finalDeals = dedupeBySlug(detailed);
  console.log(`🔵 [Dealify] Final deduped deals: ${finalDeals.length}`);
  return finalDeals;
}
