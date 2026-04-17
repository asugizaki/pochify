import express from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3000;

const SITE_URL = "https://pochify.com";
const REPOST_DAYS = 7;
const MAX_POST_COUNT = 3;
const MIN_REPOST_CLICKS = 10;
const DEFAULT_PAGE_SIZE = 20;

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

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function daysSince(dateString) {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const then = new Date(dateString).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

function guessNetwork(name = "", description = "") {
  const text = `${name} ${description}`.toLowerCase();

  if (text.includes("partnerstack")) return "partnerstack";
  if (text.includes("rewardful")) return "rewardful";
  if (text.includes("firstpromoter")) return "firstpromoter";
  if (text.includes("tolt")) return "tolt";
  if (text.includes("cj") || text.includes("commission junction")) return "cj";
  if (text.includes("impact")) return "impact";
  if (text.includes("saas") || text.includes("software") || text.includes("b2b")) return "impact";
  return "unknown";
}

async function getSettingValue(key, fallback = null) {
  const { data } = await supabase
    .from("app_settings")
    .select("value_json")
    .eq("key", key)
    .maybeSingle();

  return data?.value_json ?? fallback;
}

async function getPublicSettings() {
  const keys = [
    "enable_producthunt_source",
    "enable_stacksocial_source",
    "require_affiliate_approval",
    "allow_stacksocial_direct_posting",
    "require_images_for_publish",
    "ga_measurement_id"
  ];

  const { data } = await supabase
    .from("app_settings")
    .select("key, value_json")
    .in("key", keys);

  const map = {
    enable_producthunt_source: false,
    enable_stacksocial_source: true,
    require_affiliate_approval: false,
    allow_stacksocial_direct_posting: true,
    require_images_for_publish: true,
    ga_measurement_id: null
  };

  for (const row of data || []) {
    map[row.key] = row.value_json;
  }

  return map;
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
  if (deal.stacksocial_url) return deal.stacksocial_url;
  return deal.url;
}

function createSessionValue(username) {
  const payload = JSON.stringify({
    u: username,
    t: Date.now()
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${sig}`;
}

function verifySessionValue(value = "") {
  try {
    const [encoded, sig] = value.split(".");
    if (!encoded || !sig) return null;

    const expected = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(encoded)
      .digest("base64url");

    if (sig !== expected) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload?.u) return null;

    return payload;
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

function getPageParam(value, fallback = 1) {
  const page = Number.parseInt(String(value || fallback), 10);
  return Number.isFinite(page) && page > 0 ? page : fallback;
}

function paginateArray(items, page, pageSize = DEFAULT_PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedItems = items.slice(start, start + pageSize);

  return {
    items: pagedItems,
    page: safePage,
    pageSize,
    total,
    totalPages
  };
}

async function getSummaryStats() {
  const [{ count: dealsCount }, { count: oppCount }, { count: affCount }, { count: clickCount }] =
    await Promise.all([
      supabase.from("deals").select("*", { count: "exact", head: true }),
      supabase.from("affiliate_opportunities").select("*", { count: "exact", head: true }),
      supabase.from("affiliate_programs").select("*", { count: "exact", head: true }),
      supabase.from("click_events").select("*", { count: "exact", head: true })
    ]);

  const { data: statusCounts } = await supabase
    .from("deals")
    .select("status");

  const buckets = {};
  for (const row of statusCounts || []) {
    const key = row.status || "unknown";
    buckets[key] = (buckets[key] || 0) + 1;
  }

  const { data: queue } = await supabase
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

async function loadOpportunityRows({ q = "", status = "" } = {}) {
  let query = supabase
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
    .limit(500);

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

    const { data: deal } = await supabase
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
  let query = supabase
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
      last_posted_at,
      current_price,
      original_price,
      discount_percent,
      offer_type
    `)
    .order("created_at", { ascending: false })
    .limit(1000);

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

function adminPaginationHtml({ page, totalPages, basePath, params = {} }) {
  if (totalPages <= 1) return "";

  const makeUrl = (targetPage) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== "") {
        qs.set(key, String(value));
      }
    });
    qs.set("page", String(targetPage));
    return `${basePath}?${qs.toString()}`;
  };

  let links = "";
  for (let i = 1; i <= totalPages; i += 1) {
    links += `<a class="page-link ${i === page ? "active" : ""}" href="${makeUrl(i)}">${i}</a>`;
  }

  return `<div class="pagination">${links}</div>`;
}

