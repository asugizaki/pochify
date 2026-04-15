function getMatch(html, regex) {
  const match = html.match(regex);
  return match?.[1]?.trim() || "";
}

function normalizeWhitespace(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text = "") {
  return text
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&nbsp;/gi, " ");
}

function cleanText(text = "") {
  return normalizeWhitespace(decodeHtmlEntities(text));
}

function extractTitle(html = "") {
  return cleanText(getMatch(html, /<title[^>]*>(.*?)<\/title>/is));
}

function extractMetaDescription(html = "") {
  return cleanText(
    getMatch(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"]*?)["'][^>]*>/i
    ) ||
      getMatch(
        html,
        /<meta[^>]+content=["']([^"]*?)["'][^>]+name=["']description["'][^>]*>/i
      ) ||
      getMatch(
        html,
        /<meta[^>]+name=['"]description['"][^>]+content=['"]([^']*?)['"][^>]*>/i
      ) ||
      getMatch(
        html,
        /<meta[^>]+content=['"]([^']*?)['"][^>]+name=['"]description['"][^>]*>/i
      )
  );
}

function extractOgImage(html = "") {
  return cleanText(
    getMatch(
      html,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"]*?)["'][^>]*>/i
    ) ||
      getMatch(
        html,
        /<meta[^>]+content=["']([^"]*?)["'][^>]+property=["']og:image["'][^>]*>/i
      ) ||
      getMatch(
        html,
        /<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^']*?)['"][^>]*>/i
      ) ||
      getMatch(
        html,
        /<meta[^>]+content=['"]([^']*?)['"][^>]+property=['"]og:image['"][^>]*>/i
      )
  );
}

function extractOgDescription(html = "") {
  return cleanText(
    getMatch(
      html,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"]*?)["'][^>]*>/i
    ) ||
      getMatch(
        html,
        /<meta[^>]+content=["']([^"]*?)["'][^>]+property=["']og:description["'][^>]*>/i
      ) ||
      getMatch(
        html,
        /<meta[^>]+property=['"]og:description['"][^>]+content=['"]([^']*?)['"][^>]*>/i
      ) ||
      getMatch(
        html,
        /<meta[^>]+content=['"]([^']*?)['"][^>]+property=['"]og:description['"][^>]*>/i
      )
  );
}

export async function enrichProduct(deal) {
  try {
    const res = await fetch(deal.url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PochifyBot/1.0)"
      }
    });

    const html = await res.text();

    const meta_title = extractTitle(html);
    const meta_description = extractMetaDescription(html) || extractOgDescription(html);
    const og_image = extractOgImage(html);

    return {
      ...deal,
      meta_title,
      meta_description,
      og_image
    };
  } catch (err) {
    console.log("⚠️ Enrichment failed for:", deal.name, err.message);
    return {
      ...deal,
      meta_title: "",
      meta_description: "",
      og_image: ""
    };
  }
}
