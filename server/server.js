import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

const SITE_URL = "https://pochify.com";
const ADMIN_BASE_URL = "https://go.pochify.com";

const appSupabase = createClient(
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

  if (text.includes("partnerstack")) return "partnerstack";
  if (text.includes("design") || text.includes("ecommerce") || text.includes("cj")) return "cj";
  if (text.includes("b2b") || text.includes("saas") || text.includes("software") || text.includes("impact")) return "impact";
  if (text.includes("rewardful")) return "rewardful";
  if (text.includes("firstpromoter")) return "firstpromoter";
  if (text.includes("tolt")) return "tolt";
  return "unknown";
}

function isEligibleToSend(deal) {
  if (["awaiting_link", "discovered", "rejected", "hold"].includes(deal.status || "")) {
    return false;
  }

  if (!deal.last_posted_at) {
    return deal.status === "ready_to_post";
  }

  const enoughDays = daysSince(deal.last_posted_at) >= REPOST_DAYS;
  const enoughClicks = (deal.click_count || 0) >= MIN_REPOST_CLICKS;
  const notOverPosted = (deal.post_count || 0) < MAX_POST_COUNT;

  return deal.status === "ready_to_post" && enoughDays && enoughClicks && notOverPosted;
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

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function adminLayout({ title, content, active = "dashboard" }) {
  const navItem = (href, label, key) =>
    `<a class="nav-link ${active === key ? "active" : ""}" href="${href}">${label}</a>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} | Pochify Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #0b1220;
      color: #e5e7eb;
      margin: 0;
      padding: 0;
    }
    .shell {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px;
    }
    .topbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }
    .brand {
      color: #e5e7eb;
      text-decoration: none;
      font-weight: bold;
      font-size: 24px;
    }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .nav-link {
      color: #cbd5e1;
      text-decoration: none;
      border: 1px solid #334155;
      padding: 10px 14px;
      border-radius: 10px;
      background: #111827;
    }
    .nav-link.active {
      background: #22c55e;
      color: #04130a;
      border-color: #22c55e;
      font-weight: bold;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 18px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    input, select, textarea, button {
      width: 100%;
      padding: 10px;
      margin-top: 8px;
      border-radius: 10px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #e5e7eb;
    }
    button {
      background: #22c55e;
      color: #04130a;
      font-weight: bold;
      cursor: pointer;
    }
    .btn-secondary {
      background: #0f172a;
      color: #e5e7eb;
    }
    .btn-danger {
      background: #7f1d1d;
      color: #fff;
    }
    .btn-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .btn-row button,
    .btn-row a {
      width: auto;
      min-width: 110px;
    }
    a {
      color: #93c5fd;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid #1f2937;
      vertical-align: top;
      font-size: 14px;
    }
    .muted {
      color: #94a3b8;
    }
    .small {
      font-size: 12px;
      color: #94a3b8;
    }
    .pill {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid #334155;
      font-size: 12px;
      white-space: nowrap;
    }
    .controls {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: end;
    }
    .controls > div {
      min-width: 180px;
      flex: 1;
    }
    canvas {
      background: #fff;
      border-radius: 12px;
      padding: 8px;
    }
    @media (max-width: 900px) {
      .grid-4, .grid-2 {
        grid-template-columns: 1fr;
      }
      .shell {
        padding: 16px;
      }
      th, td {
        font-size: 13px;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <a class="brand" href="/admin">Pochify Admin</a>
      <div class="nav">
        ${navItem("/admin", "Dashboard", "dashboard")}
        ${navItem("/admin/opportunities", "Opportunities", "opportunities")}
        ${navItem("/admin/deals", "Deals", "deals")}
        ${navItem("/admin/affiliate-programs", "Affiliate Programs", "affiliate-programs")}
        ${navItem("/admin/analytics", "Analytics", "analytics")}
      </div>
    </div>
    ${content}
  </div>
</body>
</html>`;
}

async function loadOpportunityRows({ q = "", status = "" } = {}) {
  let query = appSupabase
    .from("affiliate_opportunities")
    .select(`
      brand_key,
      display_name,
      product_url,
      source_url,
      affiliate_url,
      network_guess,
      status,
      last_seen_at
    `)
    .order("last_seen_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  const rows = [];
  for (const row of data || []) {
    if (
      q &&
      ![
        row.brand_key,
        row.display_name,
        row.product_url,
        row.affiliate_url,
        row.network_guess
      ]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    ) {
      continue;
    }

    const { data: deal } = await appSupabase
      .from("deals")
      .select("slug, page_url, click_count, status, post_count, name")
      .eq("brand_key", row.brand_key)
      .order("click_count", { ascending: false })
      .limit(1)
      .maybeSingle();

    rows.push({
      ...row,
      click_count: deal?.click_count || 0,
      deal_status: deal?.status || "",
      deal_slug: deal?.slug || "",
      page_url: deal?.page_url || (deal?.slug ? `${SITE_URL}/deals/${deal.slug}.html` : "")
    });
  }

  return rows;
}

async function loadDealRows({ q = "", status = "" } = {}) {
  let query = appSupabase
    .from("deals")
    .select(`
      name,
      slug,
      brand_key,
      status,
      score,
      click_count,
      post_count,
      affiliate_detected,
      affiliate_url,
      affiliate_link,
      network_guess,
      page_url,
      channel,
      created_at,
      last_posted_at
    `)
    .order("created_at", { ascending: false })
    .limit(300);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).filter((row) => {
    if (!q) return true;
    return [
      row.name,
      row.slug,
      row.brand_key,
      row.network_guess,
      row.channel
    ]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase());
  });
}

