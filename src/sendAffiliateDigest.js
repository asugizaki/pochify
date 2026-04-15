const ADMIN_CHAT = process.env.TELEGRAM_ADMIN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_API_URL = "https://go.pochify.com/api/admin/opportunities";

function basicAuthHeader() {
  const raw = `${ADMIN_USERNAME}:${ADMIN_PASSWORD}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  const data = await res.json();

  if (!data.ok) {
    console.error("❌ Admin digest Telegram error:", data);
  }
}

async function run() {
  if (!ADMIN_CHAT) {
    console.log("ℹ️ TELEGRAM_ADMIN not set, skipping digest");
    return;
  }

  const res = await fetch(ADMIN_API_URL, {
    headers: {
      Authorization: basicAuthHeader()
    }
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Failed to fetch opportunities:", data);
    process.exit(1);
  }

  const rows = data.items || [];

  if (rows.length === 0) {
    await sendTelegram("📭 <b>Pochify Affiliate Digest</b>\n\nNo new affiliate opportunities right now.");
    return;
  }

  const body = rows
    .slice(0, 10)
    .map(
      (r, i) =>
        `${i + 1}. <b>${r.display_name}</b>\n` +
        `Brand key: <code>${r.brand_key}</code>\n` +
        `Guess: ${r.network_guess || "unknown"}\n` +
        `Clicks: ${r.click_count || 0}\n` +
        `Source: ${r.source_url || "n/a"}`
    )
    .join("\n\n");

  const text = `📬 <b>Pochify Affiliate Digest</b>\n\nTop opportunities to review:\n\n${body}`;

  await sendTelegram(text);
}

run().catch((err) => {
  console.error("❌ sendAffiliateDigest fatal error:", err);
  process.exit(1);
});
