function guessNetworkFromText(text = "") {
  const normalized = text.toLowerCase();

  if (normalized.includes("partnerstack")) return "partnerstack";
  if (normalized.includes("impact.com") || normalized.includes("impact radius") || normalized.includes("impact")) return "impact";
  if (normalized.includes("commission junction") || normalized.includes("cj affiliate") || normalized.includes("cj.com")) return "cj";
  if (normalized.includes("rewardful")) return "rewardful";
  if (normalized.includes("firstpromoter")) return "firstpromoter";
  if (normalized.includes("tolt")) return "tolt";
  return "unknown";
}

function absoluteUrl(baseUrl, maybeRelative) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractAffiliateLinksFromHtml(baseUrl, html = "") {
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis)];
  const candidates = [];

  for (const match of matches) {
    const href = match[1] || "";
    const label = (match[2] || "").replace(/<[^>]+>/g, " ").trim().toLowerCase();
    const normalizedHref = href.toLowerCase();

    const looksRelevant =
      normalizedHref.includes("affiliate") ||
      normalizedHref.includes("referral") ||
      normalizedHref.includes("partner") ||
      normalizedHref.includes("ambassador") ||
      label.includes("affiliate") ||
      label.includes("referral") ||
      label.includes("partner");

    if (looksRelevant) {
      const url = absoluteUrl(baseUrl, href);
      if (url) candidates.push(url);
    }
  }

  return [...new Set(candidates)];
}

async function tryFetch(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PochifyBot/1.0)"
      }
    });

    if (!res.ok) return null;

    const text = await res.text();
    return {
      url: res.url || url,
      html: text
    };
  } catch {
    return null;
  }
}

export async function discoverAffiliateInfo(productUrl) {
  if (!productUrl) {
    return {
      affiliate_url: "",
      affiliate_detected: false,
      network_guess: "unknown"
    };
  }

  let origin;
  try {
    origin = new URL(productUrl).origin;
  } catch {
    return {
      affiliate_url: "",
      affiliate_detected: false,
      network_guess: "unknown"
    };
  }

  const commonPaths = [
    "/affiliate",
    "/affiliates",
    "/affiliate-program",
    "/affiliate-programs",
    "/referral",
    "/referrals",
    "/partner",
    "/partners",
    "/partner-program",
    "/partner-programs",
    "/ambassador"
  ];

  for (const path of commonPaths) {
    const candidateUrl = `${origin}${path}`;
    const result = await tryFetch(candidateUrl);

    if (result) {
      const network_guess = guessNetworkFromText(result.html + " " + result.url);
      return {
        affiliate_url: result.url,
        affiliate_detected: true,
        network_guess
      };
    }
  }

  const home = await tryFetch(productUrl);
  if (!home) {
    return {
      affiliate_url: "",
      affiliate_detected: false,
      network_guess: "unknown"
    };
  }

  const candidates = extractAffiliateLinksFromHtml(home.url, home.html);

  for (const candidate of candidates) {
    const result = await tryFetch(candidate);
    if (result) {
      const network_guess = guessNetworkFromText(result.html + " " + result.url);
      return {
        affiliate_url: result.url,
        affiliate_detected: true,
        network_guess
      };
    }
  }

  return {
    affiliate_url: "",
    affiliate_detected: false,
    network_guess: guessNetworkFromText(home.html)
  };
}
