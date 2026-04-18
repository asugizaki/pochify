import express from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://pochify.com";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-now";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function createSessionValue(username) {
  const payload = JSON.stringify({ u: username, t: Date.now() });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifySessionValue(value = "") {
  try {
    const [encoded, sig] = value.split(".");
    if (!encoded || !sig) return null;
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload?.u ? payload : null;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const session = verifySessionValue(req.cookies?.pochify_admin_session || "");
  if (!session) {
    const nextUrl = encodeURIComponent(req.originalUrl || "/admin");
    return res.redirect(`/login?next=${nextUrl}`);
  }
  req.adminUser = session.u;
  next();
}

async function getPublicSettings() {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value_json")
    .in("key", [
      "enable_producthunt_source",
      "enable_stacksocial_source",
      "require_affiliate_approval",
      "allow_stacksocial_direct_posting",
      "require_images_for_publish",
      "minimum_quality_score",
      "ga_measurement_id"
    ]);

  const defaults = {
    enable_producthunt_source: false,
    enable_stacksocial_source: true,
    require_affiliate_approval: false,
    allow_stacksocial_direct_posting: true,
    require_images_for_publish: true,
    minimum_quality_score: 5,
    ga_measurement_id: null
  };

  for (const row of data || []) {
    defaults[row.key] = row.value_json;
  }

  return defaults;
}

function publicStatusFilter(query) {
  return query.in("status", ["ready_to_post", "posted", "active"]);
}

app.get("/", (req, res) => {
  res.send("Pochify backend running 🚀");
});

app.get("/api/settings/public", async (req, res) => {
  res.json({ settings: await getPublicSettings() });
});

app.post("/api/deals/existing-summaries", async (req, res) => {
  const slugs = req.body?.slugs || [];
  if (!Array.isArray(slugs) || !slugs.length) {
    return res.json({ items: [] });
  }

  const { data, error } = await supabase
    .from("deals")
    .select("slug, needs_regeneration, page_generated_at, content_generated_at, status")
    .in("slug", slugs);

  if (error) {
    return res.status(500).json({ error });
  }

  res.json({ items: data || [] });
});

app.get("/api/public/latest-deals", async (req, res) => {
  let query = supabase
    .from("deals")
    .select(`
      name, slug, description, hook, audience, why_now, caution, benefits,
      og_image, page_url, click_count, votes_count, score, created_at, channel,
      current_price, original_price, discount_percent, offer_type
    `)
    .order("created_at", { ascending: false })
    .limit(6);

  query = publicStatusFilter(query);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Failed to load latest deals" });

  res.json({ items: data || [] });
});

app.get("/api/public/deals", async (req, res) => {
  const category = req.query.category || "";
  const limit = Math.min(Number(req.query.limit || 50), 1000);

  let query = supabase
    .from("deals")
    .select(`
      name, slug, description, hook, og_image, click_count, score, channel, created_at,
      current_price, original_price, discount_percent, offer_type
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  query = publicStatusFilter(query);

  if (category) {
    query = query.eq("channel", category);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Failed to load deals" });

  res.json({ items: data || [] });
});

app.get("/api/public/related-deals", async (req, res) => {
  const slug = req.query.slug;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const { data: currentDeal, error: currentError } = await supabase
    .from("deals")
    .select("slug, channel")
    .eq("slug", slug)
    .single();

  if (currentError || !currentDeal) {
    return res.status(404).json({ error: "Deal not found" });
  }

  let query = supabase
    .from("deals")
    .select(`
      name, slug, description, hook, og_image, score, click_count, channel,
      current_price, original_price, discount_percent, offer_type
    `)
    .neq("slug", slug)
    .order("click_count", { ascending: false })
    .order("score", { ascending: false })
    .limit(3);

  query = publicStatusFilter(query);

  if (currentDeal.channel === "ai" || currentDeal.channel === "saas") {
    query = query.eq("channel", currentDeal.channel);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Failed to load related deals" });

  res.json({ items: data || [] });
});

app.get("/api/public/top-clicked", async (req, res) => {
  const days = Number(req.query.days || 7);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: clicks, error: clickError } = await supabase
    .from("click_events")
    .select("slug, created_at")
    .gte("created_at", since);

  if (clickError) {
    return res.status(500).json({ error: "Failed to load top clicked" });
  }

  const counts = new Map();
  for (const row of clicks || []) {
    counts.set(row.slug, (counts.get(row.slug) || 0) + 1);
  }

  const topSlugs = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([slug]) => slug);

  if (!topSlugs.length) {
    return res.json({ items: [] });
  }

  let query = supabase
    .from("deals")
    .select(`
      name, slug, description, hook, og_image, click_count, score,
      current_price, original_price, discount_percent, offer_type
    `)
    .in("slug", topSlugs);

  query = publicStatusFilter(query);

  const { data: deals, error: dealsError } = await query;
  if (dealsError) {
    return res.status(500).json({ error: "Failed to load top clicked deals" });
  }

  const merged = (deals || [])
    .map((deal) => ({ ...deal, week_clicks: counts.get(deal.slug) || 0 }))
    .sort((a, b) => (b.week_clicks || 0) - (a.week_clicks || 0));

  res.json({ items: merged });
});

app.post("/api/deals/ingest", async (req, res) => {
  try {
    const deals = req.body?.deals || [];
    const maxToSend = req.body?.maxToSend || 2;
    const settings = { ...(await getPublicSettings()), ...(req.body?.settings || {}) };

    if (!Array.isArray(deals)) {
      return res.status(400).json({ error: "Expected deals array" });
    }

    const formattedDeals = deals.map((d) => {
      let status = "ready_to_post";

      if (settings.require_affiliate_approval) {
        status = d.affiliate_link ? "ready_to_post" : "awaiting_link";
      } else if (settings.allow_stacksocial_direct_posting && d.source === "stacksocial") {
        status = "ready_to_post";
      }

      return {
        name: d.name,
        slug: d.slug,
        brand_key: d.brand_key,
        description: d.description || "",
        url: d.url || "",
        stacksocial_url: d.stacksocial_url || null,
        vendor_url: d.vendor_url || null,
        affiliate_link: d.affiliateLink || null,
        affiliate_url: d.affiliate_url || null,
        affiliate_detected: !!d.affiliate_detected,
        network_guess: d.network_guess || "",
        page_url: d.page_url || `${SITE_URL}/deals/${d.slug}.html`,
        source: d.source || "stacksocial",
        channel: d.channel || "general",
        votes_count: d.votes_count || 0,
        score: d.score || 0,
        current_price: d.current_price || null,
        original_price: d.original_price || null,
        discount_percent: d.discount_percent || null,
        offer_type: d.offer_type || null,
        quality_score: d.quality_score || d.score || 0,
        has_required_assets: !!d.has_required_assets,
        is_publishable: !!d.is_publishable,
        needs_regeneration: !!d.needs_regeneration,
        meta_title: d.meta_title || "",
        meta_description: d.meta_description || "",
        og_image: d.og_image || "",
        hook: d.hook || "",
        audience: d.audience || "",
        why_now: d.why_now || "",
        caution: d.caution || "",
        benefits: d.benefits || [],
        content_generated_at: new Date().toISOString(),
        page_generated_at: new Date().toISOString(),
        status,
        updated_at: new Date().toISOString()
      };
    });

    const { error: upsertError } = await supabase
      .from("deals")
      .upsert(formattedDeals, { onConflict: "slug" });

    if (upsertError) {
      return res.status(500).json({ error: upsertError });
    }

    const sendCandidates = [...formattedDeals]
      .filter((d) => d.status === "ready_to_post")
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, maxToSend);

    return res.json({ success: true, sendCandidates });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Unknown ingest error" });
  }
});

app.post("/api/deals/mark-posted", async (req, res) => {
  const slugs = req.body?.slugs || [];
  if (!Array.isArray(slugs) || !slugs.length) {
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
    status: "posted",
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
    return res.redirect(SITE_URL);
  }

  const targetUrl = deal.affiliate_link || deal.stacksocial_url || deal.url || SITE_URL;

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

  return res.redirect(targetUrl);
});

/* login/logout/admin kept simple here */
app.get("/login", (req, res) => {
  const next = req.query.next || "/admin";
  res.send(`
    <form method="POST" action="/login" style="max-width:420px;margin:40px auto;font-family:Arial">
      <input type="hidden" name="next" value="${next}" />
      <h1>Pochify Admin Login</h1>
      <input name="username" placeholder="Username" style="width:100%;padding:12px;margin:8px 0" required />
      <input type="password" name="password" placeholder="Password" style="width:100%;padding:12px;margin:8px 0" required />
      <button style="width:100%;padding:12px">Login</button>
    </form>
  `);
});

app.post("/login", (req, res) => {
  const username = req.body?.username || "";
  const password = req.body?.password || "";
  const next = req.body?.next || "/admin";

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).send("Invalid credentials");
  }

  res.cookie("pochify_admin_session", createSessionValue(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 14
  });

  return res.redirect(next);
});

app.get("/logout", (req, res) => {
  res.clearCookie("pochify_admin_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/"
  });
  res.redirect("/login");
});

app.get("/admin", requireAdmin, async (req, res) => {
  const settings = await getPublicSettings();
  const { count: dealsCount = 0 } = await supabase.from("deals").select("*", { count: "exact", head: true });
  const { count: clickCount = 0 } = await supabase.from("click_events").select("*", { count: "exact", head: true });

  res.send(`
    <div style="font-family:Arial;max-width:1000px;margin:40px auto;color:#e5e7eb;background:#0b1220;padding:20px">
      <h1>Pochify Admin</h1>
      <p>Deals: ${dealsCount}</p>
      <p>Clicks: ${clickCount}</p>
      <pre style="background:#111827;padding:16px;border-radius:12px;overflow:auto">${JSON.stringify(settings, null, 2)}</pre>
      <p><a href="/logout" style="color:#93c5fd">Logout</a></p>
    </div>
  `);
});

app.listen(PORT, () => {
  console.log("🚀 Server running");
});
