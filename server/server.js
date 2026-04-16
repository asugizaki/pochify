import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Simple CORS for frontend reads
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://pochify.com");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase environment variables");
  process.exit(1);
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REPOST_DAYS = 7;
const MAX_POST_COUNT = 3;
const MIN_REPOST_CLICKS = 10;

function daysSince(dateString) {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const then = new Date(dateString).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

function guessNetwork(name = "", description = "") {
  const text = `${name} ${description}`.toLowerCase();

  if (text.includes("design") || text.includes("ecommerce")) return "cj";
  if (text.includes("b2b") || text.includes("saas") || text.includes("software")) return "impact";
  return "unknown";
}

function isEligibleToSend(deal) {
  if (!deal.last_posted_at) return true;

  const enoughDays = daysSince(deal.last_posted_at) >= REPOST_DAYS;
  const enoughClicks = (deal.click_count || 0) >= MIN_REPOST_CLICKS;
  const notOverPosted = (deal.post_count || 0) < MAX_POST_COUNT;

  return enoughDays && enoughClicks && notOverPosted;
}

function resolveTargetUrl(deal, program) {
  if (program?.deeplink_supported && program?.deeplink_template && deal.url) {
    return program.deeplink_template.replace("{{url}}", encodeURIComponent(deal.url));
  }

  if (program?.tracking_url) return program.tracking_url;
  if (deal.affiliate_link) return deal.affiliate_link;
  return deal.url;
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Pochify Admin"');
    return res.status(401).send("Authentication required");
  }

  const encoded = header.split(" ")[1];
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const [username, password] = decoded.split(":");

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="Pochify Admin"');
    return res.status(401).send("Invalid credentials");
  }

  next();
}

app.get("/", (req, res) => {
  res.send("Pochify backend running 🚀");
});

app.get("/api/public/latest-deals", async (req, res) => {
  const { data, error } = await supabase
    .from("deals")
    .select(`
      name,
      slug,
      description,
      hook,
      audience,
      why_now,
      caution,
      benefits,
      og_image,
      page_url,
      click_count,
      votes_count,
      score,
      created_at
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("❌ latest deals error:", error);
    return res.status(500).json({ error: "Failed to load latest deals" });
  }

  res.json({ items: data || [] });
});

app.post("/api/deals/ingest", async (req, res) => {
  const deals = req.body?.deals || [];
  const maxToSend = req.body?.maxToSend || 2;

  if (!Array.isArray(deals)) {
    return res.status(400).json({ error: "Expected deals array" });
  }

  const formattedDeals = deals.map((d) => ({
    name: d.name,
    slug: d.slug,
    brand_key: d.brand_key,
    description: d.description || "",
    url: d.url || "",
    affiliate_link: d.affiliateLink || null,
    page_url: d.page_url || `https://pochify.com/deals/${d.slug}.html`,
    source: d.source || "unknown",
    channel: d.channel || "general",
    votes_count: d.votes_count || 0,
    score: d.score || 0,
    meta_title: d.meta_title || "",
    meta_description: d.meta_description || "",
    og_image: d.og_image || "",
    hook: d.hook || "",
    audience: d.audience || "",
    why_now: d.why_now || "",
    caution: d.caution || "",
    benefits: d.benefits || [],
    updated_at: new Date().toISOString()
  }));

  const { error: upsertError } = await supabase
    .from("deals")
    .upsert(formattedDeals, { onConflict: "slug" });

  if (upsertError) {
    console.error("❌ Supabase deal upsert error:", upsertError);
    return res.status(500).json({ error: upsertError });
  }

  const brandKeys = [...new Set(formattedDeals.map((d) => d.brand_key))];

  const { data: activePrograms } = await supabase
    .from("affiliate_programs")
    .select("brand_key")
    .in("brand_key", brandKeys)
    .eq("status", "active");

  const activeBrandKeys = new Set((activePrograms || []).map((p) => p.brand_key));

  const opportunityRows = formattedDeals
    .filter((d) => !activeBrandKeys.has(d.brand_key))
    .map((d) => ({
      brand_key: d.brand_key,
      display_name: d.name,
      source_url: d.url,
      network_guess: guessNetwork(d.name, d.description),
      last_seen_at: new Date().toISOString()
    }));

  if (opportunityRows.length > 0) {
    await supabase
      .from("affiliate_opportunities")
      .upsert(opportunityRows, { onConflict: "brand_key" });
  }

  const slugs = formattedDeals.map((d) => d.slug);

  const { data: storedDeals, error: storedError } = await supabase
    .from("deals")
    .select("*")
    .in("slug", slugs);

  if (storedError) {
    console.error("❌ Supabase select error:", storedError);
    return res.status(500).json({ error: storedError });
  }

  const sendCandidates = (storedDeals || [])
    .filter(isEligibleToSend)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxToSend);

  console.log(`💾 Saved deals: ${formattedDeals.length}`);
  console.log(`📨 Send candidates: ${sendCandidates.length}`);

  res.json({
    success: true,
    sendCandidates
  });
});

app.post("/api/deals/mark-posted", async (req, res) => {
  const slugs = req.body?.slugs || [];

  if (!Array.isArray(slugs) || slugs.length === 0) {
    return res.status(400).json({ error: "Expected slugs array" });
  }

  const { data: existingDeals, error: selectError } = await supabase
    .from("deals")
    .select("slug, post_count")
    .in("slug", slugs);

  if (selectError) {
    return res.status(500).json({ error: selectError });
  }

  const updates = (existingDeals || []).map((d) => ({
    slug: d.slug,
    post_count: (d.post_count || 0) + 1,
    last_posted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const { error: updateError } = await supabase
    .from("deals")
    .upsert(updates, { onConflict: "slug" });

  if (updateError) {
    return res.status(500).json({ error: updateError });
  }

  res.json({ success: true, updated: updates.length });
});

app.get("/go/:slug", async (req, res) => {
  const slug = req.params.slug;

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("*")
    .eq("slug", slug)
    .single();

  if (dealError || !deal) {
    console.log("❌ Deal not found:", slug);
    return res.redirect("https://pochify.com");
  }

  const { data: affiliate } = await supabase
    .from("affiliate_programs")
    .select("*")
    .eq("brand_key", deal.brand_key)
    .eq("status", "active")
    .maybeSingle();

  const targetUrl = resolveTargetUrl(deal, affiliate);

  await supabase.from("click_events").insert({
    slug: deal.slug,
    brand_key: deal.brand_key,
    target_url: targetUrl,
    user_agent: req.get("user-agent") || null,
    referer: req.get("referer") || null
  });

  await supabase
    .from("deals")
    .upsert(
      {
        slug: deal.slug,
        click_count: (deal.click_count || 0) + 1,
        last_clicked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "slug" }
    );

  console.log(`✅ Redirect: ${slug} → ${targetUrl}`);

  return res.redirect(targetUrl || "https://pochify.com");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
