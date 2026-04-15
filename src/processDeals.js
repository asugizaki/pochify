import fs from "fs";
import path from "path";
import { generateDealPage, generateSitemap } from "./generateDealPage.js";

const BACKEND_URL = "https://go.pochify.com/api/deals";
const CACHE_PATH = path.join("data", "cache.json");
const PENDING_PATH = path.join("data", "pending-telegram.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function slugify(name = "") {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function detectChannel(deal) {
  const text = `${deal.name} ${deal.description || ""}`.toLowerCase();

  if (text.includes("ai")) return "ai";
  if (text.includes("saas")) return "saas";
  return "general";
}

// Replace this with your real sourcing pipeline later
function getDeals() {
  return [
    {
      name: "Notion AI",
      description: "AI writing assistant inside Notion",
      url: "https://www.notion.so/product/ai",
      affiliateLink: null,
      audience: "Founders, students, operators, and knowledge workers",
      benefits: [
        "Speeds up writing and summarization",
        "Fits naturally into existing Notion workflows",
        "Useful for notes, docs, and knowledge management"
      ],
      whyNow:
        "If you already use Notion, this is one of the easiest ways to add AI into work you are already doing."
    },
    {
      name: "Jasper AI",
      description: "AI content generation tool for marketing teams",
      url: "https://www.jasper.ai",
      affiliateLink: null,
      audience: "Marketing teams, freelancers, and content-heavy businesses",
      benefits: [
        "Can speed up campaign copy production",
        "Helps generate first drafts quickly",
        "Popular with teams testing AI writing workflows"
      ],
      whyNow:
        "This is the kind of tool people often test when they want faster content output without building a full internal system."
    }
  ];
}

async function syncDealsToBackend(deals) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(deals)
  });

  const data = await res.json();
  console.log("📡 Backend response:", data);

  if (!res.ok || !data.success) {
    throw new Error("Failed to save deals to backend");
  }
}

async function run() {
  console.log("🚀 Processing deals...");

  const cache = loadJson(CACHE_PATH, { sentSlugs: [] });
  const rawDeals = getDeals();

  const deals = rawDeals.map((d) => ({
    name: d.name,
    slug: slugify(d.name),
    description: d.description || "",
    url: d.url || "",
    affiliateLink: d.affiliateLink || null,
    audience: d.audience || "",
    benefits: d.benefits || [],
    whyNow: d.whyNow || "",
    channel: detectChannel(d)
  }));

  console.log(`📦 Built ${deals.length} deals`);

  for (const deal of deals) {
    const filePath = generateDealPage(deal);
    console.log("📝 Generated page:", filePath);
  }

  generateSitemap(deals);
  console.log("🗺️ Generated sitemap");

  await syncDealsToBackend(deals);

  const pending = deals.filter((deal) => !cache.sentSlugs.includes(deal.slug));
  saveJson(PENDING_PATH, pending);

  console.log(`📨 Pending Telegram deals: ${pending.length}`);
  console.log("🏁 Done");
}

run().catch((err) => {
  console.error("❌ processDeals fatal error:", err);
  process.exit(1);
});
