const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN = process.env.TELEGRAM_ADMIN || "";

export async function alertAdmin(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN) {
    console.warn("⚠️ Admin alert skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN missing");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: TELEGRAM_ADMIN,
      text: message,
      disable_web_page_preview: true
    })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    console.error("❌ Failed to send admin alert:", data || res.status);
  }
}
