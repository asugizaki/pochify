import { createClient } from "@supabase/supabase-js";
import { generateDealPage, ensureShellPages, generateRobotsTxtIfMissing, generateSitemapFromDeals } from "./generateDealPage.js";
import { CURRENT_LAYOUT_VERSION } from "./layoutVersion.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PAGE_SIZE = 500;
const CONCURRENCY = 12;

async function fetchAllDeals() {
  const allDeals = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) break;

    allDeals.push(...data);
    console.log(`📦 Loaded DB batch ${page + 1}: ${data.length} deals`);

    if (data.length < PAGE_SIZE) break;
    page += 1;
  }

  return allDeals;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const current = index++;
      if (current >= items.length) break;

      try {
        results[current] = await mapper(items[current], current);
      } catch (error) {
        results[current] = { ok: false, error };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

async function updateLayoutVersions(slugs) {
  if (!slugs.length) return;

  const { error } = await supabase
    .from("deals")
    .update({
      layout_version: CURRENT_LAYOUT_VERSION,
      updated_at: new Date().toISOString()
    })
    .in("slug", slugs);

  if (error) {
    throw error;
  }
}

async function run() {
  console.log("🔄 Regenerating all deal pages from DB...");
  console.log(`🧱 Current layout version: ${CURRENT_LAYOUT_VERSION}`);

  ensureShellPages();
  generateRobotsTxtIfMissing();

  const deals = await fetchAllDeals();
  console.log(`📚 Total deals loaded: ${deals.length}`);

  const results = await mapLimit(deals, CONCURRENCY, async (deal) => {
    generateDealPage(deal);
    return { ok: true, slug: deal.slug };
  });

  const successSlugs = results.filter((r) => r?.ok).map((r) => r.slug);
  const failures = results.filter((r) => r && !r.ok);

  console.log(`✅ Regenerated: ${successSlugs.length}`);
  if (failures.length) {
    console.log(`❌ Failed: ${failures.length}`);
    failures.slice(0, 20).forEach((f, i) => {
      console.error(`  ${i + 1}.`, f.error);
    });
  }

  await updateLayoutVersions(successSlugs);
  await generateSitemapFromDeals(deals);

  console.log("🏁 Full regeneration complete");
}

run().catch((error) => {
  console.error("❌ regenerateAllDeals fatal error:", error);
  process.exit(1);
});
