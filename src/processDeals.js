import fs from "fs";
import path from "path";
import {
  generateDealPage,
  ensureShellPages,
  generateRobotsTxtIfMissing,
  generateSitemapFromDeals
} from "./generateDealPage.js";
import { fetchStackSocialDeals } from "./sources/stackSocialSource.js";
import { enrichProduct } from "./enrichProduct.js";
import { enhanceCopy } from "./copywriter.js";
import { generateDealContent } from "./ai/generateDealContent.js";

const BASE_URL = "https://go.pochify.com";
const SETTINGS_URL = `${BASE_URL}/api/settings/public`;
const EXISTING_SUMMARIES_URL = `${BASE_URL}/api/deals/existing-summaries`;
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
    const key =
      deal.brand_key ||
      deal.slug ||
      deal.vendor_url ||
      deal.url ||
      deal.stacksocial_url;

    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, deal);
      continue;
    }

    if ((deal.score || 0) > (existing.score || 0)) {
      map.set(key, { ...existing, ...deal });
    } else {
      map.set(key, { ...deal, ...existing });
    }
  }

  return [...map.values()];
}

async function loadSettings() {
  const res = await fetch(SETTINGS_URL);
  if (!res.ok) {
    throw new Error(`Failed to load settings: ${res.status}`);
  }

  const data = await res.json();
  return data.settings || {};
}

async function loadExistingSummaries(slugs) {
  const res = await fetch(EXISTING_SUMMARIES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slugs })
  });

  if (!res.ok) {
    throw new Error(`Failed to load existing summaries: ${res.status}`);
  }

  const data = await res.json();
  return new Map((data.items || []).map((item) => [item.slug, item]));
}

function hasPriceInfo(deal) {
  return Boolean(
    deal.current_price &&
    (deal.original_price || deal.discount_percent || deal.offer_type === "lifetime")
  );
}

function passesQualityGate(deal, settings) {
  const minScore = Number(settings.minimum_quality_score || 5);

  if (deal.source !== "stacksocial") return false;
  if (settings.require_images_for_publish && !deal.og_image) return false;
  if (!hasPriceInfo(deal)) return false;
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
  console.log("⚙️ Loaded settings:", settings);

  ensureShellPages();
  generateRobotsTxtIfMissing();

  if (!settings.enable_stacksocial_source) {
    console.log("ℹ️ StackSocial source disabled by feature flag");
    return;
  }

  if (settings.enable_producthunt_source) {
    console.log("ℹ️ Product Hunt is enabled in DB, but this flow intentionally ignores it for now.");
  }

  const rawDeals = dedupeDeals(await fetchStackSocialDeals({ maxDeals: 20 }));
  console.log(`📥 StackSocial deals: ${rawDeals.length}`);

  const existingMap = await loadExistingSummaries(rawDeals.map((d) => d.slug));

  const candidates = [];
  for (const deal of rawDeals) {
    const existing = existingMap.get(deal.slug);

    if (existing && !existing.needs_regeneration) {
      console.log(`⏭️ Skipping existing deal with no regeneration flag: ${deal.name}`);
      continue;
    }

    if (!passesQualityGate(deal, settings)) {
      console.log(`⏭️ Skipping low-quality or incomplete deal: ${deal.name}`);
      continue;
    }

    candidates.push(deal);
  }

  console.log(`✅ Candidates after pre-filtering: ${candidates.length}`);

  const finalDeals = [];

  for (const deal of candidates) {
    const enriched = await enrichProduct(deal);
    const improved = enhanceCopy(enriched);
    const aiContent = await generateDealContent(improved);

    const finalDeal = {
      ...improved,
      ...aiContent,
      affiliate_url: "",
      affiliate_detected: false,
      network_guess: "",
      affiliateLink: improved.stacksocial_url || improved.url || "",
      quality_score: improved.score || 0,
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
  console.log("🗺️ Generated sitemap");

  console.log(`📨 Pending Telegram deals: ${sendCandidates.length}`);
  console.log("🏁 Done");
}

run().catch((err) => {
  console.error("❌ processDeals fatal error:", err);
  process.exit(1);
});
