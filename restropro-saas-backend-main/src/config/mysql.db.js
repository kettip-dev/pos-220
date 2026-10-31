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

ensureTableFloorSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring table floor schema:", err);
});

ensurePrintSettingsSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring print settings schema:", err);
});

ensureKitchenStationsSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring kitchen stations schema:", err);
});

ensureCambodiaDualCurrencySchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring cambodia dual currency schema:", err);
});

ensureQrOrderSecuritySchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring QR order security schema:", err);
});

ensureBillingModeSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring billing mode schema:", err);
});

ensureBranchManagementSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring branch management schema:", err);
});

ensureBusinessRegistrationSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring business registration schema:", err);
});

ensureTelegramSettingsSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring telegram settings schema:", err);
});

ensureSupplierManagementSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring supplier management schema:", err);
});

ensurePromotionSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring promotion schema:", err);
});

ensureLoyaltyProgramSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring loyalty program schema:", err);
});

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
