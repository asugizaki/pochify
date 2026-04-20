import fs from "fs";
import path from "path";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_AI = process.env.TELEGRAM_AI;
const TELEGRAM_SAAS = process.env.TELEGRAM_SAAS;
const TELEGRAM_GENERAL = process.env.TELEGRAM_GENERAL;

const BASE_URL = "https://go.pochify.com";
const PENDING_PATH = path.join("data", "pending-telegram.json");

function loadPendingDeals() {
  if (!fs.existsSync(PENDING_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(PENDING_PATH, "utf8"));
  } catch (error) {
    console.error("❌ Failed to read pending telegram file:", error.message);
    return [];
  }
}

function savePendingDeals(deals) {
  fs.mkdirSync(path.dirname(PENDING_PATH), { recursive: true });
  fs.writeFileSync(PENDING_PATH, JSON.stringify(deals, null, 2), "utf8");
}

function getChatId(channel) {
  if (channel === "ai") return TELEGRAM_AI;
  if (channel === "saas") return TELEGRAM_SAAS;
  return TELEGRAM_GENERAL;
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `$${num.toFixed(2)}`;
}

function buildMessage(deal) {
  const lines = [];

  lines.push(`🔥 <b>${escapeHtml(deal.name || "Deal")}</b>`);

  const pricing = [];
  if (deal.current_price) pricing.push(`Now: <b>${escapeHtml(formatPrice(deal.current_price))}</b>`);
  if (deal.original_price) pricing.push(`Was: <s>${escapeHtml(formatPrice(deal.original_price))}</s>`);
  if (deal.discount_percent) pricing.push(`<b>${escapeHtml(String(deal.discount_percent))}% off</b>`);
  if (deal.offer_type === "lifetime") pricing.push(`✅ Lifetime deal`);

  if (pricing.length) {
    lines.push(pricing.join(" • "));
  }

  if (deal.hook) {
    lines.push("");
    lines.push(escapeHtml(deal.hook));
  }

  lines.push("");
  lines.push(`👉 <a href="${escapeHtml(deal.page_url)}">Read full breakdown</a>`);

  return lines.join("\n");
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  if (!chatId) {
    throw new Error("Missing Telegram chat id");
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false
    })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    console.error("❌ Telegram FAILED:", data || { status: res.status });
    throw new Error(data?.description || `Telegram HTTP ${res.status}`);
  }

  return data;
}

async function markPosted(slugs) {
  if (!slugs.length) return;

  const res = await fetch(`${BASE_URL}/api/deals/mark-posted`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ slugs })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`mark-posted failed: ${res.status} ${JSON.stringify(data)}`);
  }

  console.log("✅ mark-posted response:", data);
}

async function run() {
  console.log("🚀 Sending Telegram deals...");

  const pendingDeals = loadPendingDeals();
  console.log(`📨 Loaded pending deals: ${pendingDeals.length}`);

  if (!pendingDeals.length) {
    console.log("ℹ️ No pending deals to send");
    return;
  }

  const postedSlugs = [];
  const remainingDeals = [];

  for (const deal of pendingDeals) {
    const chatId = getChatId(deal.channel);
    console.log(`➡️ Routing: ${deal.name} → ${deal.channel || "general"}`);

    try {
      const message = buildMessage(deal);
      await sendTelegramMessage(chatId, message);
      console.log(`✅ Sent: ${deal.name}`);
      postedSlugs.push(deal.slug);
    } catch (error) {
      console.error(`❌ Failed: ${deal.name} | ${error.message}`);
      remainingDeals.push(deal);
    }
  }

  savePendingDeals(remainingDeals);
  console.log(`💾 Remaining pending deals saved: ${remainingDeals.length}`);

  if (postedSlugs.length) {
    await markPosted(postedSlugs);
    console.log("✅ Marked posted slugs:", postedSlugs);
  }

  console.log("🏁 Telegram send complete");
}

run().catch((error) => {
  console.error("❌ sendTelegramDeals fatal error:", error);
  process.exit(1);
});
