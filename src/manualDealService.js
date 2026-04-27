import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import { generateDealPage } from "./generateDealPage.js";


const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function cleanText(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function discountPercent(current, original) {
  if (!current || !original || original <= current) return null;
  return Math.round(((original - current) / original) * 100);
}

async function fetchMetadata(url) {
  if (!url) return {};

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PochifyBot/1.0; +https://pochify.com)"
      }
    });

    if (!res.ok) return {};

    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      cleanText($('meta[property="og:title"]').attr("content")) ||
      cleanText($("title").first().text());

    const description =
      cleanText($('meta[property="og:description"]').attr("content")) ||
      cleanText($('meta[name="description"]').attr("content"));

    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $("img").first().attr("src") ||
      "";

    return { title, description, image };
  } catch {
    return {};
  }
}

async function generateAiContent({ name, description, category }) {
  if (!OPENAI_API_KEY) {
    return {
      description,
      hook: description,
      audience: "",
      benefits: []
    };
  }

  const prompt = `
Create concise original SEO-safe content for a software deal page.

Product: ${name}
Category: ${category || "software"}
Base description: ${description || ""}

Return valid JSON only:
{
  "description": "1-2 sentence product summary",
  "hook": "short click-worthy one sentence hook",
  "audience": "who this is best for",
  "benefits": ["benefit 1", "benefit 2", "benefit 3"],
  "meta_title": "SEO title under 60 chars",
  "meta_description": "SEO meta description under 155 chars"
}
`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0.4
      })
    });

    const data = await res.json();
    const text = data.output_text || "";
    const json = JSON.parse(text);

    return {
      description: json.description || description,
      hook: json.hook || "",
      audience: json.audience || "",
      benefits: Array.isArray(json.benefits) ? json.benefits : [],
      meta_title: json.meta_title || `${name} Deal | Pochify`,
      meta_description: json.meta_description || description
    };
  } catch (error) {
    console.warn("⚠️ OpenAI manual deal content failed:", error.message);
    return {
      description,
      hook: description,
      audience: "",
      benefits: [],
      meta_title: `${name} Deal | Pochify`,
      meta_description: description
    };
  }
}

export async function createManualDeal(input) {
  const affiliateUrl = cleanText(input.affiliate_url || input.vendor_url || input.url);
  const metadata = await fetchMetadata(affiliateUrl);

  const name = cleanText(input.name || metadata.title);
  if (!name) throw new Error("Name is required");
  if (!affiliateUrl) throw new Error("Affiliate URL is required");

  const currentPrice = parseMoney(input.current_price);
  const originalPrice = parseMoney(input.original_price);
  const discount = input.discount_percent
    ? Number(input.discount_percent)
    : discountPercent(currentPrice, originalPrice);

  const baseDescription = cleanText(input.description || metadata.description || "");
  const category = cleanText(input.category || "ai");
  const slug = slugify(input.slug || name);

  const aiContent = input.use_ai === false
    ? {
        description: baseDescription,
        hook: baseDescription,
        audience: "",
        benefits: [],
        meta_title: `${name} Deal | Pochify`,
        meta_description: baseDescription
      }
    : await generateAiContent({
        name,
        description: baseDescription,
        category
      });

  const image = cleanText(input.image_url || input.og_image || metadata.image || "");

  const deal = {
    name,
    slug,
    description: aiContent.description || baseDescription,
    hook: aiContent.hook || "",
    audience: aiContent.audience || "",
    benefits: aiContent.benefits || [],

    vendor_url: affiliateUrl,
    affiliateLink: affiliateUrl,
    affiliate_url: affiliateUrl,
    source_deal_url: affiliateUrl,

    source: "manual",
    source_key: "manual",
    source_name: input.source_name || "Direct Partner",
    source_logo_path: input.source_logo_path || "",
    affiliate_network: input.affiliate_network || "direct",
    is_manual: true,

    channel: category,
    current_price: currentPrice,
    original_price: originalPrice,
    discount_percent: discount,
    offer_type: input.offer_type || "discount",

    og_image: image,
    card_image: image,

    score: Number(input.score || 7),
    quality_score: Number(input.score || 7),
    has_required_assets: Boolean(image),
    is_publishable: true,
    needs_regeneration: false,
    status: "ready_to_post",

    meta_title: aiContent.meta_title || `${name} Deal | Pochify`,
    meta_description: aiContent.meta_description || aiContent.description || baseDescription,

    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("deals")
    .upsert(deal, { onConflict: "slug" });

  if (error) throw error;

  generateDealPage(deal);

  return deal;
}