async function getSummaryStats() {
  const [{ count: dealsCount }, { count: oppCount }, { count: affCount }, { count: clickCount }] =
    await Promise.all([
      appSupabase.from("deals").select("*", { count: "exact", head: true }),
      appSupabase.from("affiliate_opportunities").select("*", { count: "exact", head: true }),
      appSupabase.from("affiliate_programs").select("*", { count: "exact", head: true }),
      appSupabase.from("click_events").select("*", { count: "exact", head: true })
    ]);

  const { data: statusCounts } = await appSupabase
    .from("deals")
    .select("status");

  const buckets = {};
  for (const row of statusCounts || []) {
    buckets[row.status || "unknown"] = (buckets[row.status || "unknown"] || 0) + 1;
  }

  const { data: queue } = await appSupabase
    .from("deals")
    .select("name, slug, click_count, score, status, page_url")
    .eq("status", "ready_to_post")
    .order("score", { ascending: false })
    .limit(10);

  return {
    summary: {
      deals: dealsCount || 0,
      opportunities: oppCount || 0,
      affiliates: affCount || 0,
      clicks: clickCount || 0
    },
    buckets,
    queue: queue || []
  };
}

app.get("/", (req, res) => {
  res.send("Pochify backend running 🚀");
});

app.get("/api/public/latest-deals", async (req, res) => {
  const { data, error } = await appSupabase
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
      created_at,
      channel
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

app.get("/api/public/related-deals", async (req, res) => {
  const slug = req.query.slug;

  if (!slug) {
    return res.status(400).json({ error: "Missing slug" });
  }

  const { data: currentDeal, error: currentError } = await appSupabase
    .from("deals")
    .select("slug, channel")
    .eq("slug", slug)
    .single();

  if (currentError || !currentDeal) {
    return res.status(404).json({ error: "Deal not found" });
  }

  let query = appSupabase
    .from("deals")
    .select(`
      name,
      slug,
      description,
      hook,
      og_image,
      score,
      click_count,
      channel
    `)
    .eq("status", "active")
    .neq("slug", slug)
    .order("click_count", { ascending: false })
    .order("score", { ascending: false })
    .limit(3);

  if (currentDeal.channel === "ai" || currentDeal.channel === "saas") {
    query = query.eq("channel", currentDeal.channel);
  }

  const { data, error } = await query;

  if (error) {
    console.error("❌ related deals error:", error);
    return res.status(500).json({ error: "Failed to load related deals" });
  }

  res.json({ items: data || [] });
});

app.get("/api/public/top-clicked", async (req, res) => {
  const days = Number(req.query.days || 7);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: clicks, error: clickError } = await appSupabase
    .from("click_events")
    .select("slug, created_at")
    .gte("created_at", since);

  if (clickError) {
    console.error("❌ top clicked click_events error:", clickError);
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

  if (topSlugs.length === 0) {
    return res.json({ items: [] });
  }

  const { data: deals, error: dealsError } = await appSupabase
    .from("deals")
    .select(`
      name,
      slug,
      description,
      hook,
      og_image,
      click_count,
      score
    `)
    .in("slug", topSlugs);

  if (dealsError) {
    console.error("❌ top clicked deals error:", dealsError);
    return res.status(500).json({ error: "Failed to load top clicked deals" });
  }

  const merged = (deals || [])
    .map((deal) => ({
      ...deal,
      week_clicks: counts.get(deal.slug) || 0
    }))
    .sort((a, b) => (b.week_clicks || 0) - (a.week_clicks || 0));

  res.json({ items: merged });
});

app.post("/api/deals/ingest", async (req, res) => {
  const deals = req.body?.deals || [];
  const maxToSend = req.body?.maxToSend || 2;

  if (!Array.isArray(deals)) {
    return res.status(400).json({ error: "Expected deals array" });
  }

  const slugs = deals.map((d) => d.slug);

  const { data: existingDeals, error: existingDealsError } = await appSupabase
    .from("deals")
    .select("slug, status, brand_key")
    .in("slug", slugs);

  if (existingDealsError) {
    return res.status(500).json({ error: existingDealsError });
  }

  const existingDealMap = new Map((existingDeals || []).map((d) => [d.slug, d]));

  const brandKeys = [...new Set(deals.map((d) => d.brand_key).filter(Boolean))];

  const { data: activePrograms, error: activeProgramsError } = await appSupabase
    .from("affiliate_programs")
    .select("brand_key")
    .in("brand_key", brandKeys)
    .eq("status", "active");

  if (activeProgramsError) {
    return res.status(500).json({ error: activeProgramsError });
  }

  const activeBrandKeys = new Set((activePrograms || []).map((p) => p.brand_key));

  const formattedDeals = deals.map((d) => {
    const existing = existingDealMap.get(d.slug);
    let status = existing?.status || "discovered";

    if (activeBrandKeys.has(d.brand_key)) {
      if (!["posted", "rejected"].includes(status)) {
        status = "ready_to_post";
      }
    } else if (d.affiliate_detected && d.affiliate_url) {
      if (!["posted", "rejected"].includes(status)) {
        status = "awaiting_link";
      }
    } else if (!existing?.status) {
      status = "discovered";
    }

    return {
      name: d.name,
      slug: d.slug,
      brand_key: d.brand_key,
      description: d.description || "",
      url: d.url || "",
      affiliate_link: d.affiliateLink || null,
      affiliate_url: d.affiliate_url || null,
      affiliate_detected: !!d.affiliate_detected,
      network_guess: d.network_guess || guessNetwork(d.name, d.description),
      page_url: d.page_url || `${SITE_URL}/deals/${d.slug}.html`,
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
      status,
      updated_at: new Date().toISOString()
    };
  });

  const { error: upsertError } = await appSupabase
    .from("deals")
    .upsert(formattedDeals, { onConflict: "slug" });

  if (upsertError) {
    console.error("❌ Supabase deal upsert error:", upsertError);
    return res.status(500).json({ error: upsertError });
  }

  const opportunityRows = formattedDeals
    .filter((d) => !activeBrandKeys.has(d.brand_key) && d.affiliate_detected && d.affiliate_url)
    .map((d) => ({
      brand_key: d.brand_key,
      display_name: d.name,
      product_url: d.url,
      source_url: d.url,
      affiliate_url: d.affiliate_url,
      network_guess: d.network_guess || guessNetwork(d.name, d.description),
      status: "awaiting_signup",
      last_seen_at: new Date().toISOString()
    }));

  if (opportunityRows.length > 0) {
    const { error: oppError } = await appSupabase
      .from("affiliate_opportunities")
      .upsert(opportunityRows, { onConflict: "brand_key" });

    if (oppError) {
      console.error("❌ affiliate opportunities upsert error:", oppError);
      return res.status(500).json({ error: oppError });
    }
  }

  const { data: storedDeals, error: storedError } = await appSupabase
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

  const { data: existingDeals, error: selectError } = await appSupabase
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

  const { error: updateError } = await appSupabase
    .from("deals")
    .upsert(updates, { onConflict: "slug" });

  if (updateError) {
    return res.status(500).json({ error: updateError });
  }

  res.json({ success: true, updated: updates.length });
});

app.get("/go/:slug", async (req, res) => {
  const slug = req.params.slug;

  const { data: deal, error: dealError } = await appSupabase
    .from("deals")
    .select("*")
    .eq("slug", slug)
    .single();

  if (dealError || !deal) {
    return res.redirect(SITE_URL);
  }

  const { data: affiliate } = await appSupabase
    .from("affiliate_programs")
    .select("*")
    .eq("brand_key", deal.brand_key)
    .eq("status", "active")
    .maybeSingle();

  const targetUrl = resolveTargetUrl(deal, affiliate);

  await appSupabase.from("click_events").insert({
    slug: deal.slug,
    brand_key: deal.brand_key,
    target_url: targetUrl,
    user_agent: req.get("user-agent") || null,
    referer: req.get("referer") || null
  });

  await appSupabase
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

  return res.redirect(targetUrl || SITE_URL);
});

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  const data = await getSummaryStats();

  const { data: topDeals } = await appSupabase
    .from("deals")
    .select("name, slug, click_count, post_count, score, status")
    .order("click_count", { ascending: false })
    .limit(10);

  res.json({
    ...data,
    topDeals: topDeals || []
  });
});

