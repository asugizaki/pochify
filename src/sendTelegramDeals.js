import fs from "fs";
import path from "path";
import { sendMessage } from "./sendMessage.js";

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

function getChatId(channel) {
  if (channel === "ai") return process.env.TELEGRAM_AI;
  if (channel === "saas") return process.env.TELEGRAM_SAAS;
  return process.env.TELEGRAM_GENERAL;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("🚀 Sending Telegram deals...");

  const cache = loadJson(CACHE_PATH, { sentSlugs: [] });
  const pending = loadJson(PENDING_PATH, []);

  console.log(`📨 Loaded pending deals: ${pending.length}`);

  for (const deal of pending) {
    const chatId = getChatId(deal.channel);

    console.log("➡️ Routing:", deal.name, "→", deal.channel);

    if (!chatId) {
      console.log("❌ Missing chatId for:", deal.name);
      continue;
    }

    const sent = await sendMessage(chatId, deal);

    if (sent) {
      cache.sentSlugs.push(deal.slug);
      console.log("✅ Sent:", deal.name);
    } else {
      console.log("❌ Failed:", deal.name);
    }

    await sleep(1200);
  }

  saveJson(CACHE_PATH, {
    sentSlugs: [...new Set(cache.sentSlugs)]
  });

  saveJson(PENDING_PATH, []);
  console.log("🏁 Telegram send complete");
}

run().catch((err) => {
  console.error("❌ sendTelegramDeals fatal error:", err);
  process.exit(1);
});
