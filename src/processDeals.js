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
const SETTINGS_URL = `${BASE_URL}/api/settings/public`;
const EXISTING_DETAILS_URL = `${BASE_URL}/api/deals/existing-details`;
const INGEST_URL = `${BASE_URL}/api/deals/ingest`;
const ALL_DEALS_URL = `${BASE_URL}/api/public/deals?limit=1000`;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function saveJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function dedupeDeals(deals) {
  const map = new Map();

  for (const deal of deals) {
    const key = deal.slug || deal.url || deal.source_deal_url;
    if (!key) continue;

    const existing = map.get(key);
    if (!existing || (deal.score || 0) > (existing.score || 0)) {
      map.set(key, deal);
    }
  }

  return [...map.values()];
}

async function loadSettings() {
  const res = await fetch(SETTINGS_URL);
  if (!res.ok) throw new Error(`Failed to load settings: ${res.status}`);
  const data = await res.json();
  return data.settings || {};
}

async function loadExistingDetails(slugs) {
  const res = await fetch(EXISTING_DETAILS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slugs })
  });

  if (!res.ok) throw new Error(`Failed to load existing details: ${res.status}`);
  const data = await res.json();
  return new Map((data.items || []).map((item) => [item.slug, item]));
}

function hasPriceInfo(deal) {
  return Boolean(
    deal.current_price &&
    (deal.original_price || deal.discount_percent || deal.offer_type === "lifetime")
  );
}

function pricingChanged(existing, deal) {
  return (
    Number(existing.current_price || 0) !== Number(deal.current_price || 0) ||
    Number(existing.original_price || 0) !== Number(deal.original_price || 0) ||
    Number(existing.discount_percent || 0) !== Number(deal.discount_percent || 0)
  );
}

function passesQualityGate(deal, settings) {
  const minScore = Number(settings.minimum_quality_score || 5);
  const minDiscount = Number(settings.minimum_discount_percent || 50);

  if (!deal.og_image) return false;
  if (!hasPriceInfo(deal)) return false;
  if (Number(deal.discount_percent || 0) < minDiscount) return false;
  if ((deal.score || 0) < minScore) return false;

  return true;
}

async function ingestDeals(deals, settings) {
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deals,
      maxToSend: 2,
      settings
    })
  });

  const data = await res.json();
  console.log("📡 Backend response:", data);

  if (!res.ok || !data.success) {
    throw new Error("Failed to ingest deals to backend");
  }

  return data.sendCandidates || [];
}

async function loadAllDealsForSitemap() {
  const res = await fetch(ALL_DEALS_URL);
  if (!res.ok) throw new Error(`Failed to load deals for sitemap: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

async function run() {
  console.log("🚀 Processing deals...");

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
    }

    if (!passesQualityGate(deal, settings)) {
      console.log(`⏭️ Failed quality gate: ${deal.name}`);
      continue;
    }

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
      og_image: localHeroImagePath || deal.og_image,
      local_hero_image_path: localHeroImagePath || ""
    });

    const improved = enhanceCopy(enriched);
    const aiContent = await generateDealContent(improved);

    const finalDeal = {
      ...improved,
      ...aiContent,
      source_key: deal.source_key,
      source_name: deal.source_name,
      source_logo_path: deal.source_logo_path,
      source_home_url: deal.source_home_url,
      source_deal_url: deal.source_deal_url,
      og_image: localHeroImagePath || deal.og_image,
      local_hero_image_path: localHeroImagePath || "",
      affiliateLink: deal.affiliateLink || deal.source_deal_url || deal.url || "",
      quality_score: deal.score || 0,
      has_required_assets: true,
      is_publishable: true,
      needs_regeneration: false
    };

    generateDealPage(finalDeal);
    finalDeals.push(finalDeal);
    console.log(`📝 Generated page: docs/deals/${finalDeal.slug}.html`);
  }

  console.log(`✅ Final publishable deals this run: ${finalDeals.length}`);

  const sendCandidates = await ingestDeals(finalDeals, settings);
  saveJson(path.join("data", "pending-telegram.json"), sendCandidates);

  const allDeals = await loadAllDealsForSitemap();
  generateSitemapFromDeals(allDeals);

  console.log(`📨 Pending Telegram deals: ${sendCandidates.length}`);
  console.log("🏁 Done");
}

run().catch((err) => {
  console.error("❌ processDeals fatal error:", err);
  process.exit(1);
});
