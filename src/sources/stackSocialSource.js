import * as cheerio from "cheerio";
import { alertAdmin } from "../alertAdmin.js";

const STACKSOCIAL_COLLECTIONS = [
  "https://www.stacksocial.com/collections/artificial-intelligence",
  "https://www.stacksocial.com/collections/artificial-intelligence?page=2",
  "https://www.stacksocial.com/collections/lifetime-subscriptions?page=1&sort=newest",
  "https://www.stacksocial.com/collections/lifetime-subscriptions?page=2&sort=newest",
  "https://www.stacksocial.com/collections/apps-software-productivity"
];

const USER_AGENT =
  "Mozilla/5.0 (compatible; PochifyBot/1.0; +https://pochify.com)";

let imageFailureAlertSent = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function cleanText(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function safeUrl(input) {
  try {
    return new URL(input).toString();
  } catch {
    return "";
  }
}

function absoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

function parseMoneyString(text = "") {
  const normalized = String(text).replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function parsePercentString(text = "") {
  const match = String(text).match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const num = Number.parseInt(match[1], 10);
  if (!Number.isFinite(num)) return null;
  if (num < 0 || num > 100) return null;
  return num;
}

function computeDiscountPercent(currentPrice, originalPrice) {
  if (!currentPrice || !originalPrice || originalPrice <= currentPrice) return null;
  const percent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  if (percent < 0 || percent > 100) return null;
  return percent;
}

function detectChannel(text = "") {
  const value = text.toLowerCase();

  if (
    value.includes("ai") ||
    value.includes("artificial intelligence") ||
    value.includes("chatgpt") ||
    value.includes("llm") ||
    value.includes("image generator") ||
    value.includes("text-to-speech") ||
    value.includes("voice ai")
  ) {
    return "ai";
  }

  return "saas";
}

function extractJsonLd($) {
  const items = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() || "";
    if (!raw.trim()) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        items.push(...parsed);
      } else {
        items.push(parsed);
      }
    } catch {
      // ignore malformed json-ld
    }
  });

  return items;
}

function findProductJsonLd(jsonLdItems = []) {
  for (const item of jsonLdItems) {
    if (!item || typeof item !== "object") continue;

    if (item["@type"] === "Product") return item;

    if (Array.isArray(item["@graph"])) {
      for (const child of item["@graph"]) {
        if (child && child["@type"] === "Product") return child;
      }
    }
  }

  return null;
}

function extractVendorUrl($, pageUrl) {
  const externalLinks = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const full = absoluteUrl(pageUrl, href);
    if (!full) return;

    const isExternal =
      !full.includes("stacksocial.com") &&
      !full.includes("stackcommerce.com") &&
      !full.includes("facebook.com") &&
      !full.includes("twitter.com") &&
      !full.includes("linkedin.com") &&
      !full.includes("instagram.com") &&
      !full.includes("youtube.com");

    if (isExternal) {
      externalLinks.push(full);
    }
  });

  return externalLinks[0] || "";
}

function buildStackSocialAffiliateUrl(stackSocialUrl) {
  const template = process.env.STACKSOCIAL_AFFILIATE_DEEPLINK_TEMPLATE || "";
  if (!template) return "";
  return template.replace("{{url}}", encodeURIComponent(stackSocialUrl));
}

function scoreStackSocialDeal({
  name,
  description,
  discountPercent,
  reviewCount,
  sourceUrl
}) {
  let score = 0;
  const text = `${name} ${description} ${sourceUrl}`.toLowerCase();

  if (discountPercent && discountPercent >= 70) score += 3;
  else if (discountPercent && discountPercent >= 40) score += 2;
  else if (discountPercent && discountPercent >= 20) score += 1;

  if (reviewCount >= 100) score += 3;
  else if (reviewCount >= 20) score += 2;
  else if (reviewCount >= 5) score += 1;

  if (
    text.includes("lifetime") ||
    text.includes("lifetime subscription") ||
    text.includes("lifetime license")
  ) {
    score += 2;
  }

  if (
    text.includes("ai") ||
    text.includes("chatgpt") ||
    text.includes("automation") ||
    text.includes("writing") ||
    text.includes("video") ||
    text.includes("image") ||
    text.includes("voice")
  ) {
    score += 2;
  }

  if (text.includes("bundle") || text.includes("course")) {
    score -= 2;
  }

  return Math.max(1, Math.min(10, score));
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT
    }
  });

  if (!res.ok) {
    throw new Error(`StackSocial fetch failed: ${res.status} ${url}`);
  }

  return await res.text();
}

