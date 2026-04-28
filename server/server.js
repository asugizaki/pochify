import express from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { createManualDeal } from "./manualDealService.js";
import { triggerRegenerateWorkflow } from "./githubWorkflowService.js";

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

  if (req.method === "OPTIONS") return res.sendStatus(204);
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
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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
      "minimum_discount_percent",
      "ga_measurement_id",
      "lifetime_score_bonus",
      "enable_scoring_debug",
      "enable_source_debug",
      "blocked_deal_keywords"
    ]);

  const defaults = {
    enable_producthunt_source: false,
    enable_stacksocial_source: true,
    require_affiliate_approval: false,
    allow_stacksocial_direct_posting: true,
    require_images_for_publish: true,
    minimum_quality_score: 5,
    minimum_discount_percent: 50,
    ga_measurement_id: null,
    lifetime_score_bonus: 0,
    enable_scoring_debug: false,
    enable_source_debug: false,
    blocked_deal_keywords: [
      "bundle",
      "course",
      "training",
      "masterclass",
      "certification",
      "pdf",
      "microsoft",
      "data plan",
      "windows",
      "vpn",
      "mac",
      "hosting",
      "ad blocker",
      "storage",
      "streaming",
      "cheat",
      "password"
    ]
  };

  for (const row of data || []) {
    defaults[row.key] = row.value_json;
  }

  return defaults;
}

