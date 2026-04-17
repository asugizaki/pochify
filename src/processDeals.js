import fs from "fs";
import path from "path";
import {
  generateDealPage,
  generateDealsIndex,
  generateCategoryPages,
  generateHomePage,
  generateStaticPages,
  generateRobotsTxt,
  generateSitemap
} from "./generateDealPage.js";
import { fetchDynamicDeals } from "./productSource.js";
import { fetchStackSocialDeals } from "./sources/stackSocialSource.js";
import { enrichProduct } from "./enrichProduct.js";
import { enhanceCopy } from "./copywriter.js";
import { generateDealContent } from "./ai/generateDealContent.js";

const BACKEND_URL = "https://go.pochify.com/api/deals/ingest";
const SETTINGS_URL = "https://go.pochify.com/api/settings/public";
const PENDING_PATH = path.join("data", "pending-telegram.json");
const MAX_SELECTED_DEALS = 24;

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
      map.set(key, {
        ...existing,
        ...deal
      });
    } else {
      map.set(key, {
        ...deal,
        ...existing
      });
    }
  }

  return [...map.values()];
}

async function loadSettings() {
  try {
    const res = await fetch(SETTINGS_URL);
    if (!res.ok) throw new Error(`settings status ${res.status}`);
    const data = await res.json();
    return data.settings || {};
  } catch (error) {
    console.warn("⚠️ Could not load settings from backend, using defaults:", error.message);
    return {
      enable_producthunt_source: false,
      enable_stacksocial_source: true,
      require_affiliate_approval: false,
      allow_stacksocial_direct_posting: true,
      require_images_for_publish: true
    };
  }
}

async function ingestDeals(deals, settings) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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

function isPublishableForPhaseOne(deal, settings) {
  if (settings.require_images_for_publish && !deal.og_image) return false;

  if (deal.source !== "stacksocial") return false;

  if (!settings.allow_stacksocial_direct_posting) return false;

  if (!deal.stacksocial_url) return false;

  return true;
}

function buildStackSocialDirectLink(deal, settings) {
  if (deal.source === "stacksocial" && settings.allow_stacksocial_direct_posting) {
    return deal.stacksocial_url || deal.url || "";
  }
  return "";
}

async function run() {
  console.log("🚀 Processing deals...");

  const settings = await loadSettings();
  console.log("⚙️ Loaded settings:", settings);

  let productHuntDeals = [];
  let stackSocialDeals = [];

  if (settings.enable_producthunt_source) {
    productHuntDeals = await fetchDynamicDeals().catch((error) => {
      console.error("❌ Product Hunt source failed:", error.message);
      return [];
    });
  } else {
    console.log("ℹ️ Product Hunt source disabled by feature flag");
  }

  if (settings.enable_stacksocial_source) {
    stackSocialDeals = await fetchStackSocialDeals({ maxDeals: 20 }).catch((error) => {
      console.error("❌ StackSocial source failed:", error.message);
      return [];
    });
  } else {
    console.log("ℹ️ StackSocial source disabled by feature flag");
  }

  console.log(`📥 Product Hunt deals: ${productHuntDeals.length}`);
  console.log(`📥 StackSocial deals: ${stackSocialDeals.length}`);

  const rawDeals = dedupeDeals([...stackSocialDeals, ...productHuntDeals]);

  const selectedForEnrichment = rawDeals
    .filter((d) => (d.score || 0) >= 4)
    .slice(0, MAX_SELECTED_DEALS);

  console.log(`📦 Selected ${selectedForEnrichment.length} deals for enrichment`);

  const enrichedDeals = [];

  for (const deal of selectedForEnrichment) {
    const enriched = await enrichProduct(deal);
    const improved = enhanceCopy(enriched);
    const aiContent = await generateDealContent(improved);

    const finalDeal = {
      ...improved,
      ...aiContent,
      affiliate_url: "",
      affiliate_detected: false,
      network_guess: "",
      affiliateLink: buildStackSocialDirectLink(improved, settings)
    };

    if (isPublishableForPhaseOne(finalDeal, settings)) {
      enrichedDeals.push(finalDeal);
    } else {
      console.log(`⏭️ Skipping low-quality or incomplete deal: ${finalDeal.name}`);
    }
  }

  console.log(`✅ Publishable deals after filtering: ${enrichedDeals.length}`);

  for (const deal of enrichedDeals) {
    const filePath = generateDealPage(deal, enrichedDeals);
    console.log("📝 Generated page:", filePath);
  }

  const homePath = generateHomePage();
  console.log("🏠 Generated homepage:", homePath);

  const dealsIndexPaths = generateDealsIndex(enrichedDeals);
  console.log("🗂️ Generated deals index pages:", dealsIndexPaths);

  const categoryPaths = generateCategoryPages(enrichedDeals);
  console.log("🧭 Generated category pages:", categoryPaths);

  const staticPaths = generateStaticPages();
  console.log("📄 Generated static pages:", staticPaths);

  generateRobotsTxt();
  console.log("🤖 Generated robots.txt");

  generateSitemap(enrichedDeals);
  console.log("🗺️ Generated sitemap");

  const sendCandidates = await ingestDeals(enrichedDeals, settings);
  saveJson(PENDING_PATH, sendCandidates);

  console.log(`📨 Pending Telegram deals: ${sendCandidates.length}`);
  console.log("🏁 Done");
}

run().catch((err) => {
  console.error("❌ processDeals fatal error:", err);
  process.exit(1);
});
