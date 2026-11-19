const { CONFIG } = require("./index")

const mySqlPromise = require("mysql2/promise");
const { ensureTableFloorSchema } = require("../utils/tableFloorMigration");
const { ensurePrintSettingsSchema } = require("../utils/printSettingsMigration");
const { ensureKitchenStationsSchema } = require("../utils/kitchenStationsMigration");
const { ensureCambodiaDualCurrencySchema } = require("../utils/cambodiaDualCurrencyMigration");
const { ensureQrOrderSecuritySchema } = require("../utils/qrOrderSecurityMigration");
const { ensureBillingModeSchema } = require("../utils/billingModeMigration");
const { ensureBranchManagementSchema } = require("../utils/branchManagementMigration");
const { ensureBusinessRegistrationSchema } = require("../utils/businessRegistrationMigration");
const { ensureTelegramSettingsSchema } = require("../utils/telegramSettingsMigration");
const { ensureSupplierManagementSchema } = require("../utils/supplierManagementMigration");
const { ensurePromotionSchema } = require("../utils/promotionMigration");
const { ensureLoyaltyProgramSchema } = require("../utils/loyaltyMigration");
const { ensureSplitBillSchema } = require("../utils/splitBillMigration");
const { ensureShiftRosterSchema } = require("../utils/shiftRosterMigration");
const { ensureInventoryAdjustmentsAndTransfersSchema } = require("../utils/inventoryAdjustmentsAndTransfersMigration");
const { ensureCustomerGroupSchema } = require("../utils/customerGroupMigration");
const { ensureKitchenModeSchema } = require("../utils/kitchenModeMigration");
const { ensurePrintAgentsSchema } = require("../utils/printAgentsMigration");
const { ensureRegisterSchema } = require("../utils/registerMigration");
const { ensureCustomerCreditSchema } = require("../utils/customerCreditMigration");
const { ensureCustomer360Schema } = require("../utils/customer360Migration");
const { ensureAddonAvailabilitySchema } = require("../utils/addonAvailabilityMigration");
const { ensureAddonLibrarySchema } = require("../utils/addonLibraryMigration");
const { ensureDesktopLoginSchema } = require("../utils/desktopLoginMigration");
const { ensureMenuLanguageSchema } = require("../utils/menuLanguageMigration");
const { ensurePosFeaturesSchema } = require("../utils/posFeaturesMigration");
const { ensureKitchenTimingSchema } = require("../utils/kitchenTimingMigration");
const { ensurePmsIntegrationSchema } = require("../utils/pmsIntegrationMigration");

const dbBaseUrl = CONFIG.DATABASE_URL || "";
const hasParams = dbBaseUrl.includes("?");
const tzParam = dbBaseUrl.includes("timezone=") ? "" : `${hasParams ? "&" : "?"}timezone=%2B07:00`;
const fullDbUrl = `${dbBaseUrl}${tzParam}${dbBaseUrl.includes("?") || tzParam ? "&" : "?"}ssl={"rejectUnauthorized":false}&multipleStatements=true&dateStrings=false&waitForConnections=true&connectionLimit=99&enableKeepAlive=true&keepAliveInitialDelay=10000`;

const pool = mySqlPromise.createPool(fullDbUrl);

// Automatically align session timezone to Cambodia (UTC+7) for every new connection
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+07:00'", (err) => {
    if (err) {
      console.error("[MySQL Pool] Error setting session time_zone to +07:00:", err.message);
    }
  });
});

console.log(`DB Pool Created with Cambodia Timezone (+07:00).`);

// Schema migrations run one at a time, in dependency order. Running them in
// parallel caused ALTER TABLE deadlocks and steps that ran before the columns
// they depend on existed (e.g. customer groups need promotion_discount_total,
// customer credit needs invoices.customer_phone from customer groups).
const MIGRATIONS = [
  ["table floor", ensureTableFloorSchema],
  ["print settings", ensurePrintSettingsSchema],
  ["kitchen timing", ensureKitchenTimingSchema],
  ["PMS integration", ensurePmsIntegrationSchema],
  ["kitchen stations", ensureKitchenStationsSchema],
  ["cambodia dual currency", ensureCambodiaDualCurrencySchema],
  ["QR order security", ensureQrOrderSecuritySchema],
  ["billing mode", ensureBillingModeSchema],
  ["branch management", ensureBranchManagementSchema],
  ["business registration", ensureBusinessRegistrationSchema],
  ["telegram settings", ensureTelegramSettingsSchema],
  ["supplier management", ensureSupplierManagementSchema],
  ["promotion", ensurePromotionSchema],
  ["loyalty program", ensureLoyaltyProgramSchema],
  ["bill splitting", ensureSplitBillSchema],
  ["shift & roster", ensureShiftRosterSchema],
  ["inventory adjustments & transfers", ensureInventoryAdjustmentsAndTransfersSchema],
  ["customer groups", ensureCustomerGroupSchema], // needs promotion columns
  ["kitchen mode", ensureKitchenModeSchema],
  ["print agents", ensurePrintAgentsSchema],
  ["customer 360", ensureCustomer360Schema],
  ["desktop login", ensureDesktopLoginSchema],
  ["addon availability", ensureAddonAvailabilitySchema],
  ["addon library", ensureAddonLibrarySchema], // extends menu_item_addons
  ["menu language", ensureMenuLanguageSchema], // adds a column to addon_library
  ["register", ensureRegisterSchema], // extends order_sub_invoices (split bill)
  ["customer credit", ensureCustomerCreditSchema], // needs invoices.customer_phone
  ["POS features", ensurePosFeaturesSchema], // extends register/invoice tables
];

exports.schemaReady = (async () => {
  for (const [name, run] of MIGRATIONS) {
    try {
      await run(pool);
    } catch (err) {
      console.error(`[Migration] Error ensuring ${name} schema:`, err);
    }
  }
})();

exports.getMySqlPromiseConnection = async () => {
  try {
    const conn = await pool.getConnection();
    // Guarantee dateStrings remains false across all pooled queries
    if (conn.config) {
      conn.config.dateStrings = false;
    }
    return conn;
  } catch (error) {
    console.error("Pool Connection Error: =======>");
    console.error(error);
    throw error;
  }
};
