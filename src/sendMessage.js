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

  const message = `
    🔥 <b>${deal.name}</b>
    
    ${deal.hook}
    
    💰 <b>${deal.value_hook}</b>
    
    👉 <a href="${pageUrl}">See full breakdown</a>
    `.trim();

👉 <a href="${pageUrl}">Read the full breakdown</a>
`.trim();

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
