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

  if (text.includes("partnerstack")) return "partnerstack";
  if (text.includes("design") || text.includes("ecommerce") || text.includes("cj")) return "cj";
  if (text.includes("b2b") || text.includes("saas") || text.includes("software") || text.includes("impact")) return "impact";
  return "unknown";
}

function isEligibleToSend(deal) {
  if (["awaiting_link", "discovered", "rejected"].includes(deal.status || "")) {
    return false;
  }

  if (!deal.last_posted_at) {
    return deal.status === "ready_to_post";
  }

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

  const query = supabase
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

  const { data, error } =
    currentDeal.channel === "ai" || currentDeal.channel === "saas"
      ? await query.eq("channel", currentDeal.channel)
      : await query;

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
  const deals = req.body?.deals || [];
  const maxToSend = req.body?.maxToSend || 2;

  if (!Array.isArray(deals)) {
    return res.status(400).json({ error: "Expected deals array" });
  }

  const slugs = deals.map((d) => d.slug);

  const { data: existingDeals, error: existingDealsError } = await supabase
    .from("deals")
    .select("slug, status, brand_key")
    .in("slug", slugs);

  if (existingDealsError) {
    return res.status(500).json({ error: existingDealsError });
  }

  const existingDealMap = new Map((existingDeals || []).map((d) => [d.slug, d]));

  const brandKeys = [...new Set(deals.map((d) => d.brand_key).filter(Boolean))];

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

  return res.redirect(targetUrl || "https://pochify.com");
});

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  const [{ count: dealsCount }, { count: oppCount }, { count: affCount }, { count: clickCount }] =
    await Promise.all([
      supabase.from("deals").select("*", { count: "exact", head: true }),
      supabase.from("affiliate_opportunities").select("*", { count: "exact", head: true }),
      supabase.from("affiliate_programs").select("*", { count: "exact", head: true }),
      supabase.from("click_events").select("*", { count: "exact", head: true })
    ]);

  const { data: topDeals } = await supabase
    .from("deals")
    .select("name, slug, click_count, post_count, score, status")
    .order("click_count", { ascending: false })
    .limit(10);

  const { data: latestOpps } = await supabase
    .from("affiliate_opportunities")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(10);

  res.json({
    summary: {
      deals: dealsCount || 0,
      opportunities: oppCount || 0,
      affiliates: affCount || 0,
      clicks: clickCount || 0
    },
    topDeals: topDeals || [],
    latestOpportunities: latestOpps || []
  });
});

app.get("/api/admin/opportunities", requireAdmin, async (req, res) => {
  const { data, error } = await supabase
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
    .limit(50);

  if (error) {
    return res.status(500).json({ error });
  }

  const items = [];
  for (const row of data || []) {
    const { data: deal } = await supabase
      .from("deals")
      .select("click_count, status")
      .eq("brand_key", row.brand_key)
      .order("click_count", { ascending: false })
      .limit(1)
      .maybeSingle();

    items.push({
      ...row,
      click_count: deal?.click_count || 0,
      deal_status: deal?.status || ""
    });
  }

  res.json({ items });
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
  const payload = req.body;

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
    .in("status", ["awaiting_link", "discovered"]);

  res.json({ success: true });
});

app.get("/admin", requireAdmin, (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Pochify Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; background:#0b1220; color:#e5e7eb; margin:0; padding:24px; }
    .wrap { max-width:1200px; margin:0 auto; }
    .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
    .card { background:#111827; border:1px solid #1f2937; border-radius:14px; padding:18px; margin-bottom:18px; }
    input, select, textarea, button {
      width:100%; padding:10px; margin-top:8px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#e5e7eb;
    }
    button { background:#22c55e; color:#04130a; font-weight:bold; cursor:pointer; }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; padding:8px; border-bottom:1px solid #1f2937; vertical-align:top; }
    h1,h2 { margin-top:0; }
    canvas { background:#fff; border-radius:12px; padding:8px; }
    a { color:#93c5fd; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Pochify Admin</h1>

    <div class="grid" id="summary"></div>

    <div class="card">
      <h2>Top Clicked Deals</h2>
      <canvas id="topDealsChart"></canvas>
    </div>

    <div class="card">
      <h2>Add / Update Affiliate Program</h2>
      <p>Saving an affiliate program will automatically move matching deals toward ready-to-post.</p>
      <form id="affiliateForm">
        <input name="brand_key" placeholder="brand_key e.g. pyxaai" required />
        <input name="display_name" placeholder="Display name" />
        <input name="network" placeholder="impact / cj / partnerstack / rewardful" required />
        <input name="tracking_url" placeholder="Tracking URL" />
        <input name="deeplink_template" placeholder="Deep link template (optional)" />
        <select name="deeplink_supported">
          <option value="false">Deep link supported: No</option>
          <option value="true">Deep link supported: Yes</option>
        </select>
        <select name="status">
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <button type="submit">Save Affiliate Program</button>
      </form>
    </div>

    <div class="card">
      <h2>Affiliate Opportunities</h2>
      <table>
        <thead>
          <tr>
            <th>Brand</th>
            <th>Network</th>
            <th>Affiliate Page</th>
            <th>Clicks</th>
            <th>Status</th>
            <th>Deal Status</th>
          </tr>
        </thead>
        <tbody id="oppRows"></tbody>
      </table>
    </div>
  </div>

<script>
async function loadStats() {
  const res = await fetch('/api/admin/stats');
  const data = await res.json();

  const summary = data.summary;
  document.getElementById('summary').innerHTML = \`
    <div class="card"><h2>\${summary.deals}</h2><div>Deals</div></div>
    <div class="card"><h2>\${summary.opportunities}</h2><div>Opportunities</div></div>
    <div class="card"><h2>\${summary.affiliates}</h2><div>Affiliates</div></div>
    <div class="card"><h2>\${summary.clicks}</h2><div>Clicks</div></div>
  \`;

  const labels = (data.topDeals || []).map(d => d.name);
  const values = (data.topDeals || []).map(d => d.click_count || 0);

  new Chart(document.getElementById('topDealsChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Clicks', data: values }]
    },
    options: { responsive: true }
  });
}

async function loadOpportunities() {
  const res = await fetch('/api/admin/opportunities');
  const data = await res.json();

  const rows = (data.items || []).map(o => \`
    <tr>
      <td>
        <strong>\${o.display_name || o.brand_key}</strong><br/>
        <small>\${o.brand_key}</small>
      </td>
      <td>\${o.network_guess || ''}</td>
      <td>\${o.affiliate_url ? '<a href="' + o.affiliate_url + '" target="_blank" rel="noopener">Open</a>' : '-'}</td>
      <td>\${o.click_count || 0}</td>
      <td>\${o.status || ''}</td>
      <td>\${o.deal_status || ''}</td>
    </tr>
  \`).join('');

  document.getElementById('oppRows').innerHTML = rows;
}

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
    loadOpportunities();
    loadStats();
  } else {
    alert('Failed');
    console.error(data);
  }
});

loadStats();
loadOpportunities();
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log("🚀 Server runnin");
});
