function cleanJsonFence(text = "") {
  return String(text)
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJson(text = "") {
  try {
    return JSON.parse(cleanJsonFence(text));
  } catch {
    return null;
  }
}

function normalizeArray(value, max = 5) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeFaq(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      q: String(item?.q || "").trim(),
      a: String(item?.a || "").trim()
    }))
    .filter((item) => item.q && item.a)
    .slice(0, 4);
}

function fallbackContent(deal) {
  return {
    description:
      deal.description ||
      `${deal.name} is a software deal worth checking if this category fits your workflow.`,
    hook:
      `${deal.name} looks worth a closer look, especially if you care about value, workflow improvement, or early-access software opportunities.`,
    audience:
      deal.channel === "ai"
        ? "Creators, founders, marketers, and professionals using AI in their workflow"
        : "Founders, teams, and professionals looking for useful SaaS tools",
    benefits: [
      "Can help reduce manual work in the right workflow",
      "May offer strong value relative to the listed retail price",
      "Worth testing if the current deal matches your needs"
    ],
    why_now:
      deal.discount_percent
        ? `The current deal stands out because it is listed at roughly ${deal.discount_percent}% off, which makes it easier to try with less upfront risk.`
        : "The current offer may be worth checking now if this category is already on your shortlist.",
    caution:
      "Make sure the actual features, limits, and platform support match your workflow before buying.",
    value_hook:
      deal.offer_type === "lifetime"
        ? "A lifetime-style deal can be compelling if you expect to use the tool for a long time and want to avoid recurring subscription costs."
        : "The value here mainly comes from getting access at a lower price than the usual listed rate.",
    meta_title: `${deal.name} Review, Pricing, and Deal Breakdown | Pochify`,
    meta_description:
      deal.description?.slice(0, 155) ||
      `${deal.name} pricing, features, and whether this software deal is worth it.`,
    overview_paragraphs: [
      `${deal.name} is a ${deal.channel === "ai" ? "AI-focused" : "software"} product currently available through a discounted offer.`,
      "This page breaks down what it does, who it looks best for, and why the current pricing may matter."
    ],
    use_cases: [
      "Evaluating whether the tool can save time in your workflow",
      "Comparing the current discount against the normal listed price",
      "Deciding whether the tool is relevant enough to test now"
    ],
    feature_highlights: [
      "Discounted entry point",
      "Software workflow improvement potential",
      "Good candidate for further evaluation"
    ],
    deal_summary:
      deal.discount_percent && deal.current_price
        ? `The listed offer is around ${deal.discount_percent}% off, with a visible price near $${deal.current_price}.`
        : "The current page presents the product as a discounted software offer worth evaluating.",
    faq: [
      {
        q: `Who is ${deal.name} best for?`,
        a: "It looks best for users already interested in this category and evaluating whether the product fits an active workflow."
      },
      {
        q: "What should I verify before buying?",
        a: "Check platform support, usage limits, renewal terms, and whether the current feature set actually matches your needs."
      }
    ]
  };
}

export async function generateDealContent(deal) {
  console.log(
    `🤖 OpenAI content generation for ${deal.name}:`,
    process.env.OPENAI_API_KEY ? "ENABLED" : "DISABLED"
  );
  
  if (!process.env.OPENAI_API_KEY) {
    return fallbackContent(deal);
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const prompt = `
You are helping create original SEO-friendly landing page content for a software affiliate/discovery site.

Write concise, useful, non-hype content in plain English.
Do not copy wording from the source description.
Do not mention SEO.
Do not claim hands-on testing.
Avoid fake urgency.
Avoid unverifiable superlatives.
Keep facts grounded in the source data.

Return ONLY valid JSON with this exact shape:
{
  "description": string,
  "hook": string,
  "audience": string,
  "benefits": string[],
  "why_now": string,
  "caution": string,
  "value_hook": string,
  "meta_title": string,
  "meta_description": string,
  "overview_paragraphs": string[],
  "use_cases": string[],
  "feature_highlights": string[],
  "deal_summary": string,
  "faq": [{"q": string, "a": string}]
}

Rules:
- description: 1-2 sentences, original, clear, helpful
- hook: 1 sentence
- audience: 1 sentence
- benefits: 3 to 5 bullets
- why_now: 1-2 sentences
- caution: 1 sentence
- value_hook: 1-2 sentences
- meta_title: under 65 chars
- meta_description: under 160 chars
- overview_paragraphs: 2 or 3 short paragraphs
- use_cases: 3 to 5 items
- feature_highlights: 3 to 5 items
- deal_summary: 1-2 sentences focused on the offer
- faq: exactly 3 items

Source data:
${JSON.stringify(
  {
    name: deal.name,
    description: deal.description,
    channel: deal.channel,
    discount_percent: deal.discount_percent,
    current_price: deal.current_price,
    original_price: deal.original_price,
    offer_type: deal.offer_type,
    source: deal.source,
    source_url: deal.source_detail || deal.stacksocial_url || deal.url,
    vendor_url: deal.vendor_url || "",
    raw_anchor_text: deal.raw_anchor_text || ""
  },
  null,
  2
)}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You generate original, useful, non-duplicative software deal content and always return valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = parseJson(content);

    if (!parsed) {
      throw new Error("Model did not return valid JSON");
    }

    return {
      description: String(parsed.description || "").trim(),
      hook: String(parsed.hook || "").trim(),
      audience: String(parsed.audience || "").trim(),
      benefits: normalizeArray(parsed.benefits, 5),
      why_now: String(parsed.why_now || "").trim(),
      caution: String(parsed.caution || "").trim(),
      value_hook: String(parsed.value_hook || "").trim(),
      meta_title: String(parsed.meta_title || "").trim(),
      meta_description: String(parsed.meta_description || "").trim(),
      overview_paragraphs: normalizeArray(parsed.overview_paragraphs, 3),
      use_cases: normalizeArray(parsed.use_cases, 5),
      feature_highlights: normalizeArray(parsed.feature_highlights, 5),
      deal_summary: String(parsed.deal_summary || "").trim(),
      faq: normalizeFaq(parsed.faq)
    };
  } catch (error) {
    console.error(`❌ OpenAI generation failed for ${deal.name}:`, error.message);
    return fallbackContent(deal);
  }
}
