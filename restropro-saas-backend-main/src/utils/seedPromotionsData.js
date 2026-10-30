const mysql = require("mysql2/promise");
require("dotenv").config({ path: __dirname + "/../../.env" });

async function seedPromotions() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "restro",
    password: process.env.MYSQL_PASSWORD || "restropass",
    database: process.env.MYSQL_DATABASE || "restropro_saas",
  });

  console.log("Connected to MySQL for seeding promotions data...");

  const tenantsToSeed = [721, 722, 723];

  const samplePromotions = [
    {
      title: "Afternoon Happy Hour 20%",
      description: "20% off all orders placed between 12:00 PM and 11:59 PM every day",
      promo_code: null,
      promo_type: "ORDER_PERCENTAGE",
      discount_value: 20.0,
      max_discount_cap: 10.0,
      min_order_amount: 0.0,
      apply_to: "ALL",
      target_category_ids: null,
      target_item_ids: null,
      buy_qty: null,
      get_qty: null,
      get_discount_percent: null,
      is_automatic: 1,
      is_stackable: 0,
      dining_options: JSON.stringify(["dinein", "takeaway", "delivery"]),
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      start_time: "12:00:00",
      end_time: "23:59:00",
      days_of_week: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
      usage_limit_total: 500,
      times_redeemed: 47,
      is_active: 1,
    },
    {
      title: "Buy 1 Get 1 Free (BOGO Treat)",
      description: "Buy 1 item, get the second item 100% Free!",
      promo_code: "BOGO",
      promo_type: "BOGO",
      discount_value: 0.0,
      max_discount_cap: null,
      min_order_amount: 0.0,
      apply_to: "ALL",
      target_category_ids: null,
      target_item_ids: null,
      buy_qty: 1,
      get_qty: 1,
      get_discount_percent: 100.0,
      is_automatic: 0,
      is_stackable: 0,
      dining_options: JSON.stringify(["dinein", "takeaway", "delivery"]),
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      start_time: null,
      end_time: null,
      days_of_week: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
      usage_limit_total: 200,
      times_redeemed: 32,
      is_active: 1,
    },
    {
      title: "Spend $25 Save $5",
      description: "Spend $25 or more and receive an instant $5 discount off your total bill",
      promo_code: null,
      promo_type: "ORDER_FIXED",
      discount_value: 5.0,
      max_discount_cap: null,
      min_order_amount: 25.0,
      apply_to: "ALL",
      target_category_ids: null,
      target_item_ids: null,
      buy_qty: null,
      get_qty: null,
      get_discount_percent: null,
      is_automatic: 1,
      is_stackable: 1,
      dining_options: JSON.stringify(["dinein", "takeaway", "delivery"]),
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      start_time: null,
      end_time: null,
      days_of_week: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
      usage_limit_total: null,
      times_redeemed: 68,
      is_active: 1,
    },
    {
      title: "VIP Loyalty Voucher $10 Off",
      description: "Exclusive $10 voucher code for VIP members on orders over $30",
      promo_code: "VIP10",
      promo_type: "ORDER_FIXED",
      discount_value: 10.0,
      max_discount_cap: null,
      min_order_amount: 30.0,
      apply_to: "ALL",
      target_category_ids: null,
      target_item_ids: null,
      buy_qty: null,
      get_qty: null,
      get_discount_percent: null,
      is_automatic: 0,
      is_stackable: 1,
      dining_options: JSON.stringify(["dinein", "takeaway"]),
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      start_time: null,
      end_time: null,
      days_of_week: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
      usage_limit_total: 100,
      times_redeemed: 19,
      is_active: 1,
    },
    {
      title: "Super Saver 15% Off (Code: SAVE15)",
      description: "Enjoy 15% off your entire order with code SAVE15 (Capped at $8.00)",
      promo_code: "SAVE15",
      promo_type: "ORDER_PERCENTAGE",
      discount_value: 15.0,
      max_discount_cap: 8.0,
      min_order_amount: 10.0,
      apply_to: "ALL",
      target_category_ids: null,
      target_item_ids: null,
      buy_qty: null,
      get_qty: null,
      get_discount_percent: null,
      is_automatic: 0,
      is_stackable: 0,
      dining_options: JSON.stringify(["dinein", "takeaway", "delivery"]),
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      start_time: null,
      end_time: null,
      days_of_week: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
      usage_limit_total: 300,
      times_redeemed: 52,
      is_active: 1,
    },
    {
      title: "Weekend Feast Deal $3 Off",
      description: "$3 instant discount on weekends (Saturday & Sunday) for all guests",
      promo_code: null,
      promo_type: "ORDER_FIXED",
      discount_value: 3.0,
      max_discount_cap: null,
      min_order_amount: 15.0,
      apply_to: "ALL",
      target_category_ids: null,
      target_item_ids: null,
      buy_qty: null,
      get_qty: null,
      get_discount_percent: null,
      is_automatic: 1,
      is_stackable: 1,
      dining_options: JSON.stringify(["dinein", "takeaway"]),
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      start_time: null,
      end_time: null,
      days_of_week: JSON.stringify([6, 7]),
      usage_limit_total: null,
      times_redeemed: 24,
      is_active: 1,
    },
  ];

  for (const tenantId of tenantsToSeed) {
    // Check existing count for this tenant
    const [existing] = await connection.query(
      "SELECT COUNT(*) as count FROM promotions WHERE tenant_id = ?",
      [tenantId]
    );

    if (existing[0].count > 0) {
      console.log(`Tenant ${tenantId} already has ${existing[0].count} promotions. Skipping.`);
      continue;
    }

    console.log(`Seeding 6 promotions for tenant ${tenantId}...`);

    for (const p of samplePromotions) {
      await connection.query(
        `INSERT INTO promotions (
          tenant_id, title, description, promo_code, promo_type,
          discount_value, max_discount_cap, min_order_amount,
          apply_to, target_category_ids, target_item_ids,
          buy_qty, get_qty, get_discount_percent,
          is_automatic, is_stackable, dining_options,
          start_date, end_date, start_time, end_time,
          days_of_week, usage_limit_total, times_redeemed, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          p.title,
          p.description,
          p.promo_code,
          p.promo_type,
          p.discount_value,
          p.max_discount_cap,
          p.min_order_amount,
          p.apply_to,
          p.target_category_ids,
          p.target_item_ids,
          p.buy_qty,
          p.get_qty,
          p.get_discount_percent,
          p.is_automatic,
          p.is_stackable,
          p.dining_options,
          p.start_date,
          p.end_date,
          p.start_time,
          p.end_time,
          p.days_of_week,
          p.usage_limit_total,
          p.times_redeemed,
          p.is_active,
        ]
      );
    }

    console.log(`Seeded promotions for tenant ${tenantId} successfully!`);
  }

  await connection.end();
  console.log("Seeding complete!");
}

seedPromotions().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