function publicStatusFilter(query) {
  return query.in("status", ["ready_to_post", "posted", "active"]);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function adminLayout({ title, active = "", body = "" }) {
  const navItem = (href, label, key) => `
    <a href="${href}" style="
      color:${active === key ? "#ffffff" : "#93c5fd"};
      font-weight:${active === key ? "700" : "400"};
      text-decoration:none;
      padding:10px 12px;
      border-radius:10px;
      background:${active === key ? "#1f2937" : "transparent"};
    ">${label}</a>
  `;

  return `
<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)} | Pochify Admin</title>
</head>
<body style="font-family:Arial;background:#0b1220;color:#e5e7eb;margin:0;">
  <nav style="background:#111827;border-bottom:1px solid #1f2937;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <strong style="margin-right:12px;">Pochify Admin</strong>
      ${navItem("/admin", "Dashboard", "dashboard")}
      ${navItem("/admin/manual-deals", "Manual Deals", "manual-deals")}
    </div>
    <a href="/logout" style="color:#fca5a5;text-decoration:none;font-weight:700;">Logout</a>
  </nav>

  <main style="max-width:1000px;margin:40px auto;padding:0 20px;">
    ${body}
  </main>
</body>
</html>
`;
}

app.get("/", (_req, res) => {
  res.send("Pochify backend running 🚀");
});

app.get("/api/health", async (_req, res) => {
  res.json({
    ok: true,
    service: "pochify-go",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/settings/public", async (_req, res) => {
  res.json({ settings: await getPublicSettings() });
});

app.get("/api/source-pages", async (_req, res) => {
  const { data, error } = await supabase
    .from("source_pages")
    .select("source_key, page_type, page_name, url, is_enabled, sort_order")
    .eq("is_enabled", true)
    .order("source_key", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return res.status(500).json({ error: "Failed to load source pages" });
  }

  res.json({ items: data || [] });
});

app.get("/api/public/latest-deals", async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 6), 50);

  let query = supabase
    .from("deals")
    .select(`
      name, slug, description, hook, og_image, page_url, click_count, votes_count, score,
      created_at, channel, current_price, original_price, discount_percent, offer_type,
      source_key, source_name, source_logo_path, source_home_url, source_deal_url, card_image
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

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
      current_price, original_price, discount_percent, offer_type,
      source_key, source_name, source_logo_path, source_home_url, source_deal_url, card_image
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  query = publicStatusFilter(query);

  if (category) query = query.eq("channel", category);

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
      current_price, original_price, discount_percent, offer_type, card_image
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
  const limit = Math.min(Number(req.query.limit || 6), 50);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: clicks, error: clickError } = await supabase
    .from("click_events")
    .select("slug, created_at")
    .gte("created_at", since);

  if (clickError) return res.status(500).json({ error: "Failed to load top clicked" });

  const counts = new Map();
  for (const row of clicks || []) {
    counts.set(row.slug, (counts.get(row.slug) || 0) + 1);
  }

  const topSlugs = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug]) => slug);

  if (!topSlugs.length) return res.json({ items: [] });

  let query = supabase
    .from("deals")
    .select(`
      name, slug, description, hook, og_image, click_count, score,
      current_price, original_price, discount_percent, offer_type,
      source_key, source_name, source_logo_path, source_home_url, source_deal_url, card_image
    `)
    .in("slug", topSlugs);

  query = publicStatusFilter(query);

  const { data: deals, error: dealsError } = await query;
  if (dealsError) return res.status(500).json({ error: "Failed to load top clicked deals" });

  const merged = (deals || [])
    .map((deal) => ({ ...deal, week_clicks: counts.get(deal.slug) || 0 }))
    .sort((a, b) => (b.week_clicks || 0) - (a.week_clicks || 0));

  res.json({ items: merged });
});

app.post("/api/deals/existing-summaries", async (req, res) => {
  const slugs = req.body?.slugs || [];
  if (!Array.isArray(slugs) || !slugs.length) return res.json({ items: [] });

  const { data, error } = await supabase
    .from("deals")
    .select("slug, needs_regeneration, page_generated_at, content_generated_at, status")
    .in("slug", slugs);

  if (error) return res.status(500).json({ error });

  res.json({ items: data || [] });
});

app.post("/api/deals/existing-details", async (req, res) => {
  const slugs = req.body?.slugs || [];
  if (!Array.isArray(slugs) || !slugs.length) return res.json({ items: [] });

  const { data, error } = await supabase
    .from("deals")
    .select(`
      slug,
      needs_regeneration,
      status,
      current_price,
      original_price,
      discount_percent,
      og_image
    `)
    .in("slug", slugs);

  if (error) return res.status(500).json({ error });

  res.json({ items: data || [] });
});

app.post("/api/deals/ingest", async (req, res) => {
  try {
    const deals = req.body?.deals || [];
    const maxToSend = Number(req.body?.maxToSend || 2);
    const settings = { ...(await getPublicSettings()), ...(req.body?.settings || {}) };

    if (!Array.isArray(deals)) return res.status(400).json({ error: "Expected deals array" });

    const slugs = deals.map((d) => d.slug).filter(Boolean);

    const { data: existingDeals, error: existingError } = await supabase
      .from("deals")
      .select(`
        slug,
        status,
        current_price,
        original_price,
        discount_percent,
        needs_regeneration,
        last_posted_at,
        post_count
      `)
      .in("slug", slugs);

    if (existingError) return res.status(500).json({ error: existingError });

    const existingMap = new Map((existingDeals || []).map((d) => [d.slug, d]));

    function hasPricingChanged(existing, incoming) {
      return (
        Number(existing?.current_price || 0) !== Number(incoming?.current_price || 0) ||
        Number(existing?.original_price || 0) !== Number(incoming?.original_price || 0) ||
        Number(existing?.discount_percent || 0) !== Number(incoming?.discount_percent || 0)
      );
    }

    const formattedDeals = deals.map((d) => {
      const existing = existingMap.get(d.slug);
      const pricingChanged = existing ? hasPricingChanged(existing, d) : false;
      const regen = !!existing?.needs_regeneration;

      let status = existing?.status || "ready_to_post";

      if (!existing || regen || pricingChanged) {
        status = "ready_to_post";
      } else if (existing.status === "posted") {
        status = "posted";
      } else if (existing.status === "ready_to_post") {
        status = "ready_to_post";
      }

      if (settings.require_affiliate_approval) {
        status = d.affiliateLink ? status : "awaiting_link";
      }

      return {
        name: d.name,
        slug: d.slug,
        brand_key: d.brand_key,
        description: d.description || "",
        url: d.url || "",
        stacksocial_url: d.stacksocial_url || null,
        vendor_url: d.vendor_url || d.source_deal_url || null,
        affiliate_link: d.affiliateLink || d.affiliate_link || null,
        affiliate_url: d.affiliate_url || null,
        affiliate_detected: !!d.affiliate_detected,
        network_guess: d.network_guess || "",
        page_url: d.page_url || `${SITE_URL}/deals/${d.slug}.html`,
        source: d.source || d.source_key || "unknown",
        source_key: d.source_key || d.source || "unknown",
        source_name: d.source_name || "",
        source_logo_path: d.source_logo_path || "",
        source_home_url: d.source_home_url || "",
        source_deal_url: d.source_deal_url || d.vendor_url || d.url || "",
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
        needs_regeneration: false,
        meta_title: d.meta_title || "",
        meta_description: d.meta_description || "",
        og_image: d.og_image || "",
        card_image: d.card_image || d.og_image || "",
        hook: d.hook || "",
        audience: d.audience || "",
        why_now: d.why_now || "",
        caution: d.caution || "",
        benefits: d.benefits || [],
        content_generated_at: new Date().toISOString(),
        page_generated_at: new Date().toISOString(),
        status,
        last_posted_at: existing?.last_posted_at || null,
        post_count: existing?.post_count || 0,
        updated_at: new Date().toISOString()
      };
    });

    const { error: upsertError } = await supabase
      .from("deals")
      .upsert(formattedDeals, { onConflict: "slug" });

    if (upsertError) return res.status(500).json({ error: upsertError });

    const cooldownIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();

    const { data: queuedDeals, error: queueError } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "ready_to_post")
      .or(`last_posted_at.is.null,last_posted_at.lt.${cooldownIso}`)
      .order("quality_score", { ascending: false })
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(maxToSend);

    if (queueError) return res.status(500).json({ error: queueError });

    return res.json({
      success: true,
      sendCandidates: queuedDeals || []
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Unknown ingest error" });
  }
});

app.post("/api/deals/mark-posted", async (req, res) => {
  const slugs = req.body?.slugs || [];
  if (!Array.isArray(slugs) || !slugs.length) {
    return res.status(400).json({ error: "Expected slugs array" });
  }

  const { data, error } = await supabase.rpc("mark_deals_posted", { slugs });

  if (error) return res.status(500).json({ error });

  console.log("✅ Marked posted slugs:", slugs);
  res.json({
    success: true,
    updated: data?.[0]?.updated_count || 0
  });
});

app.get("/go/:slug", async (req, res) => {
  const slug = req.params.slug;

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("*")
    .eq("slug", slug)
    .single();

  if (dealError || !deal) return res.redirect(SITE_URL);

  const targetUrl =
    deal.affiliate_link ||
    deal.affiliate_url ||
    deal.vendor_url ||
    deal.source_deal_url ||
    deal.stacksocial_url ||
    deal.url ||
    SITE_URL;

  await supabase.from("click_events").insert({
    slug: deal.slug,
    brand_key: deal.brand_key,
    target_url: targetUrl,
    user_agent: req.get("user-agent") || null,
    referer: req.get("referer") || null
  });

  await supabase
    .from("deals")
    .update({
      click_count: (deal.click_count || 0) + 1,
      last_clicked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("slug", deal.slug);

  return res.redirect(targetUrl);
});

app.get("/login", (req, res) => {
  const next = req.query.next || "/admin";
  res.send(`
    <form method="POST" action="/login" style="max-width:420px;margin:40px auto;font-family:Arial">
      <input type="hidden" name="next" value="${escapeHtml(next)}" />
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

app.get("/logout", (_req, res) => {
  res.clearCookie("pochify_admin_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/"
  });

  res.redirect("/login");
});

app.get("/admin", requireAdmin, async (_req, res) => {
  const settings = await getPublicSettings();
  const { count: dealsCount = 0 } = await supabase.from("deals").select("*", { count: "exact", head: true });
  const { count: clickCount = 0 } = await supabase.from("click_events").select("*", { count: "exact", head: true });

  res.send(adminLayout({
    title: "Dashboard",
    active: "dashboard",
    body: `
      <h1>Pochify Admin</h1>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0;">
        <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:20px;">
          <div style="color:#94a3b8;">Deals</div>
          <div style="font-size:32px;font-weight:700;">${dealsCount}</div>
        </div>

        <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:20px;">
          <div style="color:#94a3b8;">Clicks</div>
          <div style="font-size:32px;font-weight:700;">${clickCount}</div>
        </div>
      </div>

      <p>
        <a href="/admin/manual-deals" style="color:#93c5fd;">Create manual affiliate deal</a>
      </p>

      <h2>Settings</h2>
      <pre style="background:#111827;padding:16px;border-radius:12px;overflow:auto;border:1px solid #1f2937;">${escapeHtml(JSON.stringify(settings, null, 2))}</pre>
    `
  }));
});

app.get("/admin/manual-deals", requireAdmin, (_req, res) => {
  res.type("html").send(adminLayout({
    title: "Manual Deals",
    active: "manual-deals",
    body: `
      <form method="post" action="/api/admin/manual-deals" style="max-width:760px;background:#111827;padding:24px;border-radius:16px;border:1px solid #1f2937;">
        <h1>Create Manual Deal</h1>
        <p style="color:#94a3b8;line-height:1.5;">
          Paste a direct SaaS affiliate offer here. After saving, Pochify will automatically trigger the GitHub regeneration workflow.
        </p>

        <label style="display:block;margin-top:14px;font-weight:bold;">Name</label>
        <input name="name" placeholder="Example: Jasper AI" style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;" />

        <label style="display:block;margin-top:14px;font-weight:bold;">Affiliate URL</label>
        <input name="affiliate_url" required placeholder="https://..." style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;" />

        <label style="display:block;margin-top:14px;font-weight:bold;">Current price</label>
        <input name="current_price" placeholder="49" style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;" />

        <label style="display:block;margin-top:14px;font-weight:bold;">Original price</label>
        <input name="original_price" placeholder="99" style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;" />

        <label style="display:block;margin-top:14px;font-weight:bold;">Description</label>
        <textarea name="description" rows="4" placeholder="Brief product description" style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;"></textarea>

        <label style="display:block;margin-top:14px;font-weight:bold;">Image URL optional</label>
        <input name="image_url" placeholder="https://..." style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;" />

        <label style="display:block;margin-top:14px;font-weight:bold;">Category</label>
        <select name="category" style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;">
          <option value="ai">AI</option>
          <option value="saas">SaaS</option>
          <option value="general">General</option>
        </select>

        <label style="display:block;margin-top:14px;font-weight:bold;">Offer type</label>
        <select name="offer_type" style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;">
          <option value="discount">Discount</option>
          <option value="lifetime">Lifetime</option>
        </select>

        <label style="display:block;margin-top:14px;font-weight:bold;">Affiliate Network</label>
        <select name="affiliate_network" style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;">
          <option value="direct">Direct</option>
          <option value="partnerstack">PartnerStack</option>
          <option value="rewardful">Rewardful</option>
          <option value="impact">Impact</option>
          <option value="stacksocial">StackSocial</option>
        </select>

        <label style="display:flex;align-items:center;gap:8px;margin-top:16px;font-weight:bold;">
          <input type="checkbox" name="use_ai" value="true" checked />
          Generate improved content with OpenAI
        </label>

        <button type="submit" style="margin-top:20px;padding:14px 22px;border:0;border-radius:12px;background:#22c55e;color:#04130a;font-weight:bold;cursor:pointer;">
          Create Deal
        </button>
      </form>
    `
  }));
});

app.post("/api/admin/manual-deals", requireAdmin, async (req, res) => {
  try {
    const deal = await createManualDeal({
      name: req.body.name,
      affiliate_url: req.body.affiliate_url,
      current_price: req.body.current_price,
      original_price: req.body.original_price,
      description: req.body.description,
      image_url: req.body.image_url,
      category: req.body.category,
      offer_type: req.body.offer_type,
      affiliate_network: req.body.affiliate_network,
      use_ai: req.body.use_ai === "true"
    });

    let workflowResult;

    try {
      workflowResult = await triggerRegenerateWorkflow({ mode: "all" });
    } catch (workflowError) {
      console.error("❌ Failed to trigger regeneration workflow:", workflowError);
      workflowResult = {
        triggered: false,
        reason: workflowError.message
      };
    }

    res.type("html").send(adminLayout({
      title: "Deal Created",
      active: "manual-deals",
      body: `
        <h1>✅ Deal created</h1>
        <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;">
          <p><strong>${escapeHtml(deal.name)}</strong></p>
          <p>Slug: <code>${escapeHtml(deal.slug)}</code></p>
    
          ${
            workflowResult?.triggered
              ? `<p>🚀 Regeneration workflow triggered. The page should publish after GitHub Actions finishes.</p>`
              : `<p>⚠️ Deal saved, but regeneration was not triggered: ${escapeHtml(workflowResult?.reason || "unknown reason")}</p>`
          }
    
          <p><a style="color:#93c5fd;" href="https://pochify.com/deals/${escapeHtml(deal.slug)}.html" target="_blank">View deal page</a></p>
          <p><a style="color:#93c5fd;" href="/admin/manual-deals">Create another</a></p>
        </div>
      `
    }));
  } catch (error) {
    console.error("❌ Manual deal create failed:", error);

    res.status(500).type("html").send(adminLayout({
      title: "Manual Deal Failed",
      active: "manual-deals",
      body: `
        <h1>❌ Failed</h1>
        <pre style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px;overflow:auto;">${escapeHtml(error.message || String(error))}</pre>
        <p><a style="color:#93c5fd;" href="/admin/manual-deals">Back</a></p>
      `
    }));
  }
});

app.listen(PORT, () => {
  console.log("🚀 Server running");
});
