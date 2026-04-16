import fs from "fs";
import path from "path";
import {
  generateDealPage,
  generateDealsIndex,
  generateCategoryPages,
  generateRobotsTxt,
  generateSitemap
} from "./generateDealPage.js";
import { fetchDynamicDeals } from "./productSource.js";
import { enrichProduct } from "./enrichProduct.js";
import { enhanceCopy } from "./copywriter.js";

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
    .slice(0, 8);

  console.log(`📦 Selected ${selectedForEnrichment.length} deals for enrichment`);

  const enrichedDeals = [];
  for (const deal of selectedForEnrichment) {
    const enriched = await enrichProduct(deal);
    const improved = enhanceCopy(enriched);
    enrichedDeals.push(improved);
  }

  for (const deal of enrichedDeals) {
    const filePath = generateDealPage(deal, enrichedDeals);
    console.log("📝 Generated page:", filePath);
  }

  const indexPath = generateDealsIndex(enrichedDeals);
  console.log("🗂️ Generated deals index:", indexPath);

  const categoryPaths = generateCategoryPages(enrichedDeals);
  console.log("🧭 Generated category pages:", categoryPaths);

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
