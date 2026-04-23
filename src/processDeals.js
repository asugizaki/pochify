import fs from "fs";
import path from "path";
import {
  generateDealPage,
  ensureShellPages,
  generateRobotsTxtIfMissing,
  generateSitemapFromDeals
} from "./generateDealPage.js";
import { runSources } from "./runSources.js";
import { enrichProduct } from "./enrichProduct.js";
import { enhanceCopy } from "./copywriter.js";
import { generateDealContent } from "./ai/generateDealContent.js";
import { cacheRemoteImage } from "./assetCache.js";

const BASE_URL = "https://go.pochify.com";
const HEALTH_URL = `${BASE_URL}/api/health`;
const SETTINGS_URL = `${BASE_URL}/api/settings/public`;
const EXISTING_DETAILS_URL = `${BASE_URL}/api/deals/existing-details`;
const INGEST_URL = `${BASE_URL}/api/deals/ingest`;
const ALL_DEALS_URL = `${BASE_URL}/api/public/deals?limit=1000`;

const PENDING_TELEGRAM_PATH = path.join("data", "pending-telegram.json");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function saveJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function dedupeDeals(deals) {
  const map = new Map();

  for (const deal of deals || []) {
    const key = deal.slug || deal.source_deal_url || deal.url;
    if (!key) continue;

    const existing = map.get(key);
    if (!existing || Number(deal.score || 0) > Number(existing.score || 0)) {
      map.set(key, deal);
    }
  }

  return [...map.values()];
}

async function parseJsonResponse(res, label) {
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();

  if (!contentType.includes("application/json")) {
    console.error(`❌ ${label} returned non-JSON response`);
    console.error(`❌ ${label} status:`, res.status);
    console.error(`❌ ${label} content-type:`, contentType);
    console.error(`❌ ${label} raw response:`, raw.slice(0, 1000));
    throw new Error(`${label} returned non-JSON response (${res.status})`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`❌ ${label} JSON parse error:`, error.message);
    console.error(`❌ ${label} raw response:`, raw.slice(0, 1000));
    throw new Error(`Failed to parse JSON from ${label}`);
  }
}

async function checkBackendHealth() {
  const res = await fetch(HEALTH_URL);
  const data = await parseJsonResponse(res, "health");

  console.log("💓 Backend health:", data);

  if (!res.ok || !data?.ok) {
    throw new Error(`Backend health failed (${res.status})`);
  }
}

async function loadSettings() {
  const res = await fetch(SETTINGS_URL);
  const data = await parseJsonResponse(res, "settings");

  if (!res.ok) {
    throw new Error(`Failed to load settings: ${res.status}`);
  }

  return data.settings || {};
}

async function loadExistingDetails(slugs) {
  if (!slugs.length) return new Map();

  const res = await fetch(EXISTING_DETAILS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ slugs })
  });

  const data = await parseJsonResponse(res, "existing-details");

  if (!res.ok) {
    throw new Error(`Failed to load existing details: ${res.status}`);
  }

  return new Map((data.items || []).map((item) => [item.slug, item]));
}

function hasPriceInfo(deal) {
  return Boolean(
    deal &&
      deal.current_price &&
      (deal.original_price || deal.discount_percent || deal.offer_type === "lifetime")
  );
}

function pricingChanged(existing, deal) {
  return (
    Number(existing?.current_price || 0) !== Number(deal?.current_price || 0) ||
    Number(existing?.original_price || 0) !== Number(deal?.original_price || 0) ||
    Number(existing?.discount_percent || 0) !== Number(deal?.discount_percent || 0)
  );
}

function getBlockedKeywords(settings) {
  const raw = settings?.blocked_deal_keywords;

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
  }

  return [];
}

function isExcludedDeal(deal, settings) {
  const text = `${deal?.name || ""} ${deal?.description || ""}`.toLowerCase();
  const blockedTerms = getBlockedKeywords(settings);
  const matched = blockedTerms.find((term) => text.includes(term));
  return matched || "";
}

