import * as cheerio from "cheerio";

const STACKSOCIAL_COLLECTIONS = [
  "https://www.stacksocial.com/collections/artificial-intelligence",
  "https://www.stacksocial.com/collections/lifetime-subscriptions?page=1&sort=newest",
  "https://www.stacksocial.com/collections/apps-software-productivity"
];

const USER_AGENT =
  "Mozilla/5.0 (compatible; PochifyBot/1.0; +https://pochify.com)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

function extractMoney(text = "") {
  const matches = [...String(text).matchAll(/\$([0-9]+(?:\.[0-9]{2})?)/g)].map((m) =>
    Number.parseFloat(m[1])
  );
  return matches;
}

function extractPercent(text = "") {
  const match = String(text).match(/(\d+)\s*%\s*Off/i);
  return match ? Number.parseInt(match[1], 10) : null;
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

async function fetchDealDetail(dealLink) {
  const html = await fetchHtml(dealLink.url);
  const $ = cheerio.load(html);

  const ogTitle = cleanText($('meta[property="og:title"]').attr("content") || "");
  const ogDescription = cleanText(
    $('meta[property="og:description"]').attr("content") || ""
  );
  const ogImage = safeUrl($('meta[property="og:image"]').attr("content") || "");
  const canonicalUrl = safeUrl($('link[rel="canonical"]').attr("href") || dealLink.url);

  const h1 = cleanText($("h1").first().text());
  const pageText = cleanText($("body").text());

  const name =
    h1 ||
    ogTitle.replace(/\s*\|\s*StackSocial.*$/i, "") ||
    dealLink.anchorText.split(/\d+\s*%\s*Off/i)[0].trim();

  const description = ogDescription || dealLink.anchorText || "";
  const prices = extractMoney(pageText);
  const discountPercent = extractPercent(pageText) || extractPercent(dealLink.anchorText) || 0;

  const reviewMatch = pageText.match(/(\d+)\s+Reviews?/i);
  const reviewCount = reviewMatch ? Number.parseInt(reviewMatch[1], 10) : 0;

  const vendorUrl = extractVendorUrl($, canonicalUrl);
  const channel = detectChannel(`${name} ${description} ${canonicalUrl}`);
  const score = scoreStackSocialDeal({
    name,
    description,
    discountPercent,
    reviewCount,
    sourceUrl: canonicalUrl
  });

  const currentPrice = prices[0] || null;
  const originalPrice = prices[1] || null;
  const offerType = /lifetime/i.test(pageText) ? "lifetime" : "discount";

  const brandKeySource = vendorUrl || name;
  const brandKey = slugify(
    vendorUrl
      ? new URL(vendorUrl).hostname.replace(/^www\./, "")
      : name
  );

  return {
    name,
    slug: slugify(name),
    brand_key: brandKey || slugify(brandKeySource),
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
    og_image: ogImage,
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
