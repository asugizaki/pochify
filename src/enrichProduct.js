function getMatch(html, regex) {
  const match = html.match(regex);
  return match?.[1]?.trim() || "";
}

function normalizeWhitespace(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function extractTitle(html = "") {
  return normalizeWhitespace(getMatch(html, /<title[^>]*>(.*?)<\/title>/is));
}

function extractMetaDescription(html = "") {
  return normalizeWhitespace(
    getMatch(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i
    ) ||
      getMatch(
        html,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i
      )
  );
}

function extractOgImage(html = "") {
  return normalizeWhitespace(
    getMatch(
      html,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i
    ) ||
      getMatch(
        html,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i
      )
  );
}

function extractOgDescription(html = "") {
  return normalizeWhitespace(
    getMatch(
      html,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i
    ) ||
      getMatch(
        html,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i
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
