const ADMIN_CHAT = process.env.TELEGRAM_ADMIN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_API_URL = "https://go.pochify.com/api/admin/opportunities";
const ADMIN_URL = "https://go.pochify.com/admin";

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

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error("Missing ADMIN_USERNAME or ADMIN_PASSWORD in workflow env");
  }

  const res = await fetch(ADMIN_API_URL, {
    headers: {
      Authorization: basicAuthHeader()
    }
  });

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to fetch opportunities: ${res.status} ${rawText}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Expected JSON but got: ${rawText}`);
  }

  const rows = data.items || [];

  if (rows.length === 0) {
    await sendTelegram(
      `📭 <b>Pochify Affiliate Digest</b>\n\nAdmin: <a href="${ADMIN_URL}">${ADMIN_URL}</a>\n\nNo new affiliate opportunities right now.`
    );
    return;
  }

  const body = rows
    .slice(0, 10)
    .map((r, i) => {
      const pageUrl = r.page_url || (r.deal_slug ? `https://pochify.com/deals/${r.deal_slug}.html` : "");
      const adminDeepLink = `${ADMIN_URL}/opportunities?brand_key=${encodeURIComponent(r.brand_key)}`;

      return (
        `${i + 1}. <b>${r.display_name}</b>\n` +
        `Brand key: <code>${r.brand_key}</code>\n` +
        `Network: ${r.network_guess || "unknown"}\n` +
        `Clicks: ${r.click_count || 0}\n` +
        `Status: ${r.status || "unknown"}\n` +
        `Affiliate page: ${r.affiliate_url || "n/a"}\n` +
        `${pageUrl ? `Pochify page: <a href="${pageUrl}">open</a>\n` : ""}` +
        `Admin opportunity: <a href="${adminDeepLink}">open</a>`
      );
    })
    .join("\n\n");

  const text =
    `📬 <b>Pochify Affiliate Digest</b>\n\n` +
    `Admin: <a href="${ADMIN_URL}">${ADMIN_URL}</a>\n\n` +
    `Top opportunities to review:\n\n${body}`;

  await sendTelegram(text);
}

run().catch((err) => {
  console.error("❌ sendAffiliateDigest fatal error:", err.message);
  process.exit(1);
});
