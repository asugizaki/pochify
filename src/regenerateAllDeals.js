import { createClient } from "@supabase/supabase-js";
import { generateDealPage } from "./generateDealPage.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("🔄 Regenerating ALL deal pages from DB...");

  let page = 0;
  const pageSize = 1000;
  let total = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("❌ DB fetch error:", error);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    console.log(`📦 Processing batch ${page + 1} (${data.length} deals)`);

    for (const deal of data) {
      try {
        generateDealPage(deal);
        total++;
      } catch (err) {
        console.error(`❌ Failed to generate: ${deal.slug}`, err);
      }
    }

    if (data.length < pageSize) break;
    page++;
  }

  console.log(`✅ Done. Regenerated ${total} deal pages.`);
}

run();
