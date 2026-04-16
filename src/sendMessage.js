const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = "https://pochify.com";

export async function sendMessage(chatId, deal) {
  if (!chatId) {
    console.error("❌ sendMessage called with empty chatId");
    return false;
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ Missing TELEGRAM_BOT_TOKEN");
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const pageUrl = `${SITE_URL}/deals/${deal.slug}.html`;
  const bullets = Array.isArray(deal.benefits) ? deal.benefits.slice(0, 2) : [];

  const line1 =
    bullets[0] || "Worth checking if this category is relevant to you";
  const line2 =
    bullets[1] || "We broke down who it looks best for";

  const intro = deal.hook || deal.description || "Worth a closer look.";
  const valueHook = deal.value_hook || "See why this may be useful.";

  const message = [
    `🔥 <b>${deal.name}</b>`,
    "",
    intro,
    "",
    `💰 <b>${valueHook}</b>`,
    "",
    "💡 <b>Why people may care:</b>",
    `• ${line1}`,
    `• ${line2}`,
    "",
    `👉 <a href="${pageUrl}">Read the full breakdown</a>`
  ].join("\n");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false
      })
    });

    const data = await res.json();

    if (!data.ok) {
      console.error("❌ Telegram FAILED:", data);
      return false;
    }

    console.log("📩 Telegram SENT:", deal.name);
    return true;
  } catch (err) {
    console.error("❌ sendMessage ERROR:", err);
    return false;
  }
}