function passesQualityGate(deal, settings) {
  const minScore = Number(settings.minimum_quality_score || 5);
  const minDiscount = Number(settings.minimum_discount_percent || 50);

  if (!deal?.og_image) {
    console.log(`⏭️ Skip ${deal?.name}: missing image`);
    return false;
  }

  if (!hasPriceInfo(deal)) {
    console.log(`⏭️ Skip ${deal?.name}: missing valid price info`);
    return false;
  }

  if (Number(deal.discount_percent || 0) < minDiscount) {
    console.log(
      `⏭️ Skip ${deal.name}: discount ${deal.discount_percent || 0}% below minimum ${minDiscount}%`
    );
    return false;
  }

  if (Number(deal.score || 0) < minScore) {
    console.log(
      `⏭️ Skip ${deal.name}: score ${deal.score || 0} below minimum ${minScore}`
    );
    return false;
  }

  return true;
}

function compactDealForIngest(deal) {
  return {
    name: deal.name,
    slug: deal.slug,
    brand_key: deal.brand_key,
    description: deal.description || "",
    url: deal.url || "",
    stacksocial_url: deal.stacksocial_url || null,
    vendor_url: deal.vendor_url || null,
    affiliateLink: deal.affiliateLink || "",
    affiliate_url: deal.affiliate_url || "",
    affiliate_detected: !!deal.affiliate_detected,
    network_guess: deal.network_guess || "",
    page_url: deal.page_url || `https://pochify.com/deals/${deal.slug}.html`,
    source: deal.source || "",
    source_key: deal.source_key || "",
    source_name: deal.source_name || "",
    source_logo_path: deal.source_logo_path || "",
    source_home_url: deal.source_home_url || "",
    source_deal_url: deal.source_deal_url || "",
    channel: deal.channel || "general",
    votes_count: deal.votes_count || 0,
    score: deal.score || 0,
    current_price: deal.current_price ?? null,
    original_price: deal.original_price ?? null,
    discount_percent: deal.discount_percent ?? null,
    offer_type: deal.offer_type || "",
    quality_score: deal.quality_score || deal.score || 0,
    has_required_assets: !!deal.has_required_assets,
    is_publishable: !!deal.is_publishable,
    needs_regeneration: !!deal.needs_regeneration,
    meta_title: deal.meta_title || "",
    meta_description: deal.meta_description || "",
    og_image: deal.og_image || "",
    local_hero_image_path: deal.local_hero_image_path || "",
    hook: deal.hook || "",
    audience: deal.audience || "",
    why_now: deal.why_now || "",
    caution: deal.caution || ""
  };
}

async function ingestDeals(deals, settings) {
  const compactDeals = deals.map(compactDealForIngest);
  const batchSize = 8;
  const allSendCandidates = [];

  for (let i = 0; i < compactDeals.length; i += batchSize) {
    const batch = compactDeals.slice(i, i + batchSize);

    console.log(
      `📦 Ingest batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(compactDeals.length / batchSize)} (${batch.length} deals)`
    );

    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        deals: batch,
        maxToSend: 2,
        settings
      })
    });

    const data = await parseJsonResponse(res, "ingest");
    console.log("📡 Backend batch response:", data);

    if (!res.ok || !data?.success) {
      throw new Error("Failed to ingest deals to backend");
    }

    if (Array.isArray(data.sendCandidates)) {
      allSendCandidates.push(...data.sendCandidates);
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const item of allSendCandidates) {
    if (!item?.slug) continue;
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    deduped.push(item);
  }

  return deduped.slice(0, 2);
}

async function loadAllDealsForSitemap() {
  const res = await fetch(ALL_DEALS_URL);
  const data = await parseJsonResponse(res, "public-deals");

  if (!res.ok) {
    throw new Error(`Failed to load deals for sitemap: ${res.status}`);
  }

  return data.items || [];
}

