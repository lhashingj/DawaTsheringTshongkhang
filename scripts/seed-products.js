// One-time script to migrate products from data/db.json into Supabase.
// Run once after creating the products table:
//   node scripts/seed-products.js
//
// Requires .env.local with:
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...

const { readFileSync } = require("fs");
const path = require("path");

async function main() {
  // Load env vars from .env.local
  try {
    const env = readFileSync(path.join(__dirname, "..", ".env.local"), "utf-8");
    for (const line of env.split("\n")) {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
    }
  } catch {
    // .env.local not found — rely on existing env
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "placeholder") {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    process.exit(1);
  }

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, key);

  const { products } = JSON.parse(
    readFileSync(path.join(__dirname, "..", "data", "db.json"), "utf-8")
  );

  console.log(`Seeding ${products.length} products into Supabase...`);

  // upsert in batches of 50
  for (let i = 0; i < products.length; i += 50) {
    const batch = products.slice(i, i + 50);
    const { error } = await supabase.from("products").upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`❌ Error on batch ${i / 50 + 1}:`, error.message);
      process.exit(1);
    }
    console.log(`  ✓ Batch ${i / 50 + 1} done (${batch.length} products)`);
  }

  console.log("✅ All products seeded successfully.");
}

main().catch((err) => { console.error(err); process.exit(1); });