function adminLayout({ title, content, active = "dashboard", adminUser = "admin" }) {
  const navItem = (href, label, key) =>
    `<a class="nav-link ${active === key ? "active" : ""}" href="${href}">${label}</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} | Pochify Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; background: #0b1220; color: #e5e7eb; margin: 0; padding: 0; }
    .shell { max-width: 1280px; margin: 0 auto; padding: 24px; }
    .topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .brand { color: #e5e7eb; text-decoration: none; font-weight: bold; font-size: 24px; }
    .nav { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .nav-link { color: #cbd5e1; text-decoration: none; border: 1px solid #334155; padding: 10px 14px; border-radius: 10px; background: #111827; }
    .nav-link.active { background: #22c55e; color: #04130a; border-color: #22c55e; font-weight: bold; }
    .logout-link { color: #fca5a5; text-decoration: none; border: 1px solid #7f1d1d; padding: 10px 14px; border-radius: 10px; background: #111827; }
    .user-pill { color: #94a3b8; font-size: 13px; padding: 8px 10px; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 18px; margin-bottom: 18px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    input, select, textarea, button { width: 100%; padding: 10px; margin-top: 8px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #e5e7eb; }
    button { background: #22c55e; color: #04130a; font-weight: bold; cursor: pointer; }
    .btn-secondary { background: #0f172a; color: #e5e7eb; }
    .btn-danger { background: #7f1d1d; color: #fff; }
    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn-row button, .btn-row a { width: auto; min-width: 110px; }
    a { color: #93c5fd; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #1f2937; vertical-align: top; font-size: 14px; }
    .muted { color: #94a3b8; }
    .small { font-size: 12px; color: #94a3b8; }
    .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; border: 1px solid #334155; font-size: 12px; white-space: nowrap; }
    .controls { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
    .controls > div { min-width: 180px; flex: 1; }
    .pagination { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
    .page-link { display: inline-block; padding: 8px 12px; border: 1px solid #334155; border-radius: 8px; text-decoration: none; color: #cbd5e1; background: #0f172a; }
    .page-link.active { background: #22c55e; color: #04130a; border-color: #22c55e; font-weight: bold; }
    canvas { background: #fff; border-radius: 12px; padding: 8px; }
    @media (max-width: 900px) { .grid-4, .grid-2 { grid-template-columns: 1fr; } .shell { padding: 16px; } th, td { font-size: 13px; } }
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
        <span class="user-pill">Logged in as ${escapeHtml(adminUser)}</span>
        <a class="logout-link" href="/logout">Logout</a>
      </div>
    </div>
    ${content}
  </div>
</body>
</html>`;
}

