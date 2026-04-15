import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase environment variables");
  console.error("SUPABASE_URL:", process.env.SUPABASE_URL);
  console.error(
    "SUPABASE_KEY exists:",
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =========================
// HEALTH CHECK
// =========================
app.get("/", (req, res) => {
  res.send("Pochify backend running 🚀");
});

// =========================
// SAVE / SYNC DEALS
// =========================
app.post("/api/deals", async (req, res) => {
  const deals = req.body;

  if (!Array.isArray(deals)) {
    return res.status(400).json({
      error: "Expected an array of deals",
    });
  }

  console.log("📥 /api/deals received:", JSON.stringify(deals, null, 2));

  const formattedDeals = deals.map((d) => ({
    name: d.name,
    slug: d.slug,
    description: d.description || "",
    url: d.url || "",
    affiliate_link: d.affiliateLink || null,
  }));

  const { error } = await supabase
    .from("deals")
    .upsert(formattedDeals, { onConflict: "slug" });

  if (error) {
    console.error("❌ Supabase insert error:", error);
    return res.status(500).json({ error });
  }

  console.log(`💾 Saved deals: ${formattedDeals.length}`);
  console.log("🧪 SAMPLE SLUGS:", formattedDeals.map((d) => d.slug));

  res.json({ success: true });
});

// =========================
// REDIRECT ROUTE
// =========================
app.get("/go/:slug", async (req, res) => {
  const slug = req.params.slug;

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    console.log("❌ Deal not found:", slug, error || "");
    return res.redirect("https://pochify.com");
  }

  const targetUrl = data.affiliate_link || data.url || "https://pochify.com";

  console.log(`✅ Redirect: ${slug} → ${targetUrl}`);

  return res.redirect(targetUrl);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
