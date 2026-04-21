export const USER_AGENT =
  "Mozilla/5.0 (compatible; PochifyBot/1.0; +https://pochify.com)";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function cleanText(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

export function safeUrl(input) {
  try {
    return new URL(input).toString();
  } catch {
    return "";
  }
}

export function absoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

export function parseMoneyString(text = "") {
  const normalized = String(text).replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

export function computeDiscountPercent(currentPrice, originalPrice) {
  if (!currentPrice || !originalPrice || originalPrice <= currentPrice) return null;
  const percent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  if (percent < 0 || percent > 100) return null;
  return percent;
}

export function detectChannel(text = "") {
  const value = text.toLowerCase();

  if (
    value.includes("ai") ||
    value.includes("artificial intelligence") ||
    value.includes("chatgpt") ||
    value.includes("llm") ||
    value.includes("image") ||
    value.includes("video") ||
    value.includes("voice") ||
    value.includes("speech") ||
    value.includes("transcription") ||
    value.includes("prompt")
  ) {
    return "ai";
  }

  return "saas";
}

export function scoreDeal({
  name,
  description,
  discountPercent,
  reviewCount,
  sourceUrl,
  lifetimeScoreBonus = 0,
  enableScoringDebug = false
}) {
  let score = 0;
  const reasons = [];
  const text = `${name} ${description} ${sourceUrl}`.toLowerCase();

  if (discountPercent && discountPercent >= 70) {
    score += 3;
    reasons.push("discount>=70:+3");
  } else if (discountPercent && discountPercent >= 40) {
    score += 2;
    reasons.push("discount>=40:+2");
  } else if (discountPercent && discountPercent >= 20) {
    score += 1;
    reasons.push("discount>=20:+1");
  }

  if (reviewCount >= 100) {
    score += 3;
    reasons.push("reviews>=100:+3");
  } else if (reviewCount >= 20) {
    score += 2;
    reasons.push("reviews>=20:+2");
  } else if (reviewCount >= 5) {
    score += 1;
    reasons.push("reviews>=5:+1");
  }

  if (
    text.includes("lifetime") ||
    text.includes("lifetime subscription") ||
    text.includes("lifetime license") ||
    text.includes("/lifetime")
  ) {
    score += Number(lifetimeScoreBonus || 0);
    reasons.push(`lifetime:+${Number(lifetimeScoreBonus || 0)}`);
  }

  if (
    text.includes("ai") ||
    text.includes("chatgpt") ||
    text.includes("automation") ||
    text.includes("writing") ||
    text.includes("video") ||
    text.includes("image") ||
    text.includes("voice") ||
    text.includes("speech") ||
    text.includes("transcription") ||
    text.includes("text-to-speech")
  ) {
    score += 2;
    reasons.push("ai_relevance:+2");
  }

  if (text.includes("bundle") || text.includes("course")) {
    score -= 2;
    reasons.push("bundle_or_course:-2");
  }

  const finalScore = Math.max(1, Math.min(10, score));

  if (enableScoringDebug) {
    console.log("📊 Source scoring debug:", {
      name,
      discountPercent,
      reviewCount,
      reasons,
      rawScore: score,
      finalScore
    });
  }

  return finalScore;
}

export async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT }
  });

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${url}`);
  }

  return await res.text();
}