app.get("/api/admin/opportunities", requireAdmin, async (req, res) => {
  try {
    const rows = await loadOpportunityRows({
      q: req.query.q || "",
      status: req.query.status || ""
    });
    res.json({ items: rows });
  } catch (error) {
    res.status(500).json({ error });
  }
});

app.post("/api/admin/opportunities/status", requireAdmin, async (req, res) => {
  const { brand_keys = [], status } = req.body || {};

  if (!Array.isArray(brand_keys) || brand_keys.length === 0 || !status) {
    return res.status(400).json({ error: "brand_keys array and status are required" });
  }

  const { error } = await appSupabase
    .from("affiliate_opportunities")
    .update({
      status,
      last_seen_at: new Date().toISOString()
    })
    .in("brand_key", brand_keys);

  if (error) {
    return res.status(500).json({ error });
  }

  if (status === "approved") {
    await appSupabase
      .from("deals")
      .update({
        status: "ready_to_post",
        updated_at: new Date().toISOString()
      })
      .in("brand_key", brand_keys)
      .in("status", ["awaiting_link", "discovered", "hold"]);
  }

  if (status === "rejected" || status === "ignore") {
    await appSupabase
      .from("deals")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString()
      })
      .in("brand_key", brand_keys);
  }

  res.json({ success: true });
});