async function fetchCollectionDealLinks(collectionUrl, limitPerCollection = 20) {
  const html = await fetchHtml(collectionUrl);
  const $ = cheerio.load(html);

  const dealMap = new Map();

  $("a[href*='/sales/']").each((_, el) => {
    const href = $(el).attr("href") || "";
    const fullUrl = absoluteUrl(collectionUrl, href);
    const text = cleanText($(el).text());

    if (!fullUrl || !fullUrl.includes("/sales/")) return;
    if (!text) return;

    if (!dealMap.has(fullUrl)) {
      dealMap.set(fullUrl, {
        url: fullUrl,
        anchorText: text
      });
    }
  });

  return [...dealMap.values()].slice(0, limitPerCollection);
}

function firstSrcFromSrcset(srcset = "") {
  return String(srcset)
    .split(",")[0]
    ?.trim()
    .split(" ")[0]
    ?.trim();
}

function pushCandidate(list, value, canonicalUrl) {
  if (!value) return;
  const url = absoluteUrl(canonicalUrl, value);
  if (!url) return;
  list.push(url);
}

function extractImageFromRawHtml(html) {
  const patterns = [
    /https:\/\/cdnp\d+\.stackassets\.com\/[^"'\\\s]+product_\d+_product_shots1\.(?:jpg|jpeg|png|webp)/i,
    /https:\/\/cdnp\d+\.stackassets\.com\/[^"'\\\s]+product_\d+_product_shots\d+\.(?:jpg|jpeg|png|webp)/i,
    /https:\/\/cdnp\d+\.stackassets\.com\/[^"'\\\s]+\.(?:jpg|jpeg|png|webp)/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }

  return "";
}

function extractImageFromActiveSlide($, canonicalUrl) {
  const candidates = [];
  const selectors = [
    ".swiper-slide.swiper-slide-active img",
    ".swiper-slide.swiper-slide-active source",
    ".swiper-slide-active img",
    ".swiper-slide-active source",
    '[class*="swiper-slide"][class*="active"] img',
    '[class*="swiper-slide"][class*="active"] source'
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      pushCandidate(candidates, $(el).attr("src"), canonicalUrl);
      pushCandidate(candidates, $(el).attr("data-src"), canonicalUrl);
      pushCandidate(candidates, $(el).attr("data-lazy-src"), canonicalUrl);

      const srcset =
        $(el).attr("srcset") ||
        $(el).attr("data-srcset") ||
        $(el).attr("data-lazy-srcset") ||
        "";
      pushCandidate(candidates, firstSrcFromSrcset(srcset), canonicalUrl);
    });
  }

  const preferred =
    candidates.find((url) => url.includes("product_shots1")) ||
    candidates.find((url) => url.includes("product_shots")) ||
    candidates.find((url) => url.includes("product_")) ||
    candidates[0] ||
    "";

  return preferred;
}

function extractDealImage(html, $, canonicalUrl, productJsonLd) {
  const debug = {
    rawHtmlImage: "",
    structuredDataImage: "",
    activeSlideImage: "",
    metaImage: "",
    finalImage: "",
    allCandidates: []
  };

  const rawHtmlImage = extractImageFromRawHtml(html);
  debug.rawHtmlImage = rawHtmlImage;
  if (rawHtmlImage) {
    debug.finalImage = safeUrl(rawHtmlImage);
    return { image: safeUrl(rawHtmlImage), debug };
  }

  if (productJsonLd?.image) {
    const images = Array.isArray(productJsonLd.image)
      ? productJsonLd.image
      : [productJsonLd.image];

    const structured = images
      .map((img) => absoluteUrl(canonicalUrl, img))
      .find(Boolean);

    debug.structuredDataImage = structured || "";
    if (structured) {
      debug.finalImage = safeUrl(structured);
      return { image: safeUrl(structured), debug };
    }
  }

  const activeSlideImage = extractImageFromActiveSlide($, canonicalUrl);
  debug.activeSlideImage = activeSlideImage;
  if (activeSlideImage) {
    debug.finalImage = safeUrl(activeSlideImage);
    return { image: safeUrl(activeSlideImage), debug };
  }

  const metaCandidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content")
  ]
    .map((img) => absoluteUrl(canonicalUrl, img))
    .filter(Boolean);

  debug.allCandidates = metaCandidates;

  const metaImage = metaCandidates.find((url) => {
    const lower = url.toLowerCase();
    return (
      lower.includes("stackassets") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp")
    );
  });

  debug.metaImage = metaImage || "";
  debug.finalImage = metaImage ? safeUrl(metaImage) : "";

  return { image: metaImage ? safeUrl(metaImage) : "", debug };
}

function extractPricing($, productJsonLd, pageText) {
  let currentPrice = null;
  let originalPrice = null;
  let discountPercent = null;

  const jsonOffer = productJsonLd?.offers;
  if (jsonOffer && typeof jsonOffer === "object") {
    currentPrice =
      parseMoneyString(jsonOffer.price) ??
      parseMoneyString(jsonOffer.lowPrice) ??
      parseMoneyString(jsonOffer.highPrice);
  }

  // 1. Label-based parsing from full page text (most reliable for StackSocial)
  const dealPriceMatch = pageText.match(/Deal Price\s*\$([0-9]+(?:\.[0-9]{2})?)/i);
  const suggestedPriceMatch = pageText.match(/Suggested Price\s*\$([0-9]+(?:\.[0-9]{2})?)/i);
  const offMatch = pageText.match(/(\d{1,3})%\s*Off/i);

  if (dealPriceMatch?.[1]) {
    currentPrice = parseMoneyString(dealPriceMatch[1]) ?? currentPrice;
  }

  if (suggestedPriceMatch?.[1]) {
    originalPrice = parseMoneyString(suggestedPriceMatch[1]) ?? originalPrice;
  }

  if (offMatch?.[1]) {
    discountPercent = parsePercentString(offMatch[1]) ?? discountPercent;
  }

  // 2. Fallback selectors if label-based parsing missed anything
  if (!currentPrice) {
    const saleSelectors = [
      '[data-testid*="sale"]',
      '[class*="sale-price"]',
      '[class*="final-price"]',
      '[class*="price"]'
    ];

    for (const selector of saleSelectors) {
      const value = cleanText($(selector).first().text());
      const parsed = parseMoneyString(value);
      if (parsed) {
        currentPrice = parsed;
        break;
      }
    }
  }

  if (!originalPrice) {
    const compareSelectors = [
      '[class*="retail-price"]',
      '[class*="original-price"]',
      '[class*="compare-at"]',
      "s",
      "del"
    ];

    for (const selector of compareSelectors) {
      const value = cleanText($(selector).first().text());
      const parsed = parseMoneyString(value);
      if (parsed && (!originalPrice || parsed > originalPrice)) {
        originalPrice = parsed;
      }
    }
  }

  if (!discountPercent) {
    const percentSelectors = [
      '[class*="discount"]',
      '[class*="savings"]',
      "span",
      "div"
    ];

    for (const selector of percentSelectors) {
      const value = cleanText($(selector).text());
      const parsed = parsePercentString(value);
      if (parsed) {
        discountPercent = parsed;
        break;
      }
    }
  }

  // 3. Infer missing values if possible
  if (!originalPrice && currentPrice && discountPercent) {
    const inferred = currentPrice / (1 - discountPercent / 100);
    if (Number.isFinite(inferred) && inferred > currentPrice) {
      originalPrice = Number(inferred.toFixed(2));
    }
  }

  if (!discountPercent && currentPrice && originalPrice) {
    discountPercent = computeDiscountPercent(currentPrice, originalPrice);
  }

  // 4. Sanity cleanup
  if (originalPrice && currentPrice && originalPrice <= currentPrice) {
    originalPrice = null;
  }

  if (
    discountPercent &&
    (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)
  ) {
    discountPercent = null;
  }

  return {
    currentPrice,
    originalPrice,
    discountPercent
  };
}

async function fetchDealDetail(dealLink) {
  const html = await fetchHtml(dealLink.url);
  const $ = cheerio.load(html);
  const jsonLdItems = extractJsonLd($);
  const productJsonLd = findProductJsonLd(jsonLdItems);

  const canonicalUrl = safeUrl($('link[rel="canonical"]').attr("href") || dealLink.url);
  const ogTitle = cleanText($('meta[property="og:title"]').attr("content") || "");
  const ogDescription = cleanText(
    $('meta[property="og:description"]').attr("content") || ""
  );
  const h1 = cleanText($("h1").first().text());
  const pageText = cleanText($("body").text());

  const name =
    cleanText(productJsonLd?.name) ||
    h1 ||
    ogTitle.replace(/\s*\|\s*StackSocial.*$/i, "") ||
    dealLink.anchorText.split(/\d+\s*%\s*Off/i)[0].trim();

  const description =
    cleanText(productJsonLd?.description) ||
    ogDescription ||
    dealLink.anchorText ||
    "";

  const imageResult = extractDealImage(html, $, canonicalUrl, productJsonLd);
  const image = imageResult.image;

  console.log("🖼️ StackSocial image debug:", {
    deal: name,
    url: dealLink.url,
    rawHtmlImage: imageResult.debug.rawHtmlImage,
    structuredDataImage: imageResult.debug.structuredDataImage,
    activeSlideImage: imageResult.debug.activeSlideImage,
    metaImage: imageResult.debug.metaImage,
    finalImage: imageResult.debug.finalImage
  });

  if (!image) {
    if (!imageFailureAlertSent) {
      imageFailureAlertSent = true;
      await alertAdmin(
        `Pochify alert: StackSocial image extraction failed. Their product gallery structure may have changed and needs a parser update.\n\nExample: ${dealLink.url}`
      );
    }
    throw new Error("Missing valid image");
  }

  const { currentPrice, originalPrice, discountPercent } = extractPricing(
    $,
    productJsonLd,
    pageText
  );

  console.log("💲 StackSocial pricing debug:", {
    deal: name,
    url: dealLink.url,
    currentPrice,
    originalPrice,
    discountPercent
  });

  const reviewMatch = pageText.match(/(\d+)\s+Reviews?/i);
  const reviewCount = reviewMatch ? Number.parseInt(reviewMatch[1], 10) : 0;

  const vendorUrl = extractVendorUrl($, canonicalUrl);
  const channel = detectChannel(`${name} ${description} ${canonicalUrl}`);
  const offerType = /lifetime/i.test(`${name} ${description} ${pageText}`)
    ? "lifetime"
    : "discount";

  const score = scoreStackSocialDeal({
    name,
    description,
    discountPercent,
    reviewCount,
    sourceUrl: canonicalUrl
  });

  const brandKey = slugify(
    vendorUrl
      ? new URL(vendorUrl).hostname.replace(/^www\./, "")
      : name
  );

  return {
    name,
    slug: slugify(name),
    brand_key: brandKey || slugify(name),
    description,
    url: vendorUrl || canonicalUrl,
    vendor_url: vendorUrl || "",
    stacksocial_url: canonicalUrl,
    affiliateLink: buildStackSocialAffiliateUrl(canonicalUrl),
    source: "stacksocial",
    source_type: "merchant_collection",
    source_detail: canonicalUrl,
    merchant: "stacksocial",
    merchant_url: canonicalUrl,
    og_image: image,
    channel,
    score,
    votes_count: reviewCount,
    review_count: reviewCount,
    discount_percent: discountPercent,
    current_price: currentPrice,
    original_price: originalPrice,
    offer_type: offerType,
    meta_title: `${name} Deal Review | Pochify`,
    meta_description: description.slice(0, 155),
    raw_anchor_text: dealLink.anchorText
  };
}

export async function fetchStackSocialDeals(options = {}) {
  const maxDeals = options.maxDeals || 12;
  const limitPerCollection = options.limitPerCollection || 12;

  const allLinks = [];

  for (const collectionUrl of STACKSOCIAL_COLLECTIONS) {
    try {
      const links = await fetchCollectionDealLinks(collectionUrl, limitPerCollection);
      allLinks.push(...links);
      await sleep(300);
    } catch (error) {
      console.error(`❌ StackSocial collection failed: ${collectionUrl}`, error.message);
    }
  }

  const uniqueLinks = [];
  const seen = new Set();

  for (const link of allLinks) {
    if (!seen.has(link.url)) {
      seen.add(link.url);
      uniqueLinks.push(link);
    }
  }

  const deals = [];

  for (const link of uniqueLinks.slice(0, maxDeals * 2)) {
    try {
      const detail = await fetchDealDetail(link);

      const titleText = `${detail.name} ${detail.description}`.toLowerCase();
      const looksRelevant =
        detail.channel === "ai" ||
        titleText.includes("automation") ||
        titleText.includes("productivity") ||
        titleText.includes("writing") ||
        titleText.includes("video") ||
        titleText.includes("image") ||
        titleText.includes("voice");

      if (looksRelevant) {
        deals.push(detail);
      }

      if (deals.length >= maxDeals) break;
      await sleep(250);
    } catch (error) {
      console.error(`❌ StackSocial deal parse failed: ${link.url}`, error.message);
    }
  }

  return deals;
}