function loginPage({ error = "", next = "/admin" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Login | Pochify Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1220; color: #e5e7eb; font-family: Arial, sans-serif; }
    .card { width: min(420px, calc(100vw - 32px)); background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 24px; }
    h1 { margin-top: 0; }
    input, button { width: 100%; padding: 12px; margin-top: 10px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #e5e7eb; box-sizing: border-box; }
    button { background: #22c55e; color: #04130a; font-weight: bold; cursor: pointer; }
    .error { color: #fca5a5; margin-top: 12px; }
    .muted { color: #94a3b8; font-size: 14px; }
    a { color: #93c5fd; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Pochify Admin Login</h1>
    <p class="muted">Sign in to manage opportunities, affiliate links, and posting status.</p>
    <form method="POST" action="/login">
      <input type="hidden" name="next" value="${escapeHtml(next)}" />
      <label>Username</label>
      <input name="username" autocomplete="username" required />
      <label>Password</label>
      <input type="password" name="password" autocomplete="current-password" required />
      <button type="submit">Login</button>
    </form>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <p class="muted" style="margin-top:16px;">
      Back to <a href="${SITE_URL}">Pochify</a>
    </p>
  </div>
</body>
</html>`;
}

app.get("/", (req, res) => {
  res.send("Pochify backend running 🚀");
});

app.get("/api/settings/public", async (req, res) => {
  const settings = await getPublicSettings();
  res.json({ settings });
});

app.get("/login", (req, res) => {
  const next = req.query.next || "/admin";
  res.send(loginPage({ next }));
});

app.post("/login", (req, res) => {
  const username = req.body?.username || "";
  const password = req.body?.password || "";
  const next = req.body?.next || "/admin";

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).send(
      loginPage({
        error: "Invalid credentials",
        next
      })
    );
  }

  const sessionValue = createSessionValue(username);

  res.cookie("pochify_admin_session", sessionValue, {
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
      created_at,
      channel,
      current_price,
      original_price,
      discount_percent,
      offer_type
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
      name,
      slug,
      description,
      hook,
      og_image,
      score,
      click_count,
      channel,
      current_price,
      original_price,
      discount_percent,
      offer_type
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

  const { data: clicks, error: clickError } = await supabase
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

  const { data: deals, error: dealsError } = await supabase
    .from("deals")
    .select(`
      name,
      slug,
      description,
      hook,
      og_image,
      click_count,
      score,
      current_price,
      original_price,
      discount_percent,
      offer_type
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
  try {
    const deals = req.body?.deals || [];
    const maxToSend = req.body?.maxToSend || 2;
    const incomingSettings = req.body?.settings || {};
    const dbSettings = await getPublicSettings();
    const settings = { ...dbSettings, ...incomingSettings };

    if (!Array.isArray(deals)) {
      return res.status(400).json({ error: "Expected deals array" });
    }

    const slugs = deals.map((d) => d.slug);
    const brandKeys = [...new Set(deals.map((d) => d.brand_key).filter(Boolean))];

    const { data: existingDeals, error: existingDealsError } = await supabase
      .from("deals")
      .select("slug, status, brand_key")
      .in("slug", slugs);

    if (existingDealsError) {
      return res.status(500).json({ error: existingDealsError });
    }

    const existingDealMap = new Map((existingDeals || []).map((d) => [d.slug, d]));

    const { data: activePrograms, error: activeProgramsError } = await supabase
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

      const hasDirectPosting =
        settings.allow_stacksocial_direct_posting &&
        d.source === "stacksocial" &&
        !!d.stacksocial_url;

      const needsAffiliateApproval = !!settings.require_affiliate_approval;

      if (!needsAffiliateApproval && hasDirectPosting) {
        status = "ready_to_post";
      } else if (activeBrandKeys.has(d.brand_key) || d.affiliateLink) {
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
        stacksocial_url: d.stacksocial_url || null,
        vendor_url: d.vendor_url || null,
        affiliate_link: d.affiliateLink || null,
        affiliate_url: d.affiliate_url || null,
        affiliate_detected: !!d.affiliate_detected,
        network_guess: d.network_guess || guessNetwork(d.name, d.description),
        page_url: d.page_url || `${SITE_URL}/deals/${d.slug}.html`,
        source: d.source || "unknown",
        channel: d.channel || "general",
        votes_count: d.votes_count || 0,
        score: d.score || 0,
        current_price: d.current_price || null,
        original_price: d.original_price || null,
        discount_percent: d.discount_percent || null,
        offer_type: d.offer_type || null,
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

    const { error: upsertError } = await supabase
      .from("deals")
      .upsert(formattedDeals, { onConflict: "slug" });

    if (upsertError) {
      console.error("❌ Supabase deal upsert error:", upsertError);
      return res.status(500).json({ error: upsertError });
    }

    if (settings.require_affiliate_approval) {
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
        const { error: oppError } = await supabase
          .from("affiliate_opportunities")
          .upsert(opportunityRows, { onConflict: "brand_key" });

        if (oppError) {
          console.error("❌ affiliate opportunities upsert error:", oppError);
          return res.status(500).json({ error: oppError });
        }
      }
    }

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

    return res.json({
      success: true,
      sendCandidates
    });
  } catch (error) {
    console.error("❌ /api/deals/ingest fatal error:", error);
    return res.status(500).json({
      error: error?.message || "Unknown ingest error"
    });
  }
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

  return res.redirect(targetUrl || SITE_URL);
});

/* Keep your existing /admin routes below this line exactly as they are if already working.
   They do not need major changes for this phase. */

app.listen(PORT, () => {
  console.log("🚀 Server running");
});
