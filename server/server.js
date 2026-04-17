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
      align-items: center;
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
    .logout-link {
      color: #fca5a5;
      text-decoration: none;
      border: 1px solid #7f1d1d;
      padding: 10px 14px;
      border-radius: 10px;
      background: #111827;
    }
    .user-pill {
      color: #94a3b8;
      font-size: 13px;
      padding: 8px 10px;
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
    .pagination {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .page-link {
      display: inline-block;
      padding: 8px 12px;
      border: 1px solid #334155;
      border-radius: 8px;
      text-decoration: none;
      color: #cbd5e1;
      background: #0f172a;
    }
    .page-link.active {
      background: #22c55e;
      color: #04130a;
      border-color: #22c55e;
      font-weight: bold;
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
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #0b1220;
      color: #e5e7eb;
      font-family: Arial, sans-serif;
    }
    .card {
      width: min(420px, calc(100vw - 32px));
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 24px;
    }
    h1 {
      margin-top: 0;
    }
    input, button {
      width: 100%;
      padding: 12px;
      margin-top: 10px;
      border-radius: 10px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #e5e7eb;
      box-sizing: border-box;
    }
    button {
      background: #22c55e;
      color: #04130a;
      font-weight: bold;
      cursor: pointer;
    }
    .error {
      color: #fca5a5;
      margin-top: 12px;
    }
    .muted {
      color: #94a3b8;
      font-size: 14px;
    }
    a {
      color: #93c5fd;
    }
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

  if (status) {
    query = query.eq("status", status);
  }

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
      last_posted_at
    `)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (status) {
    query = query.eq("status", status);
  }

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

app.get("/", (req, res) => {
  res.send("Pochify backend running 🚀");
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
  try {
    const deals = req.body?.deals || [];
    const maxToSend = req.body?.maxToSend || 2;

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
      
      if (activeBrandKeys.has(d.brand_key) || d.affiliateLink) {
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

    const { error: upsertError } = await supabase
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
      const { error: oppError } = await supabase
        .from("affiliate_opportunities")
        .upsert(opportunityRows, { onConflict: "brand_key" });

      if (oppError) {
        console.error("❌ affiliate opportunities upsert error:", oppError);
        return res.status(500).json({ error: oppError });
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

  res.send(adminLayout({
    title: "Dashboard",
    content,
    active: "dashboard",
    adminUser: req.adminUser
  }));
});

app.get("/admin/opportunities", requireAdmin, async (req, res) => {
  const q = req.query.q || "";
  const status = req.query.status || "";
  const page = getPageParam(req.query.page, 1);

  const rows = await loadOpportunityRows({ q, status });
  const paged = paginateArray(rows, page, DEFAULT_PAGE_SIZE);

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
      <p class="small">Showing ${paged.items.length} of ${paged.total} records</p>
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
        <tbody>
          ${paged.items
            .map(
              (o) => `
              <tr id="opp-row-${escapeHtml(o.brand_key)}">
                <td><input class="bulk-box" type="checkbox" value="${escapeHtml(o.brand_key)}" /></td>
                <td>
                  <strong>${escapeHtml(o.display_name || o.brand_key)}</strong><br/>
                  <span class="small">${escapeHtml(o.brand_key)}</span>
                </td>
                <td><span class="pill">${escapeHtml(o.network_guess || "")}</span></td>
                <td>${o.affiliate_url ? `<a href="${o.affiliate_url}" target="_blank" rel="noopener">Signup</a>` : "-"}</td>
                <td>${o.page_url ? `<a href="${o.page_url}" target="_blank" rel="noopener">Open</a>` : "-"}</td>
                <td>${o.click_count || 0}</td>
                <td><span class="pill js-opp-status">${escapeHtml(o.status || "")}</span></td>
                <td><span class="pill js-deal-status">${escapeHtml(o.deal_status || "")}</span></td>
                <td>
                  <div class="btn-row">
                    <button onclick="updateOpportunityStatus('${escapeHtml(o.brand_key)}', 'applied')">Applied</button>
                    <button onclick="updateOpportunityStatus('${escapeHtml(o.brand_key)}', 'approved')">Approve</button>
                    <button class="btn-secondary" onclick="window.location.href='/admin/affiliate-programs?brand_key=${encodeURIComponent(o.brand_key)}&display_name=${encodeURIComponent(o.display_name || "")}&network=${encodeURIComponent(o.network_guess || "")}'">Add Link</button>
                    <button class="btn-secondary" onclick="updateOpportunityStatus('${escapeHtml(o.brand_key)}', 'ignore')">Ignore</button>
                    <button class="btn-danger" onclick="updateOpportunityStatus('${escapeHtml(o.brand_key)}', 'rejected')">Reject</button>
                  </div>
                </td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>

      ${adminPaginationHtml({
        page: paged.page,
        totalPages: paged.totalPages,
        basePath: "/admin/opportunities",
        params: { q, status }
      })}
    </div>

    <script>
      function applyFilters() {
        const q = encodeURIComponent(document.getElementById('searchInput').value || '');
        const status = encodeURIComponent(document.getElementById('statusFilter').value || '');
        window.location.href = '/admin/opportunities?q=' + q + '&status=' + status + '&page=1';
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
        if (!data.success) {
          alert('Update failed');
          console.error(data);
          return;
        }

        const row = document.getElementById('opp-row-' + CSS.escape(brandKey));
        if (row) {
          const oppStatus = row.querySelector('.js-opp-status');
          const dealStatus = row.querySelector('.js-deal-status');
          if (oppStatus) oppStatus.textContent = status;
          if (dealStatus && status === 'approved') dealStatus.textContent = 'ready_to_post';
          if (dealStatus && (status === 'rejected' || status === 'ignore')) dealStatus.textContent = 'rejected';
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
        if (!data.success) {
          alert('Bulk update failed');
          console.error(data);
          return;
        }

        window.location.reload();
      }
    </script>
  `;

  res.send(adminLayout({
    title: "Opportunities",
    content,
    active: "opportunities",
    adminUser: req.adminUser
  }));
});

app.get("/admin/deals", requireAdmin, async (req, res) => {
  const q = req.query.q || "";
  const status = req.query.status || "";
  const page = getPageParam(req.query.page, 1);

  const rows = await loadDealRows({ q, status });
  const paged = paginateArray(rows, page, DEFAULT_PAGE_SIZE);

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
      <p class="small">Showing ${paged.items.length} of ${paged.total} records</p>
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
        <tbody>
          ${paged.items
            .map(
              (d) => `
              <tr id="deal-row-${escapeHtml(d.slug)}">
                <td><input class="bulk-box" type="checkbox" value="${escapeHtml(d.slug)}" /></td>
                <td>
                  <strong>${escapeHtml(d.name)}</strong><br/>
                  <span class="small">${escapeHtml(d.slug)}</span>
                </td>
                <td><span class="pill js-deal-status">${escapeHtml(d.status || "")}</span></td>
                <td>${d.score || 0}</td>
                <td>${d.click_count || 0}</td>
                <td>${d.post_count || 0}</td>
                <td>${d.affiliate_link ? "✅ link" : d.affiliate_detected ? "🟡 detected" : "—"}</td>
                <td>${d.page_url ? `<a href="${d.page_url}" target="_blank" rel="noopener">Open</a>` : "-"}</td>
                <td>
                  <div class="btn-row">
                    <button onclick="updateDealStatus('${escapeHtml(d.slug)}', 'ready_to_post')">Ready</button>
                    <button class="btn-secondary" onclick="updateDealStatus('${escapeHtml(d.slug)}', 'hold')">Hold</button>
                    <button class="btn-danger" onclick="updateDealStatus('${escapeHtml(d.slug)}', 'rejected')">Reject</button>
                  </div>
                </td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>

      ${adminPaginationHtml({
        page: paged.page,
        totalPages: paged.totalPages,
        basePath: "/admin/deals",
        params: { q, status }
      })}
    </div>

    <script>
      function applyFilters() {
        const q = encodeURIComponent(document.getElementById('searchInput').value || '');
        const status = encodeURIComponent(document.getElementById('statusFilter').value || '');
        window.location.href = '/admin/deals?q=' + q + '&status=' + status + '&page=1';
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
        if (!data.success) {
          alert('Update failed');
          console.error(data);
          return;
        }

        const row = document.getElementById('deal-row-' + CSS.escape(slug));
        if (row) {
          const statusEl = row.querySelector('.js-deal-status');
          if (statusEl) statusEl.textContent = status;
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
        if (!data.success) {
          alert('Bulk update failed');
          console.error(data);
          return;
        }

        window.location.reload();
      }
    </script>
  `;

  res.send(adminLayout({
    title: "Deals",
    content,
    active: "deals",
    adminUser: req.adminUser
  }));
});

app.get("/admin/affiliate-programs", requireAdmin, async (req, res) => {
  const brandKey = req.query.brand_key || "";
  const displayName = req.query.display_name || "";
  const network = req.query.network || "";
  const page = getPageParam(req.query.page, 1);

  const { data: allPrograms, error } = await supabase
    .from("affiliate_programs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).send("Failed to load affiliate programs");
  }

  const paged = paginateArray(allPrograms || [], page, DEFAULT_PAGE_SIZE);

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
      <p class="small">Showing ${paged.items.length} of ${paged.total} records</p>
      <table>
        <thead>
          <tr>
            <th>Brand</th>
            <th>Network</th>
            <th>Status</th>
            <th>Tracking</th>
          </tr>
        </thead>
        <tbody>
          ${paged.items
            .map(
              (p) => `
              <tr>
                <td><strong>${escapeHtml(p.display_name || p.brand_key)}</strong><br/><span class="small">${escapeHtml(p.brand_key)}</span></td>
                <td>${escapeHtml(p.network || "")}</td>
                <td><span class="pill">${escapeHtml(p.status || "")}</span></td>
                <td>${p.tracking_url ? `<a href="${p.tracking_url}" target="_blank" rel="noopener">Open</a>` : "-"}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>

      ${adminPaginationHtml({
        page: paged.page,
        totalPages: paged.totalPages,
        basePath: "/admin/affiliate-programs",
        params: {}
      })}
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
          window.location.href = '/admin/affiliate-programs';
        } else {
          alert('Failed');
          console.error(data);
        }
      });
    </script>
  `;

  res.send(adminLayout({
    title: "Affiliate Programs",
    content,
    active: "affiliate-programs",
    adminUser: req.adminUser
  }));
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

  res.send(adminLayout({
    title: "Analytics",
    content,
    active: "analytics",
    adminUser: req.adminUser
  }));
});

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  const data = await getSummaryStats();

  const { data: topDeals } = await supabase
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
    res.status(500).json({ error: error?.message || "Failed to load opportunities" });
  }
});

app.post("/api/admin/opportunities/status", requireAdmin, async (req, res) => {
  const { brand_keys = [], status } = req.body || {};

  if (!Array.isArray(brand_keys) || brand_keys.length === 0 || !status) {
    return res.status(400).json({ error: "brand_keys array and status are required" });
  }

  const { error } = await supabase
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
    await supabase
      .from("deals")
      .update({
        status: "ready_to_post",
        updated_at: new Date().toISOString()
      })
      .in("brand_key", brand_keys)
      .in("status", ["awaiting_link", "discovered", "hold"]);
  }

  if (status === "rejected" || status === "ignore") {
    await supabase
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
    res.status(500).json({ error: error?.message || "Failed to load deals" });
  }
});

app.post("/api/admin/deals/status", requireAdmin, async (req, res) => {
  const { slugs = [], status } = req.body || {};

  if (!Array.isArray(slugs) || slugs.length === 0 || !status) {
    return res.status(400).json({ error: "slugs array and status are required" });
  }

  const { error } = await supabase
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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

  const { error } = await supabase
    .from("affiliate_programs")
    .upsert(row, { onConflict: "brand_key" });

  if (error) {
    return res.status(500).json({ error });
  }

  await supabase
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

  await supabase
    .from("deals")
    .update({
      status: "ready_to_post",
      updated_at: new Date().toISOString()
    })
    .eq("brand_key", payload.brand_key)
    .in("status", ["awaiting_link", "discovered", "hold"]);

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log("🚀 Server running");
});