app.get("/api/admin/deals", requireAdmin, async (req, res) => {
  try {
    const rows = await loadDealRows({
      q: req.query.q || "",
      status: req.query.status || ""
    });
    res.json({ items: rows });
  } catch (error) {
    res.status(500).json({ error });
  }
});

app.post("/api/admin/deals/status", requireAdmin, async (req, res) => {
  const { slugs = [], status } = req.body || {};

  if (!Array.isArray(slugs) || slugs.length === 0 || !status) {
    return res.status(400).json({ error: "slugs array and status are required" });
  }

  const { error } = await appSupabase
    .from("deals")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .in("slug", slugs);

  if (error) {
    return res.status(500).json({ error });
  }

  res.json({ success: true });
});

app.get("/api/admin/queue", requireAdmin, async (req, res) => {
  const { data, error } = await appSupabase
    .from("deals")
    .select("name, slug, score, click_count, status, page_url, post_count")
    .eq("status", "ready_to_post")
    .order("score", { ascending: false })
    .limit(100);

  if (error) {
    return res.status(500).json({ error });
  }

  res.json({ items: data || [] });
});

app.get("/api/admin/affiliate-programs", requireAdmin, async (req, res) => {
  const { data, error } = await appSupabase
    .from("affiliate_programs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error });
  }

  res.json({ items: data || [] });
});

app.post("/api/admin/affiliate-programs", requireAdmin, async (req, res) => {
  const payload = req.body || {};

  const row = {
    brand_key: payload.brand_key,
    display_name: payload.display_name || payload.brand_key,
    network: payload.network,
    tracking_url: payload.tracking_url || null,
    deeplink_template: payload.deeplink_template || null,
    deeplink_supported: !!payload.deeplink_supported,
    status: payload.status || "active",
    updated_at: new Date().toISOString()
  };

  const { error } = await appSupabase
    .from("affiliate_programs")
    .upsert(row, { onConflict: "brand_key" });

  if (error) {
    return res.status(500).json({ error });
  }

  await appSupabase
    .from("affiliate_opportunities")
    .upsert(
      {
        brand_key: payload.brand_key,
        display_name: payload.display_name || payload.brand_key,
        status: "approved",
        last_seen_at: new Date().toISOString()
      },
      { onConflict: "brand_key" }
    );

  await appSupabase
    .from("deals")
    .update({
      status: "ready_to_post",
      updated_at: new Date().toISOString()
    })
    .eq("brand_key", payload.brand_key)
    .in("status", ["awaiting_link", "discovered", "hold"]);

  res.json({ success: true });
});

