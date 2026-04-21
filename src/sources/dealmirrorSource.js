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
  return href.includes("/product/");
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

function extractCardTitle(anchor, wrapper) {
  return (
    cleanText(anchor.find("h1,h2,h3,h4,h5").first().text()) ||
    cleanText(wrapper.find("h1,h2,h3,h4,h5").first().text()) ||
    cleanText(anchor.attr("title") || "") ||
    cleanText(anchor.text())
  );
}

function extractCardPrices(text = "") {
  const prices = [...text.matchAll(/\$([0-9]+(?:\.[0-9]{1,2})?)/g)].map((m) =>
    parseMoneyString(m[1])
  );

  if (prices.length < 2) {
    return {
      currentPrice: null,
      originalPrice: null,
      discountPercent: null
    };
  }

  const currentPrice = prices[prices.length - 1];
  const originalPrice = prices[prices.length - 2];
  const discountPercent = computeDiscountPercent(currentPrice, originalPrice);

  return {
    currentPrice,
    originalPrice,
    discountPercent
  };
}

function parseCategoryCandidates($, pageUrl) {
  const candidates = [];
  const productAnchors = [];

  $('a[href*="/product/"]').each((_, el) => {
    const anchor = $(el);
    const href = absoluteUrl(pageUrl, anchor.attr("href") || "");
    const wrapper = anchor.closest("li.product, .product, article, li, div");
    const title = extractCardTitle(anchor, wrapper);
    const text = cleanText(wrapper.text());
    const imageUrl = extractCardImage(anchor, wrapper);
    const { currentPrice, originalPrice, discountPercent } = extractCardPrices(text);

    const rawItem = {
      href,
      title,
      image: imageUrl,
      currentPrice,
      originalPrice,
      discountPercent,
      text: text.slice(0, 260)
    };

    productAnchors.push(rawItem);

    if (!isProductHref(href)) return;
    if (!title || title.length < 3) return;
    if (!imageUrl) return;
    if (!currentPrice || !originalPrice || !discountPercent) return;

    const description = cleanText(
      text
        .replace(title, "")
        .replace(/\$[0-9.,]+/g, " ")
        .replace(/\bSold By:\b/gi, " ")
        .replace(/\bRated [0-9.]+ out of 5\b/gi, " ")
        .replace(/\bOriginal price was:\b/gi, " ")
        .replace(/\bCurrent price is:\b/gi, " ")
        .replace(/\bSale!\b/gi, " ")
    ).slice(0, 220);

    const offerType =
      text.toLowerCase().includes("lifetime") || text.toLowerCase().includes("ltd")
        ? "lifetime"
        : "discount";

    candidates.push({
      href,
      title,
      description,
      currentPrice,
      originalPrice,
      discountPercent,
      imageUrl,
      offerType
    });
  });

  console.log(`🟢 [DealMirror] Product href anchors found: ${productAnchors.length}`);
  productAnchors.slice(0, 30).forEach((item, index) => {
    console.log(`🟢 [DealMirror] Product anchor ${index + 1}:`, item);
  });

  return dedupeBySlug(
    candidates.map((item) => ({
      slug: slugify(item.title),
      ...item
    }))
  );
}

function extractDetailHeroImage($) {
  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    "";

  if (ogImage) return ogImage;

  const galleryImage =
    $(".woocommerce-product-gallery__image img").first().attr("src") ||
    $(".woocommerce-product-gallery__image img").first().attr("data-src") ||
    $(".woocommerce-product-gallery__wrapper img").first().attr("src") ||
    $(".woocommerce-product-gallery__wrapper img").first().attr("data-src") ||
    $("img.wp-post-image").first().attr("src") ||
    $("img.wp-post-image").first().attr("data-src") ||
    $("main img").first().attr("src") ||
    "";

  return String(galleryImage).split(" ")[0];
}

function extractDetailTitle($, fallback = "") {
  return (
    cleanText($("h1.product_title").first().text()) ||
    cleanText($("main h1").first().text()) ||
    fallback
  );
}

function extractDetailDescription($, fallback = "") {
  return (
    cleanText($('meta[name="description"]').attr("content") || "") ||
    cleanText($(".woocommerce-product-details__short-description").first().text()) ||
    cleanText($(".entry-summary p").first().text()) ||
    fallback
  );
}

function extractDetailPricing($, fallbackCurrent = null, fallbackOriginal = null) {
  const bodyText = cleanText($("body").text());

  let currentPrice =
    parseMoneyString($(".price ins .woocommerce-Price-amount").first().text()) ||
    parseMoneyString($(".price .woocommerce-Price-amount").first().text()) ||
    fallbackCurrent;

  let originalPrice =
    parseMoneyString($(".price del .woocommerce-Price-amount").first().text()) ||
    fallbackOriginal;

  if ((!currentPrice || !originalPrice) && bodyText) {
    const prices = [...bodyText.matchAll(/\$([0-9]+(?:\.[0-9]{1,2})?)/g)].map((m) =>
      parseMoneyString(m[1])
    );

    if (!currentPrice && prices.length > 0) currentPrice = prices[prices.length - 1];
    if (!originalPrice && prices.length > 1) originalPrice = prices[prices.length - 2];
  }

  return { currentPrice, originalPrice };
}

async function enrichFromDetail(candidate, sourceMeta, options = {}) {
  console.log(`🟢 [DealMirror] Processing detail page: ${candidate.href}`);

  const html = await fetchHtml(candidate.href);
  const $ = cheerio.load(html);

  const title = extractDetailTitle($, candidate.title);
  const description = extractDetailDescription($, candidate.description || "");
  const heroImage = extractDetailHeroImage($) || candidate.imageUrl || "";

  const { currentPrice, originalPrice } = extractDetailPricing(
    $,
    candidate.currentPrice,
    candidate.originalPrice
  );

  const discountPercent = computeDiscountPercent(currentPrice, originalPrice);
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
    source: "dealmirror",
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

  console.log("🟢 [DealMirror] Candidate:", {
    title: built.name,
    href: built.url,
    image: built.og_image,
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
        console.error(`❌ [DealMirror] Detail parse failed for index ${currentIndex}:`, error.message);
        results[currentIndex] = null;
      }
      await sleep(100);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);

  return results.filter(Boolean);
}

export async function fetchDealmirrorDeals(pages = [], options = {}) {
  const sourceMeta = getSourceMeta("dealmirror");
  const categoryCandidates = [];

  for (const page of pages) {
    console.log(`🟢 [DealMirror] Processing page: ${page.url}`);

    const html = await fetchHtml(page.url);
    const $ = cheerio.load(html);

    const candidates = parseCategoryCandidates($, page.url);

    for (const candidate of candidates) {
      console.log("🟢 [DealMirror] Category candidate:", {
        title: candidate.title,
        href: candidate.href,
        image: candidate.imageUrl,
        current: candidate.currentPrice,
        original: candidate.originalPrice,
        discount: candidate.discountPercent
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

  console.log(`🟢 [DealMirror] Category candidates after dedupe: ${dedupedCategory.length}`);

  const detailed = await mapLimit(dedupedCategory, 4, async (candidate) =>
    enrichFromDetail(candidate, sourceMeta, options)
  );

  const finalDeals = dedupeBySlug(detailed);
  console.log(`🟢 [DealMirror] Final deduped deals: ${finalDeals.length}`);
  return finalDeals;
}
