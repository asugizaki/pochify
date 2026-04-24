import { createClient } from "@supabase/supabase-js";
import slugify from "slugify";
import readline from "readline";
import { generateDealPage } from "./generateDealPage.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve =>
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    })
  );
}

async function run() {
  console.log("🚀 Create manual deal\n");

  const name = await ask("Name: ");
  const url = await ask("Affiliate URL: ");
  const price = await ask("Current price: ");
  const original = await ask("Original price: ");
  const description = await ask("Short description: ");
  const image = await ask("Image URL: ");

  const slug = slugify(name, { lower: true, strict: true });

  const discount =
    original && price
      ? Math.round((1 - price / original) * 100)
      : null;

  const deal = {
    name,
    slug,
    vendor_url: url,
    current_price: price || null,
    original_price: original || null,
    discount_percent: discount,
    description,
    og_image: image,
    card_image: image,
    source_name: "direct",
    category: "ai",
    status: "published",
    created_at: new Date().toISOString()
  };

  console.log("\n💾 Saving to DB...");
  const { error } = await supabase.from("deals").insert(deal);

  if (error) {
    console.error("❌ DB error:", error);
    return;
  }

  console.log("📄 Generating page...");
  generateDealPage(deal);

  console.log("✅ Done:", slug);
}

run();