app.get("/admin", requireAdmin, async (req, res) => {
  const stats = await getSummaryStats();

  const content = `
    <div class="grid-4">
      <div class="card"><h2>${stats.summary.deals}</h2><div>Deals</div></div>
      <div class="card"><h2>${stats.summary.opportunities}</h2><div>Opportunities</div></div>
      <div class="card"><h2>${stats.summary.affiliates}</h2><div>Affiliate Programs</div></div>
      <div class="card"><h2>${stats.summary.clicks}</h2><div>Clicks</div></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>Status Buckets</h2>
        <table>
          <tbody>
            ${Object.entries(stats.buckets)
              .map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${value}</td></tr>`)
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Ready to Post Queue</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Score</th><th>Clicks</th><th>Page</th></tr>
          </thead>
          <tbody>
            ${(stats.queue || [])
              .map(
                (row) => `
                <tr>
                  <td>${escapeHtml(row.name)}</td>
                  <td>${row.score || 0}</td>
                  <td>${row.click_count || 0}</td>
                  <td><a href="${row.page_url || `${SITE_URL}/deals/${row.slug}.html`}" target="_blank" rel="noopener">Open</a></td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>Quick Links</h2>
        <div class="btn-row">
          <a class="nav-link" href="/admin/opportunities">Review Opportunities</a>
          <a class="nav-link" href="/admin/deals">Review Deals</a>
          <a class="nav-link" href="/admin/affiliate-programs">Manage Affiliate Programs</a>
          <a class="nav-link" href="/admin/analytics">View Analytics</a>
        </div>
      </div>

      <div class="card">
        <h2>Typical Workflow</h2>
        <ol>
          <li>Open Opportunities</li>
          <li>Sign up using affiliate page link</li>
          <li>Add your tracking link under Affiliate Programs</li>
          <li>Deal automatically moves toward ready-to-post</li>
          <li>Next pipeline run sends Telegram</li>
        </ol>
      </div>
    </div>
  `;

  res.send(adminLayout({ title: "Dashboard", content, active: "dashboard" }));
});

app.get("/admin/opportunities", requireAdmin, async (req, res) => {
  const q = req.query.q || "";
  const status = req.query.status || "";

  const content = `
    <div class="card">
      <h2>Affiliate Opportunities</h2>
      <div class="controls">
        <div>
          <label>Search</label>
          <input id="searchInput" value="${escapeHtml(q)}" placeholder="brand, network, url" />
        </div>
        <div>
          <label>Status</label>
          <select id="statusFilter">
            <option value="">All</option>
            <option value="awaiting_signup" ${status === "awaiting_signup" ? "selected" : ""}>awaiting_signup</option>
            <option value="applied" ${status === "applied" ? "selected" : ""}>applied</option>
            <option value="approved" ${status === "approved" ? "selected" : ""}>approved</option>
            <option value="rejected" ${status === "rejected" ? "selected" : ""}>rejected</option>
            <option value="ignore" ${status === "ignore" ? "selected" : ""}>ignore</option>
          </select>
        </div>
        <div>
          <label>&nbsp;</label>
          <button class="btn-secondary" onclick="applyFilters()">Apply Filters</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="btn-row" style="margin-bottom:12px;">
        <button onclick="bulkUpdateOpportunityStatus('applied')">Bulk mark applied</button>
        <button onclick="bulkUpdateOpportunityStatus('approved')">Bulk mark approved</button>
        <button class="btn-secondary" onclick="bulkUpdateOpportunityStatus('ignore')">Bulk ignore</button>
        <button class="btn-danger" onclick="bulkUpdateOpportunityStatus('rejected')">Bulk reject</button>
      </div>

      <table>
        <thead>
          <tr>
            <th><input type="checkbox" onclick="toggleAll(this)" /></th>
            <th>Brand</th>
            <th>Network</th>
            <th>Affiliate Page</th>
            <th>Pochify Page</th>
            <th>Clicks</th>
            <th>Opportunity Status</th>
            <th>Deal Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="oppRows"></tbody>
      </table>
    </div>

    <script>
      function applyFilters() {
        const q = encodeURIComponent(document.getElementById('searchInput').value || '');
        const status = encodeURIComponent(document.getElementById('statusFilter').value || '');
        window.location.href = '/admin/opportunities?q=' + q + '&status=' + status;
      }

      function toggleAll(source) {
        document.querySelectorAll('.bulk-box').forEach((box) => {
          box.checked = source.checked;
        });
      }

      function selectedBrandKeys() {
        return [...document.querySelectorAll('.bulk-box:checked')].map((el) => el.value);
      }

      async function updateOpportunityStatus(brandKey, status) {
        const res = await fetch('/api/admin/opportunities/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand_keys: [brandKey], status })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          alert('Update failed');
          console.error(data);
        }
      }

      async function bulkUpdateOpportunityStatus(status) {
        const brandKeys = selectedBrandKeys();
        if (!brandKeys.length) {
          alert('Select at least one row');
          return;
        }

        const res = await fetch('/api/admin/opportunities/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand_keys: brandKeys, status })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          alert('Bulk update failed');
          console.error(data);
        }
      }

      async function loadRows() {
        const params = new URLSearchParams(window.location.search);
        const res = await fetch('/api/admin/opportunities?' + params.toString());
        const data = await res.json();

        const rows = (data.items || []).map((o) => \`
          <tr>
            <td><input class="bulk-box" type="checkbox" value="\${o.brand_key}" /></td>
            <td>
              <strong>\${o.display_name || o.brand_key}</strong><br/>
              <span class="small">\${o.brand_key}</span>
            </td>
            <td><span class="pill">\${o.network_guess || ''}</span></td>
            <td>\${o.affiliate_url ? '<a href="' + o.affiliate_url + '" target="_blank" rel="noopener">Signup</a>' : '-'}</td>
            <td>\${o.page_url ? '<a href="' + o.page_url + '" target="_blank" rel="noopener">Open</a>' : '-'}</td>
            <td>\${o.click_count || 0}</td>
            <td><span class="pill">\${o.status || ''}</span></td>
            <td><span class="pill">\${o.deal_status || ''}</span></td>
            <td>
              <div class="btn-row">
                <button onclick="updateOpportunityStatus('\${o.brand_key}', 'applied')">Applied</button>
                <button onclick="updateOpportunityStatus('\${o.brand_key}', 'approved')">Approve</button>
                <button class="btn-secondary" onclick="window.location.href='/admin/affiliate-programs?brand_key=\${encodeURIComponent(o.brand_key)}&display_name=\${encodeURIComponent(o.display_name || '')}&network=\${encodeURIComponent(o.network_guess || '')}'">Add Link</button>
                <button class="btn-secondary" onclick="updateOpportunityStatus('\${o.brand_key}', 'ignore')">Ignore</button>
                <button class="btn-danger" onclick="updateOpportunityStatus('\${o.brand_key}', 'rejected')">Reject</button>
              </div>
            </td>
          </tr>
        \`).join('');

        document.getElementById('oppRows').innerHTML = rows || '<tr><td colspan="9">No opportunities found.</td></tr>';
      }

      loadRows();
    </script>
  `;

  res.send(adminLayout({ title: "Opportunities", content, active: "opportunities" }));
});

app.get("/admin/deals", requireAdmin, async (req, res) => {
  const q = req.query.q || "";
  const status = req.query.status || "";

  const content = `
    <div class="card">
      <h2>Deals</h2>
      <div class="controls">
        <div>
          <label>Search</label>
          <input id="searchInput" value="${escapeHtml(q)}" placeholder="name, slug, brand key" />
        </div>
        <div>
          <label>Status</label>
          <select id="statusFilter">
            <option value="">All</option>
            <option value="discovered" ${status === "discovered" ? "selected" : ""}>discovered</option>
            <option value="awaiting_link" ${status === "awaiting_link" ? "selected" : ""}>awaiting_link</option>
            <option value="ready_to_post" ${status === "ready_to_post" ? "selected" : ""}>ready_to_post</option>
            <option value="posted" ${status === "posted" ? "selected" : ""}>posted</option>
            <option value="hold" ${status === "hold" ? "selected" : ""}>hold</option>
            <option value="rejected" ${status === "rejected" ? "selected" : ""}>rejected</option>
          </select>
        </div>
        <div>
          <label>&nbsp;</label>
          <button class="btn-secondary" onclick="applyFilters()">Apply Filters</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="btn-row" style="margin-bottom:12px;">
        <button onclick="bulkUpdateDealStatus('ready_to_post')">Bulk ready</button>
        <button class="btn-secondary" onclick="bulkUpdateDealStatus('hold')">Bulk hold</button>
        <button class="btn-danger" onclick="bulkUpdateDealStatus('rejected')">Bulk reject</button>
      </div>

      <table>
        <thead>
          <tr>
            <th><input type="checkbox" onclick="toggleAll(this)" /></th>
            <th>Name</th>
            <th>Status</th>
            <th>Score</th>
            <th>Clicks</th>
            <th>Posts</th>
            <th>Affiliate</th>
            <th>Pochify Page</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="dealRows"></tbody>
      </table>
    </div>

    <script>
      function applyFilters() {
        const q = encodeURIComponent(document.getElementById('searchInput').value || '');
        const status = encodeURIComponent(document.getElementById('statusFilter').value || '');
        window.location.href = '/admin/deals?q=' + q + '&status=' + status;
      }

      function toggleAll(source) {
        document.querySelectorAll('.bulk-box').forEach((box) => {
          box.checked = source.checked;
        });
      }

      function selectedSlugs() {
        return [...document.querySelectorAll('.bulk-box:checked')].map((el) => el.value);
      }

      async function updateDealStatus(slug, status) {
        const res = await fetch('/api/admin/deals/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slugs: [slug], status })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          alert('Update failed');
          console.error(data);
        }
      }

      async function bulkUpdateDealStatus(status) {
        const slugs = selectedSlugs();
        if (!slugs.length) {
          alert('Select at least one row');
          return;
        }

        const res = await fetch('/api/admin/deals/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slugs, status })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          alert('Bulk update failed');
          console.error(data);
        }
      }

      async function loadRows() {
        const params = new URLSearchParams(window.location.search);
        const res = await fetch('/api/admin/deals?' + params.toString());
        const data = await res.json();

        const rows = (data.items || []).map((d) => \`
          <tr>
            <td><input class="bulk-box" type="checkbox" value="\${d.slug}" /></td>
            <td>
              <strong>\${d.name}</strong><br/>
              <span class="small">\${d.slug}</span>
            </td>
            <td><span class="pill">\${d.status || ''}</span></td>
            <td>\${d.score || 0}</td>
            <td>\${d.click_count || 0}</td>
            <td>\${d.post_count || 0}</td>
            <td>\${d.affiliate_link ? '✅ link' : (d.affiliate_detected ? '🟡 detected' : '—')}</td>
            <td>\${d.page_url ? '<a href="' + d.page_url + '" target="_blank" rel="noopener">Open</a>' : '-'}</td>
            <td>
              <div class="btn-row">
                <button onclick="updateDealStatus('\${d.slug}', 'ready_to_post')">Ready</button>
                <button class="btn-secondary" onclick="updateDealStatus('\${d.slug}', 'hold')">Hold</button>
                <button class="btn-danger" onclick="updateDealStatus('\${d.slug}', 'rejected')">Reject</button>
              </div>
            </td>
          </tr>
        \`).join('');

        document.getElementById('dealRows').innerHTML = rows || '<tr><td colspan="9">No deals found.</td></tr>';
      }

      loadRows();
    </script>
  `;

  res.send(adminLayout({ title: "Deals", content, active: "deals" }));
});

app.get("/admin/affiliate-programs", requireAdmin, async (req, res) => {
  const brandKey = req.query.brand_key || "";
  const displayName = req.query.display_name || "";
  const network = req.query.network || "";

  const content = `
    <div class="card">
      <h2>Add / Update Affiliate Program</h2>
      <p class="muted">Saving an affiliate program automatically moves matching deals toward ready-to-post.</p>
      <form id="affiliateForm">
        <label>Brand Key</label>
        <input name="brand_key" value="${escapeHtml(brandKey)}" placeholder="brand_key e.g. pyxaai" required />

        <label>Display Name</label>
        <input name="display_name" value="${escapeHtml(displayName)}" placeholder="Display name" />

        <label>Network</label>
        <input name="network" value="${escapeHtml(network)}" placeholder="impact / cj / partnerstack / rewardful" required />

        <label>Tracking URL</label>
        <input name="tracking_url" placeholder="Your affiliate tracking URL" />

        <label>Deep Link Template</label>
        <input name="deeplink_template" placeholder="Optional deeplink template" />

        <label>Deep Link Supported</label>
        <select name="deeplink_supported">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>

        <label>Status</label>
        <select name="status">
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>

        <button type="submit">Save Affiliate Program</button>
      </form>
    </div>

    <div class="card">
      <h2>Existing Affiliate Programs</h2>
      <table>
        <thead>
          <tr>
            <th>Brand</th>
            <th>Network</th>
            <th>Status</th>
            <th>Tracking</th>
          </tr>
        </thead>
        <tbody id="programRows"></tbody>
      </table>
    </div>

    <script>
      document.getElementById('affiliateForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const payload = Object.fromEntries(form.entries());
        payload.deeplink_supported = payload.deeplink_supported === 'true';

        const res = await fetch('/api/admin/affiliate-programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          alert('Saved');
          e.target.reset();
          loadPrograms();
        } else {
          alert('Failed');
          console.error(data);
        }
      });

      async function loadPrograms() {
        const res = await fetch('/api/admin/affiliate-programs');
        const data = await res.json();

        const rows = (data.items || []).map((p) => \`
          <tr>
            <td><strong>\${p.display_name || p.brand_key}</strong><br/><span class="small">\${p.brand_key}</span></td>
            <td>\${p.network || ''}</td>
            <td><span class="pill">\${p.status || ''}</span></td>
            <td>\${p.tracking_url ? '<a href="' + p.tracking_url + '" target="_blank" rel="noopener">Open</a>' : '-'}</td>
          </tr>
        \`).join('');

        document.getElementById('programRows').innerHTML = rows || '<tr><td colspan="4">No affiliate programs yet.</td></tr>';
      }

      loadPrograms();
    </script>
  `;

  res.send(adminLayout({ title: "Affiliate Programs", content, active: "affiliate-programs" }));
});

app.get("/admin/analytics", requireAdmin, async (req, res) => {
  const content = `
    <div class="grid-4" id="summaryCards"></div>

    <div class="grid-2">
      <div class="card">
        <h2>Top Clicked Deals</h2>
        <canvas id="topDealsChart"></canvas>
      </div>

      <div class="card">
        <h2>Status Breakdown</h2>
        <canvas id="statusChart"></canvas>
      </div>
    </div>

    <div class="card">
      <h2>Ready to Post Queue</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Score</th>
            <th>Clicks</th>
            <th>Page</th>
          </tr>
        </thead>
        <tbody id="queueRows"></tbody>
      </table>
    </div>

    <script>
      async function loadAnalytics() {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();

        const s = data.summary || {};
        document.getElementById('summaryCards').innerHTML = \`
          <div class="card"><h2>\${s.deals || 0}</h2><div>Deals</div></div>
          <div class="card"><h2>\${s.opportunities || 0}</h2><div>Opportunities</div></div>
          <div class="card"><h2>\${s.affiliates || 0}</h2><div>Affiliate Programs</div></div>
          <div class="card"><h2>\${s.clicks || 0}</h2><div>Clicks</div></div>
        \`;

        const topLabels = (data.topDeals || []).map(d => d.name);
        const topValues = (data.topDeals || []).map(d => d.click_count || 0);

        new Chart(document.getElementById('topDealsChart'), {
          type: 'bar',
          data: {
            labels: topLabels,
            datasets: [{ label: 'Clicks', data: topValues }]
          },
          options: { responsive: true }
        });

        const statusEntries = Object.entries(data.buckets || {});
        new Chart(document.getElementById('statusChart'), {
          type: 'bar',
          data: {
            labels: statusEntries.map(([k]) => k),
            datasets: [{ label: 'Deals', data: statusEntries.map(([, v]) => v) }]
          },
          options: { responsive: true }
        });

        document.getElementById('queueRows').innerHTML = (data.queue || []).map(row => \`
          <tr>
            <td>\${row.name}</td>
            <td>\${row.score || 0}</td>
            <td>\${row.click_count || 0}</td>
            <td><a href="\${row.page_url || '/deals/' + row.slug + '.html'}" target="_blank" rel="noopener">Open</a></td>
          </tr>
        \`).join('') || '<tr><td colspan="4">No ready queue items.</td></tr>';
      }

      loadAnalytics();
    </script>
  `;

  res.send(adminLayout({ title: "Analytics", content, active: "analytics" }));
});
