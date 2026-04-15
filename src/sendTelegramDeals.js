import fs from "fs";
import path from "path";
import { sendMessage } from "./sendMessage.js";

const PENDING_PATH = path.join("data", "pending-telegram.json");
const MARK_POSTED_URL = "https://go.pochify.com/api/deals/mark-posted";

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

async function markPosted(slugs) {
  const res = await fetch(MARK_POSTED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ slugs })
  });

  const data = await res.json();
  console.log("📝 Mark posted response:", data);
}

async function run() {
  console.log("🚀 Sending Telegram deals...");

  const pending = loadJson(PENDING_PATH, []);
  console.log(`📨 Loaded pending deals: ${pending.length}`);

  const successfulSlugs = [];

  for (const deal of pending) {
    const chatId = getChatId(deal.channel);

    console.log("➡️ Routing:", deal.name, "→", deal.channel);

    if (!chatId) {
      console.log("❌ Missing chatId for:", deal.name);
      continue;
    }

    const sent = await sendMessage(chatId, deal);

    if (sent) {
      successfulSlugs.push(deal.slug);
      console.log("✅ Sent:", deal.name);
    } else {
      console.log("❌ Failed:", deal.name);
    }

    await sleep(1500);
  }

  if (successfulSlugs.length > 0) {
    await markPosted(successfulSlugs);
  }

  saveJson(PENDING_PATH, []);
  console.log("🏁 Telegram send complete");
}

run().catch((err) => {
  console.error("❌ sendTelegramDeals fatal error:", err);
  process.exit(1);
});
