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
import { enrichProduct } from "./enrichProduct.js";
import { enhanceCopy } from "./copywriter.js";
import { discoverAffiliateInfo } from "./affiliateDiscovery.js";

const BACKEND_URL = "https://go.pochify.com/api/deals/ingest";
const PENDING_PATH = path.join("data", "pending-telegram.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function saveJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function ingestDeals(deals) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deals,
      maxToSend: 2
    })
  });

  const data = await res.json();
  console.log("📡 Backend response:", data);

  if (!res.ok || !data.success) {
    throw new Error("Failed to ingest deals to backend");
  }

  return data.sendCandidates || [];
}

async function run() {
  console.log("🚀 Processing deals...");

  const rawDeals = await fetchDynamicDeals();

  const selectedForEnrichment = rawDeals
    .filter((d) => d.score >= 4)
    .slice(0, 24);

  console.log(`📦 Selected ${selectedForEnrichment.length} deals for enrichment`);

  const enrichedDeals = [];
  for (const deal of selectedForEnrichment) {
    const enriched = await enrichProduct(deal);
    const improved = enhanceCopy(enriched);
    const affiliateInfo = await discoverAffiliateInfo(improved.url);

    enrichedDeals.push({
      ...improved,
      affiliate_url: affiliateInfo.affiliate_url,
      affiliate_detected: affiliateInfo.affiliate_detected,
      network_guess: affiliateInfo.network_guess
    });
  }

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

  const sendCandidates = await ingestDeals(enrichedDeals);
  saveJson(PENDING_PATH, sendCandidates);

  console.log(`📨 Pending Telegram deals: ${sendCandidates.length}`);
  console.log("🏁 Done");
}

run().catch((err) => {
  console.error("❌ processDeals fatal error:", err);
  process.exit(1);
});
