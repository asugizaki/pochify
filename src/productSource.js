const PRODUCT_HUNT_API = "https://api.producthunt.com/v2/api/graphql";

function slugify(name = "") {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeBrandKey(name = "") {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function detectChannel(name = "", description = "", topics = []) {
  const text = `${name} ${description} ${topics.join(" ")}`.toLowerCase();

  if (text.includes("ai") || text.includes("artificial intelligence")) return "ai";
  if (text.includes("saas") || text.includes("software") || text.includes("productivity")) return "saas";
  return "general";
}

function scoreDeal(deal) {
  let score = 0;
  const text = `${deal.name} ${deal.description}`.toLowerCase();

  if (deal.votes_count >= 50) score += 2;
  if (deal.votes_count >= 150) score += 2;
  if (deal.votes_count >= 300) score += 2;

  if (text.includes("ai")) score += 2;
  if (text.includes("automation")) score += 1;
  if (text.includes("productivity")) score += 1;
  if (deal.description.length >= 40) score += 1;

  return score;
}

export async function fetchDynamicDeals() {
  const token = process.env.PRODUCTHUNT_TOKEN;

  if (!token) {
    throw new Error("Missing PRODUCTHUNT_TOKEN");
  }

  const query = `
    query GetPosts($first: Int!) {
      posts(first: $first) {
        edges {
          node {
            id
            name
            tagline
            url
            website
            votesCount
            createdAt
            topics(first: 5) {
              edges {
                node {
                  name
                  slug
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(PRODUCT_HUNT_API, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      query,
      variables: { first: 18 }
    })
  });

  const data = await res.json();

  if (!res.ok || data.errors) {
    console.error("❌ Product Hunt API error:", JSON.stringify(data, null, 2));
    throw new Error("Failed to fetch Product Hunt deals");
  }

  const edges = data?.data?.posts?.edges || [];

  const deals = edges
    .map(({ node }) => {
      const topics = (node.topics?.edges || [])
        .map((e) => e.node?.name)
        .filter(Boolean);

      const deal = {
        name: node.name,
        slug: slugify(node.name),
        brand_key: normalizeBrandKey(node.name),
        description: node.tagline || "",
        url: node.website || node.url,
        affiliateLink: null,
        page_url: `https://pochify.com/deals/${slugify(node.name)}.html`,
        source: "producthunt",
        channel: detectChannel(node.name, node.tagline || "", topics),
        votes_count: node.votesCount || 0,
        audience: "Founders, builders, creators, and early adopters",
        benefits: [
          "Useful if this category is relevant to your workflow",
          "Worth reviewing before the space gets crowded",
          "Good early-adoption candidate if it fits your stack"
        ],
        whyNow:
          "This is currently trending on Product Hunt and is worth a closer look if this category matters to you."
      };

      deal.score = scoreDeal(deal);
      return deal;
    })
    .filter((d) => !!d.url)
    .sort((a, b) => b.score - a.score);

  return deals;
}