async function run() {
  console.log("🚀 Processing deals...");

  await checkBackendHealth();

  const settings = await loadSettings();

  ensureShellPages();
  generateRobotsTxtIfMissing();

  const rawDeals = dedupeDeals(await runSources(settings));
  console.log(`📦 Total normalized deals: ${rawDeals.length}`);

  const existingMap = await loadExistingDetails(rawDeals.map((d) => d.slug));

  const candidates = [];

  for (const deal of rawDeals) {
    const existing = existingMap.get(deal.slug);

    if (existing) {
      const changed = pricingChanged(existing, deal);
      const regen = !!existing.needs_regeneration;

      if (!regen && !changed) {
        console.log(`⏭️ Skip existing unchanged: ${deal.name}`);
        continue;
      }

      if (changed) {
        console.log(`♻️ Reconsider changed pricing: ${deal.name}`);
      }

      if (regen) {
        console.log(`♻️ Reconsider regeneration flagged: ${deal.name}`);
      }
    }

    const excludedBy = isExcludedDeal(deal, settings);
    if (excludedBy) {
      console.log(`⏭️ Excluded by blocked term "${excludedBy}": ${deal.name}`);
      continue;
    }

    if (!passesQualityGate(deal, settings)) {
      console.log(`⏭️ Failed quality gate: ${deal.name}`);
      continue;
    }

    console.log(
      `✅ Candidate accepted for enrichment: ${deal.name} | score=${deal.score} | discount=${deal.discount_percent}%`
    );
    candidates.push(deal);
  }

  console.log(`✅ Candidates after pre-filtering: ${candidates.length}`);

  const finalDeals = [];

  for (const deal of candidates) {
    const localHeroImagePath = await cacheRemoteImage({
      imageUrl: deal.og_image,
      slug: deal.slug,
      type: "deals"
    });
  
    const enriched = await enrichProduct({
      ...deal,
      og_image: localHeroImagePath || deal.og_image || "",
      card_image: deal.card_image || deal.og_image || "",
      local_hero_image_path: localHeroImagePath || "",
      local_card_image_path: ""
    });
  
    const improved = enhanceCopy(enriched);
    const aiContent = await generateDealContent(improved);
  
    const finalDeal = {
      ...improved,
      ...aiContent,
  
      source: deal.source || improved.source || "unknown",
      source_key: deal.source_key || improved.source_key || "",
      source_name: deal.source_name || improved.source_name || "",
      source_logo_path: deal.source_logo_path || improved.source_logo_path || "",
      source_home_url: deal.source_home_url || improved.source_home_url || "",
      source_deal_url: deal.source_deal_url || improved.source_deal_url || "",
  
      og_image: localHeroImagePath || deal.og_image || improved.og_image || "",
      local_hero_image_path: localHeroImagePath || "",
      card_image: deal.card_image || improved.card_image || deal.og_image || improved.og_image || "",
      local_card_image_path: improved.local_card_image_path || "",
  
      stacksocial_url: deal.stacksocial_url || improved.stacksocial_url || "",
      vendor_url: deal.vendor_url || improved.vendor_url || "",
      current_price: deal.current_price ?? improved.current_price ?? null,
      original_price: deal.original_price ?? improved.original_price ?? null,
      discount_percent: deal.discount_percent ?? improved.discount_percent ?? null,
      offer_type: deal.offer_type || improved.offer_type || "",
  
      affiliateLink:
        deal.affiliateLink ||
        improved.affiliateLink ||
        deal.source_deal_url ||
        deal.url ||
        "",
  
      affiliate_url: improved.affiliate_url || "",
      affiliate_detected: !!improved.affiliate_detected,
      network_guess: improved.network_guess || "",
  
      quality_score: Number(deal.score || improved.score || 0),
      has_required_assets: true,
      is_publishable: true,
      needs_regeneration: false
    };
  
    console.log("🧪 Final deal before page/ingest:", {
      name: finalDeal.name,
      slug: finalDeal.slug,
      card_image: finalDeal.card_image,
      og_image: finalDeal.og_image,
      current_price: finalDeal.current_price,
      original_price: finalDeal.original_price,
      discount_percent: finalDeal.discount_percent
    });
  
    generateDealPage(finalDeal);
    finalDeals.push(finalDeal);
    console.log(`📝 Generated page: docs/deals/${finalDeal.slug}.html`);
  }

  console.log(`✅ Final publishable deals this run: ${finalDeals.length}`);

  const sendCandidates = await ingestDeals(finalDeals, settings);
  saveJson(PENDING_TELEGRAM_PATH, sendCandidates);

  const allDeals = await loadAllDealsForSitemap();
  generateSitemapFromDeals(allDeals);

  console.log(`📨 Pending Telegram deals: ${sendCandidates.length}`);
  console.log("🏁 Done");
}

run().catch((error) => {
  console.error("❌ processDeals fatal error:", error);
  process.exit(1);
});
