/**
 * Seed Starbucks Coffee Demo Data for Bong POS
 * Configured for Tenant 721 (demo@demo.com)
 */

const mysql = require('mysql2/promise');

async function seed() {
  const host = process.env.DB_HOST || 'db';
  const user = process.env.DB_USER || 'restro';
  const password = process.env.DB_PASSWORD || 'restropass';
  const database = process.env.DB_NAME || 'restropro_saas';
  const tenantId = 721;

  console.log(`Connecting to MySQL at ${host}:3306...`);
  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database,
    multipleStatements: true,
  });

  console.log('Connected successfully!');

  try {
    // 1. Update Tenant Name
    console.log('[1/10] Updating Tenant and Store branding...');
    await conn.query(
      `UPDATE tenants SET name = ? WHERE id = ?`,
      ['Starbucks Coffee', tenantId]
    );

    // Update Store Details
    await conn.query(
      `UPDATE store_details 
       SET store_name = ?,
           address = ?,
           phone = ?,
           email = ?,
           currency = ?,
           exchange_rate_usd_to_khr = ?,
           pos_payment_mode = ?,
           is_qr_menu_enabled = 1,
           is_qr_order_enabled = 1,
           is_feedback_enabled = 1,
           store_image = ?
       WHERE tenant_id = ?`,
      [
        'Starbucks Coffee - BKK Flagship',
        'No. 57, Street 288, Boeung Keng Kang 1 (BKK1)\nPhnom Penh 12302, Cambodia',
        '+855 23 987 654',
        'reserve.bkk@starbucks.com.kh',
        'USD',
        4100.00,
        'flexible',
        'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80',
        tenantId,
      ]
    );

    // Update User Name
    await conn.query(
      `UPDATE users 
       SET name = ?, designation = ?
       WHERE tenant_id = ? AND username = ?`,
      ['Starbucks Store Manager', 'Store Manager', tenantId, 'demo@demo.com']
    );

    // 2. Clean up existing tenant data (respecting foreign key relationships)
    console.log('[2/10] Cleaning existing tenant 721 data...');
    await conn.query(`DELETE FROM feedbacks WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM invoice_audit_log WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM order_items WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM orders WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM invoices WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM qr_order_items WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM qr_orders WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM menu_item_recipes WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM menu_item_addons WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM menu_item_variants WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM menu_items WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM categories WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM kitchen_stations WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM store_tables WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM store_floor_layouts WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM payment_types WHERE tenant_id = ?`, [tenantId]);
    await conn.query(`DELETE FROM customers WHERE tenant_id = ?`, [tenantId]);

    // 3. Insert Kitchen Stations
    console.log('[3/10] Creating Starbucks Kitchen Stations (KDS)...');
    const stations = [
      { name: 'Espresso Bar', color: '#006241', icon: 'Coffee', sort_order: 1 },
      { name: 'Cold Bar & Frappuccino', color: '#0284c7', icon: 'CupSoda', sort_order: 2 },
      { name: 'Bakery & Food Warming', color: '#d97706', icon: 'Flame', sort_order: 3 },
    ];

    const stationMap = {};
    for (const st of stations) {
      const [res] = await conn.query(
        `INSERT INTO kitchen_stations (tenant_id, name, color, icon, is_enabled, sort_order)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [tenantId, st.name, st.color, st.icon, st.sort_order]
      );
      stationMap[st.name] = res.insertId;
    }
    console.log('Created stations:', stationMap);

    // 4. Insert Categories
    console.log('[4/10] Creating Starbucks Categories...');
    const categoriesData = [
      { title: 'Hot Coffees & Espresso', station: 'Espresso Bar' },
      { title: 'Cold Coffees & Cold Brew', station: 'Cold Bar & Frappuccino' },
      { title: 'Frappuccino® Blended', station: 'Cold Bar & Frappuccino' },
      { title: 'Teas & Refreshers', station: 'Cold Bar & Frappuccino' },
      { title: 'Bakery & Breakfast', station: 'Bakery & Food Warming' },
      { title: 'Sandwiches & Savory', station: 'Bakery & Food Warming' },
      { title: 'Starbucks Reserve & Beans', station: 'Espresso Bar' },
    ];

    const categoryMap = {};
    for (const cat of categoriesData) {
      const stId = stationMap[cat.station] || null;
      const [res] = await conn.query(
        `INSERT INTO categories (title, tenant_id, is_enabled, kitchen_station_id)
         VALUES (?, ?, 1, ?)`,
        [cat.title, tenantId, stId]
      );
      categoryMap[cat.title] = res.insertId;
    }

    // 5. Insert Menu Items with Variants and Addons
    console.log('[5/10] Creating Starbucks Menu Items, Sizes & Customizations...');

    // Standard Beverage Addons
    const drinkAddons = [
      { title: 'Extra Espresso Shot', price: 0.80 },
      { title: 'Oat Milk (Oatly)', price: 0.65 },
      { title: 'Almond Milk', price: 0.65 },
      { title: 'Soy Milk', price: 0.65 },
      { title: 'Vanilla Sweet Cream Cold Foam', price: 1.00 },
      { title: 'Caramel Drizzle', price: 0.50 },
      { title: 'Whipped Cream', price: 0.50 },
      { title: 'Vanilla Syrup (2 pumps)', price: 0.50 },
      { title: 'Brown Sugar Syrup (2 pumps)', price: 0.50 },
      { title: 'Sugar-Free Vanilla Syrup', price: 0.50 },
      { title: 'Less Ice', price: 0.00 },
      { title: 'No Ice', price: 0.00 },
    ];

    // Bakery Addons
    const bakeryAddons = [
      { title: 'Warmed Up', price: 0.00 },
      { title: 'Double Toasted', price: 0.00 },
      { title: 'Add Butter Pack', price: 0.30 },
      { title: 'Add Cream Cheese', price: 0.60 },
    ];

    const menuItemsData = [
      // Category 1: Hot Coffees & Espresso
      {
        category: 'Hot Coffees & Espresso',
        station: 'Espresso Bar',
        title: 'Caffè Americano',
        price: 3.25,
        description: 'Espresso shots topped with hot water create a light layer of crema culminating in this wonderfully rich cup.',
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 3.25 },
          { title: 'Grande (16 fl oz)', price: 3.75 },
          { title: 'Venti (20 fl oz)', price: 4.25 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Hot Coffees & Espresso',
        station: 'Espresso Bar',
        title: 'Caffè Latte',
        price: 4.15,
        description: 'Our dark, rich espresso balanced with steamed milk and a light layer of foam. A perfect milk-forward warm-up.',
        image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.15 },
          { title: 'Grande (16 fl oz)', price: 4.75 },
          { title: 'Venti (20 fl oz)', price: 5.25 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Hot Coffees & Espresso',
        station: 'Espresso Bar',
        title: 'Caramel Macchiato',
        price: 4.75,
        description: 'Freshly steamed milk with vanilla syrup marked with espresso and topped with a decadent caramel drizzle crosshatch.',
        image: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.75 },
          { title: 'Grande (16 fl oz)', price: 5.35 },
          { title: 'Venti (20 fl oz)', price: 5.85 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Hot Coffees & Espresso',
        station: 'Espresso Bar',
        title: 'Cappuccino',
        price: 4.15,
        description: 'Dark, rich espresso lies in wait under a smoothed and stretched layer of thick milk foam.',
        image: 'https://images.unsplash.com/photo-1572442388796-11668ba67e53?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.15 },
          { title: 'Grande (16 fl oz)', price: 4.75 },
          { title: 'Venti (20 fl oz)', price: 5.25 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Hot Coffees & Espresso',
        station: 'Espresso Bar',
        title: 'White Chocolate Mocha',
        price: 4.95,
        description: 'Signature espresso, steamed milk and luscious white chocolate sauce finished with sweetened whipped cream.',
        image: 'https://images.unsplash.com/photo-1579888944880-d98341245702?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.95 },
          { title: 'Grande (16 fl oz)', price: 5.55 },
          { title: 'Venti (20 fl oz)', price: 6.05 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Hot Coffees & Espresso',
        station: 'Espresso Bar',
        title: 'Flat White',
        price: 4.65,
        description: 'Smooth ristretto shots of espresso paired with whole milk expertly steamed to velvety micro-foam.',
        image: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.65 },
          { title: 'Grande (16 fl oz)', price: 5.15 },
          { title: 'Venti (20 fl oz)', price: 5.65 },
        ],
        addons: drinkAddons,
      },

      // Category 2: Cold Coffees & Cold Brew
      {
        category: 'Cold Coffees & Cold Brew',
        station: 'Cold Bar & Frappuccino',
        title: 'Iced Caffè Latte',
        price: 4.45,
        description: 'Dark, rich espresso combined with cold whole milk and served over ice. A milk-forward cooldown.',
        image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.45 },
          { title: 'Grande (16 fl oz)', price: 4.95 },
          { title: 'Venti (24 fl oz)', price: 5.45 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Cold Coffees & Cold Brew',
        station: 'Cold Bar & Frappuccino',
        title: 'Iced Caramel Macchiato',
        price: 5.15,
        description: 'Espresso combined with vanilla syrup, chilled milk and ice, topped with sweet caramel drizzle.',
        image: 'https://images.unsplash.com/photo-1592318953155-243a417387b3?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 5.15 },
          { title: 'Grande (16 fl oz)', price: 5.75 },
          { title: 'Venti (24 fl oz)', price: 6.25 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Cold Coffees & Cold Brew',
        station: 'Cold Bar & Frappuccino',
        title: 'Vanilla Sweet Cream Cold Brew',
        price: 4.95,
        description: 'Starbucks® Cold Brew accented with vanilla syrup and topped with a float of house-made vanilla sweet cream.',
        image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.95 },
          { title: 'Grande (16 fl oz)', price: 5.45 },
          { title: 'Venti (24 fl oz)', price: 5.95 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Cold Coffees & Cold Brew',
        station: 'Cold Bar & Frappuccino',
        title: 'Iced Brown Sugar Oatmilk Shaken Espresso',
        price: 5.45,
        description: 'Blonde espresso shaken with brown sugar and cinnamon, topped with oatmilk for an energizing lift.',
        image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 5.45 },
          { title: 'Grande (16 fl oz)', price: 5.95 },
          { title: 'Venti (24 fl oz)', price: 6.45 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Cold Coffees & Cold Brew',
        station: 'Cold Bar & Frappuccino',
        title: 'Nitro Cold Brew',
        price: 4.95,
        description: 'Cold brew infused with nitrogen for a naturally sweet flavor and cascading velvety crema.',
        image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.95 },
          { title: 'Grande (16 fl oz)', price: 5.45 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Cold Coffees & Cold Brew',
        station: 'Cold Bar & Frappuccino',
        title: 'Cold Brew Coffee',
        price: 3.95,
        description: 'Handcrafted in small batches daily, slow-steeped in cool water for 20 hours for super smooth flavor.',
        image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 3.95 },
          { title: 'Grande (16 fl oz)', price: 4.45 },
          { title: 'Venti (24 fl oz)', price: 4.95 },
        ],
        addons: drinkAddons,
      },

      // Category 3: Frappuccino® Blended
      {
        category: 'Frappuccino® Blended',
        station: 'Cold Bar & Frappuccino',
        title: 'Caramel Frappuccino®',
        price: 5.25,
        description: 'Caramel syrup blended with coffee, milk and ice, topped with whipped cream and buttery caramel drizzle.',
        image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 5.25 },
          { title: 'Grande (16 fl oz)', price: 5.85 },
          { title: 'Venti (24 fl oz)', price: 6.35 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Frappuccino® Blended',
        station: 'Cold Bar & Frappuccino',
        title: 'Java Chip Frappuccino®',
        price: 5.45,
        description: 'Mocha sauce and Frappuccino® chips blended with coffee, milk and ice, topped with whipped cream and mocha drizzle.',
        image: 'https://images.unsplash.com/photo-1558857563-b37cf5a5b28d?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 5.45 },
          { title: 'Grande (16 fl oz)', price: 6.05 },
          { title: 'Venti (24 fl oz)', price: 6.55 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Frappuccino® Blended',
        station: 'Cold Bar & Frappuccino',
        title: 'Matcha Crème Frappuccino®',
        price: 5.25,
        description: 'Premium sweetened matcha green tea blended with milk and ice, topped with sweetened whipped cream.',
        image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 5.25 },
          { title: 'Grande (16 fl oz)', price: 5.85 },
          { title: 'Venti (24 fl oz)', price: 6.35 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Frappuccino® Blended',
        station: 'Cold Bar & Frappuccino',
        title: 'Mocha Frappuccino®',
        price: 5.25,
        description: 'Mocha sauce, Frappuccino® roast coffee, milk and ice all blended together, finished with whipped cream.',
        image: 'https://images.unsplash.com/photo-1589396575653-c09c794ff6a6?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 5.25 },
          { title: 'Grande (16 fl oz)', price: 5.85 },
          { title: 'Venti (24 fl oz)', price: 6.35 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Frappuccino® Blended',
        station: 'Cold Bar & Frappuccino',
        title: 'Double Chocolaty Chip Crème Frappuccino®',
        price: 5.45,
        description: 'Rich mocha sauce and chocolaty chips blended with milk and ice, finished with whipped cream and chocolate drizzle.',
        image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 5.45 },
          { title: 'Grande (16 fl oz)', price: 6.05 },
          { title: 'Venti (24 fl oz)', price: 6.55 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Frappuccino® Blended',
        station: 'Cold Bar & Frappuccino',
        title: 'Strawberry Crème Frappuccino®',
        price: 5.25,
        description: 'Strawberries and milk blended with ice and layered atop a splash of strawberry puree, finished with whipped cream.',
        image: 'https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 5.25 },
          { title: 'Grande (16 fl oz)', price: 5.85 },
          { title: 'Venti (24 fl oz)', price: 6.35 },
        ],
        addons: drinkAddons,
      },

      // Category 4: Teas & Refreshers
      {
        category: 'Teas & Refreshers',
        station: 'Cold Bar & Frappuccino',
        title: 'Strawberry Açaí Starbucks Refreshers®',
        price: 4.65,
        description: 'Sweet strawberry flavors accented by passion fruit and açaí notes, caffeinated with green coffee extract.',
        image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.65 },
          { title: 'Grande (16 fl oz)', price: 5.15 },
          { title: 'Venti (24 fl oz)', price: 5.65 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Teas & Refreshers',
        station: 'Cold Bar & Frappuccino',
        title: 'Mango Dragonfruit Starbucks Refreshers®',
        price: 4.65,
        description: 'A tropical blend of sweet mango and dragonfruit flavors, hand-shaken with real diced dragonfruit.',
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.65 },
          { title: 'Grande (16 fl oz)', price: 5.15 },
          { title: 'Venti (24 fl oz)', price: 5.65 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Teas & Refreshers',
        station: 'Cold Bar & Frappuccino',
        title: 'Iced Matcha Green Tea Latte',
        price: 4.75,
        description: 'Smooth and creamy matcha sweetened just right and served with cold whole milk over ice.',
        image: 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.75 },
          { title: 'Grande (16 fl oz)', price: 5.35 },
          { title: 'Venti (24 fl oz)', price: 5.85 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Teas & Refreshers',
        station: 'Cold Bar & Frappuccino',
        title: 'Chai Tea Latte',
        price: 4.45,
        description: 'Black tea infused with cinnamon, clove and warming spices combined with steamed milk and topped with foam.',
        image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.45 },
          { title: 'Grande (16 fl oz)', price: 5.05 },
          { title: 'Venti (20 fl oz)', price: 5.55 },
        ],
        addons: drinkAddons,
      },
      {
        category: 'Teas & Refreshers',
        station: 'Cold Bar & Frappuccino',
        title: 'Iced Peach Green Tea Lemonade',
        price: 4.25,
        description: 'Green tea shaken with spearmint, lemongrass and peach juice blend plus tart lemonade.',
        image: 'https://images.unsplash.com/photo-1499961024600-adf094db305d?auto=format&fit=crop&w=600&q=80',
        variants: [
          { title: 'Tall (12 fl oz)', price: 4.25 },
          { title: 'Grande (16 fl oz)', price: 4.75 },
          { title: 'Venti (24 fl oz)', price: 5.25 },
        ],
        addons: drinkAddons,
      },

      // Category 5: Bakery & Breakfast
      {
        category: 'Bakery & Breakfast',
        station: 'Bakery & Food Warming',
        title: 'Butter Croissant',
        price: 2.95,
        description: 'Classic flaky pastry made with 100% butter for a soft, light texture and golden crisp crust.',
        image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: bakeryAddons,
      },
      {
        category: 'Bakery & Breakfast',
        station: 'Bakery & Food Warming',
        title: 'Chocolate Croissant',
        price: 3.45,
        description: 'Two chocolate batons folded into buttery croissant dough and baked to melted golden perfection.',
        image: 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: bakeryAddons,
      },
      {
        category: 'Bakery & Breakfast',
        station: 'Bakery & Food Warming',
        title: 'Blueberry Muffin',
        price: 3.25,
        description: 'Moist muffin bursting with plump wild blueberries and topped with sparkling sanding sugar.',
        image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: bakeryAddons,
      },
      {
        category: 'Bakery & Breakfast',
        station: 'Bakery & Food Warming',
        title: 'Birthday Cake Pop',
        price: 2.25,
        description: 'Vanilla cake blended with frosting, dipped in a cheerful pink chocolaty coating and white sprinkles.',
        image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: [],
      },
      {
        category: 'Bakery & Breakfast',
        station: 'Bakery & Food Warming',
        title: 'Double Chocolate Chunk Cookie',
        price: 2.75,
        description: 'Chewy, decadent gourmet cookie loaded with semi-sweet chocolate chunks and sea salt.',
        image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: bakeryAddons,
      },
      {
        category: 'Bakery & Breakfast',
        station: 'Bakery & Food Warming',
        title: 'Cinnamon Coffee Cake',
        price: 3.45,
        description: 'Moist sour-cream swirl cake topped with a crunchy brown sugar cinnamon streusel crust.',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: bakeryAddons,
      },

      // Category 6: Sandwiches & Savory
      {
        category: 'Sandwiches & Savory',
        station: 'Bakery & Food Warming',
        title: 'Bacon, Gouda & Egg Sandwich',
        price: 4.85,
        description: 'Sizzling applewood-smoked bacon, parmesan frittata and aged Gouda cheese on an artisan roll.',
        image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: bakeryAddons,
      },
      {
        category: 'Sandwiches & Savory',
        station: 'Bakery & Food Warming',
        title: 'Tomato & Mozzarella on Focaccia',
        price: 5.25,
        description: 'Roasted tomatoes, fresh mozzarella, basil pesto and baby spinach pressed warm on herb focaccia bread.',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: bakeryAddons,
      },
      {
        category: 'Sandwiches & Savory',
        station: 'Bakery & Food Warming',
        title: 'Ham & Swiss on Baguette',
        price: 5.45,
        description: 'Slow-roasted ham and nutty Swiss cheese with Dijon mustard butter on a crusty French baguette.',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: bakeryAddons,
      },
      {
        category: 'Sandwiches & Savory',
        station: 'Bakery & Food Warming',
        title: 'Spinach, Feta & Egg White Wrap',
        price: 4.95,
        description: 'Cage-free egg whites, spinach, feta cheese and sun-dried tomato cream cheese in a whole wheat wrap.',
        image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: bakeryAddons,
      },

      // Category 7: Starbucks Reserve & Beans
      {
        category: 'Starbucks Reserve & Beans',
        station: 'Espresso Bar',
        title: 'Pike Place® Roast (250g)',
        price: 12.50,
        description: 'A smooth, well-rounded blend of Latin American coffees with subtle notes of cocoa and toasted nuts.',
        image: 'https://images.unsplash.com/photo-1587734195503-904fca47e0e9?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: [],
      },
      {
        category: 'Starbucks Reserve & Beans',
        station: 'Espresso Bar',
        title: 'Sumatra Dark Roast (250g)',
        price: 13.50,
        description: 'Full-bodied with a smooth mouthfeel and lingering herbal flavors with earthy spice aromas.',
        image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: [],
      },
      {
        category: 'Starbucks Reserve & Beans',
        station: 'Espresso Bar',
        title: 'Starbucks Siren Ceramic Mug 14oz',
        price: 14.00,
        description: 'Classic ceramic mug featuring the embossed Starbucks Siren logo in signature dark green.',
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: [],
      },
      {
        category: 'Starbucks Reserve & Beans',
        station: 'Espresso Bar',
        title: 'Stainless Steel Cold Tumbler 16oz',
        price: 24.00,
        description: 'Double-wall insulated stainless steel tumbler with reusable straw, keeps iced drinks cold for 12 hours.',
        image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
        variants: [],
        addons: [],
      },
    ];

    const insertedItems = [];

    for (const item of menuItemsData) {
      const catId = categoryMap[item.category];
      const stationId = stationMap[item.station] || null;

      const [res] = await conn.query(
        `INSERT INTO menu_items (title, price, net_price, category, tenant_id, is_enabled, description, image, kitchen_station_id)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [item.title, item.price, item.price, catId, tenantId, item.description, item.image, stationId]
      );
      const itemId = res.insertId;
      insertedItems.push({ id: itemId, ...item });

      // Insert Variants
      for (const v of item.variants) {
        await conn.query(
          `INSERT INTO menu_item_variants (item_id, title, price, tenant_id)
           VALUES (?, ?, ?, ?)`,
          [itemId, v.title, v.price, tenantId]
        );
      }

      // Insert Addons
      for (const a of item.addons) {
        await conn.query(
          `INSERT INTO menu_item_addons (item_id, title, price, tenant_id)
           VALUES (?, ?, ?, ?)`,
          [itemId, a.title, a.price, tenantId]
        );
      }
    }
    console.log(`Inserted ${insertedItems.length} menu items with variants and addons.`);

    // 6. Floor Layout & Tables
    console.log('[6/10] Creating Starbucks Floor Layouts & Tables...');
    // Floor Layouts
    await conn.query(
      `INSERT INTO store_floor_layouts (tenant_id, floor, show_cashier, cashier_x, cashier_y, cashier_w, cashier_h, cashier_rotation, walls)
       VALUES (?, 'Main Lounge', 1, 160, 60, 90, 180, 90, '[]'),
              (?, 'Outdoor Patio', 1, 120, 60, 90, 180, 0, '[]')`,
      [tenantId, tenantId]
    );

    const tables = [
      // Main Lounge
      { title: 'Bar Stool 1', floor: 'Main Lounge', capacity: 1, pos_x: 60, pos_y: 120, shape: 'round', pin: '1001' },
      { title: 'Bar Stool 2', floor: 'Main Lounge', capacity: 1, pos_x: 60, pos_y: 200, shape: 'round', pin: '1002' },
      { title: 'Bar Stool 3', floor: 'Main Lounge', capacity: 1, pos_x: 60, pos_y: 280, shape: 'round', pin: '1003' },
      { title: 'Bar Stool 4', floor: 'Main Lounge', capacity: 1, pos_x: 60, pos_y: 360, shape: 'round', pin: '1004' },
      { title: 'Community Table', floor: 'Main Lounge', capacity: 8, pos_x: 240, pos_y: 200, shape: 'rectangle', pin: '2001' },
      { title: 'Lounge Table A1', floor: 'Main Lounge', capacity: 2, pos_x: 480, pos_y: 120, shape: 'round', pin: '3001' },
      { title: 'Lounge Table A2', floor: 'Main Lounge', capacity: 2, pos_x: 600, pos_y: 120, shape: 'round', pin: '3002' },
      { title: 'Cafe Table T1', floor: 'Main Lounge', capacity: 4, pos_x: 480, pos_y: 300, shape: 'square', pin: '4001' },
      { title: 'Cafe Table T2', floor: 'Main Lounge', capacity: 4, pos_x: 600, pos_y: 300, shape: 'square', pin: '4002' },
      { title: 'Cozy Booth B1', floor: 'Main Lounge', capacity: 4, pos_x: 480, pos_y: 480, shape: 'rectangle', pin: '5001' },
      { title: 'Cozy Booth B2', floor: 'Main Lounge', capacity: 4, pos_x: 600, pos_y: 480, shape: 'rectangle', pin: '5002' },

      // Outdoor Patio
      { title: 'Patio Table P1', floor: 'Outdoor Patio', capacity: 4, pos_x: 120, pos_y: 160, shape: 'round', pin: '6001' },
      { title: 'Patio Table P2', floor: 'Outdoor Patio', capacity: 4, pos_x: 280, pos_y: 160, shape: 'round', pin: '6002' },
      { title: 'Patio Table P3', floor: 'Outdoor Patio', capacity: 4, pos_x: 440, pos_y: 160, shape: 'round', pin: '6003' },
      { title: 'Patio Table P4', floor: 'Outdoor Patio', capacity: 4, pos_x: 600, pos_y: 160, shape: 'round', pin: '6004' },
    ];

    const tableMap = {};
    for (const tbl of tables) {
      const [res] = await conn.query(
        `INSERT INTO store_tables (table_title, floor, seating_capacity, tenant_id, pos_x, pos_y, shape, rotation, table_pin)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [tbl.title, tbl.floor, tbl.capacity, tenantId, tbl.pos_x, tbl.pos_y, tbl.shape, tbl.pin]
      );
      tableMap[tbl.title] = res.insertId;
    }
    console.log(`Created ${tables.length} tables across 2 floors.`);

    // 7. Customers
    console.log('[7/10] Creating Starbucks Rewards Members...');
    const customersData = [
      { name: 'Emily Watson', phone: '+85512345678', email: 'emily.watson@gmail.com' },
      { name: 'David Kim', phone: '+85515889900', email: 'david.kim@outlook.com' },
      { name: 'Sarah Jenkins', phone: '+85598765432', email: 'sarah.j@gmail.com' },
      { name: 'Michael Chen', phone: '+85577123456', email: 'michael.chen@tech.io' },
      { name: 'Lisa Vann', phone: '+85589554321', email: 'lisa.vann@khmer.com' },
    ];

    for (const c of customersData) {
      await conn.query(
        `INSERT INTO customers (name, phone, email, tenant_id)
         VALUES (?, ?, ?, ?)`,
        [c.name, c.phone, c.email, tenantId]
      );
    }

    // 8. Payment Types
    console.log('[8/10] Creating Starbucks Payment Methods...');
    const paymentMethods = [
      { title: 'Starbucks Card / Rewards', icon: 'credit_card' },
      { title: 'Cash (USD / KHR)', icon: 'cash' },
      { title: 'Visa / Mastercard', icon: 'credit_card' },
      { title: 'KHQR / ABA Mobile', icon: 'reader' },
    ];

    const paymentMap = {};
    for (const pm of paymentMethods) {
      const [res] = await conn.query(
        `INSERT INTO payment_types (title, is_active, tenant_id, icon)
         VALUES (?, 1, ?, ?)`,
        [pm.title, tenantId, pm.icon]
      );
      paymentMap[pm.title] = res.insertId;
    }

    // 9. Fetch inserted variants for realistic orders
    const [variantsRows] = await conn.query(
      `SELECT id, item_id, title, price FROM menu_item_variants WHERE tenant_id = ?`,
      [tenantId]
    );
    const itemVariantMap = {};
    for (const v of variantsRows) {
      if (!itemVariantMap[v.item_id]) itemVariantMap[v.item_id] = {};
      itemVariantMap[v.item_id][v.title] = v;
    }

    const [addonsRows] = await conn.query(
      `SELECT id, item_id, title, price FROM menu_item_addons WHERE tenant_id = ?`,
      [tenantId]
    );
    const itemAddonMap = {};
    for (const a of addonsRows) {
      if (!itemAddonMap[a.item_id]) itemAddonMap[a.item_id] = {};
      itemAddonMap[a.item_id][a.title] = a;
    }

    const findItem = (title) => insertedItems.find((i) => i.title === title);

    // 10. Sample Orders & Invoices (Live KDS & POS activity)
    console.log('[9/10] Creating Live KDS Orders & Past Invoices...');

    // Order 1: Active In-Store (DINEIN, Table T1) -> CREATED
    const itemCaramelMacc = findItem('Caramel Macchiato');
    const varCaramelGrande = itemVariantMap[itemCaramelMacc.id]?.['Grande (16 fl oz)'];

    const itemBrownSugar = findItem('Iced Brown Sugar Oatmilk Shaken Espresso');
    const varBrownSugarVenti = itemVariantMap[itemBrownSugar.id]?.['Venti (24 fl oz)'];

    const itemBaconGouda = findItem('Bacon, Gouda & Egg Sandwich');

    const [order1] = await conn.query(
      `INSERT INTO orders (date, delivery_type, customer_type, customer_id, table_id, status, token_no, payment_status, tenant_id, created_by)
       VALUES (NOW(), 'DINEIN', 'CUSTOMER', '+85512345678', ?, 'created', 101, 'pending', ?, 'demo@demo.com')`,
      [tableMap['Cafe Table T1'], tenantId]
    );
    const orderId1 = order1.insertId;

    const addonCaramelDrizzle = itemAddonMap[itemCaramelMacc.id]?.['Caramel Drizzle']?.id;
    const addonLessIce = itemAddonMap[itemBrownSugar.id]?.['Less Ice']?.id;
    const addonWarmBacon = itemAddonMap[itemBaconGouda.id]?.['Warmed Up']?.id;

    await conn.query(
      `INSERT INTO order_items (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id)
       VALUES (?, ?, ?, ?, 1, 'created', NOW(), 'Extra caramel drizzle', ?, ?, ?),
              (?, ?, ?, ?, 1, 'created', NOW(), 'Less ice', ?, ?, ?),
              (?, ?, NULL, ?, 1, 'created', NOW(), 'Warmed up well', ?, ?, ?)`,
      [
        orderId1, itemCaramelMacc.id, varCaramelGrande.id, varCaramelGrande.price, JSON.stringify([addonCaramelDrizzle].filter(Boolean)), tenantId, stationMap['Espresso Bar'],
        orderId1, itemBrownSugar.id, varBrownSugarVenti.id, varBrownSugarVenti.price, JSON.stringify([addonLessIce].filter(Boolean)), tenantId, stationMap['Cold Bar & Frappuccino'],
        orderId1, itemBaconGouda.id, itemBaconGouda.price, JSON.stringify([addonWarmBacon].filter(Boolean)), tenantId, stationMap['Bakery & Food Warming'],
      ]
    );

    // Order 2: Active Takeaway -> PREPARING
    const itemJavaChip = findItem('Java Chip Frappuccino®');
    const varJavaChipGrande = itemVariantMap[itemJavaChip.id]?.['Grande (16 fl oz)'];
    const itemChocCroissant = findItem('Chocolate Croissant');
    const itemCakePop = findItem('Birthday Cake Pop');

    const [order2] = await conn.query(
      `INSERT INTO orders (date, delivery_type, customer_type, customer_id, table_id, status, token_no, payment_status, tenant_id, created_by)
       VALUES (DATE_SUB(NOW(), INTERVAL 5 MINUTE), 'TAKEAWAY', 'WALKIN', NULL, NULL, 'created', 102, 'pending', ?, 'demo@demo.com')`,
      [tenantId]
    );
    const orderId2 = order2.insertId;

    const addonWhipJava = itemAddonMap[itemJavaChip.id]?.['Whipped Cream']?.id;
    const addonWarmChoc = itemAddonMap[itemChocCroissant.id]?.['Warmed Up']?.id;

    await conn.query(
      `INSERT INTO order_items (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id)
       VALUES (?, ?, ?, ?, 2, 'preparing', DATE_SUB(NOW(), INTERVAL 5 MINUTE), 'Extra whip', ?, ?, ?),
              (?, ?, NULL, ?, 1, 'preparing', DATE_SUB(NOW(), INTERVAL 5 MINUTE), 'Warm', ?, ?, ?),
              (?, ?, NULL, ?, 1, 'completed', DATE_SUB(NOW(), INTERVAL 5 MINUTE), '', '[]', ?, ?)`,
      [
        orderId2, itemJavaChip.id, varJavaChipGrande.id, varJavaChipGrande.price, JSON.stringify([addonWhipJava].filter(Boolean)), tenantId, stationMap['Cold Bar & Frappuccino'],
        orderId2, itemChocCroissant.id, itemChocCroissant.price, JSON.stringify([addonWarmChoc].filter(Boolean)), tenantId, stationMap['Bakery & Food Warming'],
        orderId2, itemCakePop.id, itemCakePop.price, tenantId, stationMap['Bakery & Food Warming'],
      ]
    );

    // Order 3: Active Patio (DINEIN, Table P2) -> CREATED
    const itemNitro = findItem('Nitro Cold Brew');
    const varNitroGrande = itemVariantMap[itemNitro.id]?.['Grande (16 fl oz)'];
    const itemSweetCream = findItem('Vanilla Sweet Cream Cold Brew');
    const varSweetCreamGrande = itemVariantMap[itemSweetCream.id]?.['Grande (16 fl oz)'];
    const itemButterCroissant = findItem('Butter Croissant');

    const [order3] = await conn.query(
      `INSERT INTO orders (date, delivery_type, customer_type, customer_id, table_id, status, token_no, payment_status, tenant_id, created_by)
       VALUES (DATE_SUB(NOW(), INTERVAL 2 MINUTE), 'DINEIN', 'CUSTOMER', '+85515889900', ?, 'created', 103, 'pending', ?, 'demo@demo.com')`,
      [tableMap['Patio Table P2'], tenantId]
    );
    const orderId3 = order3.insertId;

    const addonWarmButter = itemAddonMap[itemButterCroissant.id]?.['Warmed Up']?.id;

    await conn.query(
      `INSERT INTO order_items (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id)
       VALUES (?, ?, ?, ?, 1, 'created', DATE_SUB(NOW(), INTERVAL 2 MINUTE), '', '[]', ?, ?),
              (?, ?, ?, ?, 1, 'created', DATE_SUB(NOW(), INTERVAL 2 MINUTE), 'Extra sweet cream', '[]', ?, ?),
              (?, ?, NULL, ?, 2, 'created', DATE_SUB(NOW(), INTERVAL 2 MINUTE), 'Warmed', ?, ?, ?)`,
      [
        orderId3, itemNitro.id, varNitroGrande.id, varNitroGrande.price, tenantId, stationMap['Cold Bar & Frappuccino'],
        orderId3, itemSweetCream.id, varSweetCreamGrande.id, varSweetCreamGrande.price, tenantId, stationMap['Cold Bar & Frappuccino'],
        orderId3, itemButterCroissant.id, itemButterCroissant.price, JSON.stringify([addonWarmButter].filter(Boolean)), tenantId, stationMap['Bakery & Food Warming'],
      ]
    );

    // Order 4 & 5: Completed Historical Orders with Invoices
    let nextInvoiceId = 1001;
    const inv1Id = nextInvoiceId++;
    await conn.query(
      `INSERT INTO invoices (id, created_at, sub_total, tax_total, total, tenant_id, payment_type_id, service_charge_total, created_by, status)
       VALUES (?, DATE_SUB(NOW(), INTERVAL 1 HOUR), 15.65, 0.00, 15.65, ?, ?, 0.00, 'demo@demo.com', 'COMPLETED')`,
      [inv1Id, tenantId, paymentMap['KHQR / ABA Mobile']]
    );

    const [order4] = await conn.query(
      `INSERT INTO orders (date, delivery_type, customer_type, customer_id, table_id, status, token_no, payment_status, invoice_id, tenant_id, created_by)
       VALUES (DATE_SUB(NOW(), INTERVAL 1 HOUR), 'DINEIN', 'CUSTOMER', '+85598765432', ?, 'completed', 98, 'paid', ?, ?, 'demo@demo.com')`,
      [tableMap['Cafe Table T2'], inv1Id, tenantId]
    );

    await conn.query(
      `INSERT INTO order_items (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id)
       VALUES (?, ?, ?, 5.35, 1, 'delivered', DATE_SUB(NOW(), INTERVAL 1 HOUR), '', '[]', ?, ?),
              (?, ?, ?, 5.15, 1, 'delivered', DATE_SUB(NOW(), INTERVAL 1 HOUR), '', '[]', ?, ?),
              (?, ?, NULL, 5.15, 1, 'delivered', DATE_SUB(NOW(), INTERVAL 1 HOUR), '', '[]', ?, ?)`,
      [
        order4.insertId, itemCaramelMacc.id, varCaramelGrande.id, tenantId, stationMap['Espresso Bar'],
        order4.insertId, itemBrownSugar.id, varBrownSugarVenti.id, tenantId, stationMap['Cold Bar & Frappuccino'],
        order4.insertId, itemBaconGouda.id, tenantId, stationMap['Bakery & Food Warming'],
      ]
    );

    const inv2Id = nextInvoiceId++;
    await conn.query(
      `INSERT INTO invoices (id, created_at, sub_total, tax_total, total, tenant_id, payment_type_id, service_charge_total, created_by, status)
       VALUES (?, DATE_SUB(NOW(), INTERVAL 2 HOUR), 24.00, 0.00, 24.00, ?, ?, 0.00, 'demo@demo.com', 'COMPLETED')`,
      [inv2Id, tenantId, paymentMap['Starbucks Card / Rewards']]
    );

    const itemTumbler = findItem('Stainless Steel Cold Tumbler 16oz');
    const [order5] = await conn.query(
      `INSERT INTO orders (date, delivery_type, customer_type, customer_id, table_id, status, token_no, payment_status, invoice_id, tenant_id, created_by)
       VALUES (DATE_SUB(NOW(), INTERVAL 2 HOUR), 'TAKEAWAY', 'CUSTOMER', '+85577123456', NULL, 'completed', 99, 'paid', ?, ?, 'demo@demo.com')`,
      [inv2Id, tenantId]
    );

    await conn.query(
      `INSERT INTO order_items (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id)
       VALUES (?, ?, NULL, 24.00, 1, 'delivered', DATE_SUB(NOW(), INTERVAL 2 HOUR), 'Gift wrapped', '[]', ?, ?)`,
      [order5.insertId, itemTumbler.id, tenantId, stationMap['Espresso Bar']]
    );

    // Update Sequences
    await conn.query(
      `INSERT INTO invoice_sequences (sequence_no, tenant_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE sequence_no = VALUES(sequence_no)`,
      [nextInvoiceId, tenantId]
    );

    await conn.query(
      `INSERT INTO token_sequences (sequence_no, last_updated, tenant_id)
       VALUES (103, NOW(), ?)
       ON DUPLICATE KEY UPDATE sequence_no = VALUES(sequence_no), last_updated = NOW()`,
      [tenantId]
    );

    console.log('[10/10] Seed completed successfully!');
    console.log('--------------------------------------------------');
    console.log('Starbucks Coffee Demo Data is ready:');
    console.log(`• Tenant: Starbucks Coffee (#${tenantId})`);
    console.log(`• Store: Starbucks Coffee - BKK Flagship (USD, rate 4100)`);
    console.log(`• Stations: 3 (Espresso Bar, Cold Bar & Frappuccino, Bakery & Food Warming)`);
    console.log(`• Categories: 7 Starbucks menu categories`);
    console.log(`• Items: ${insertedItems.length} handcrafted items with variants, addons & images`);
    console.log(`• Tables: ${tables.length} tables across Main Lounge & Outdoor Patio`);
    console.log(`• Members: ${customersData.length} Starbucks Rewards customers`);
    console.log(`• Payment Types: 4 payment methods (Starbucks Card, KHQR, Cash, Cards)`);
    console.log(`• Active KDS Tickets: 3 live orders with tokens #101, #102, #103`);
    console.log('--------------------------------------------------');

  } catch (err) {
    console.error('Error seeding Starbucks demo data:', err);
    throw err;
  } finally {
    await conn.end();
  }
}

seed().then(() => {
  console.log('Seed script finished successfully.');
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
