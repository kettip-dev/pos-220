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

const pool = 
mySqlPromise.createPool(`${CONFIG.DATABASE_URL}?ssl={"rejectUnauthorized":false}&multipleStatements=true&dateStrings=false&waitForConnections=true&connectionLimit=99&enableKeepAlive=true&keepAliveInitialDelay=10000`);

console.log(`DB Pool Created.`);

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

exports.getMySqlPromiseConnection = async () => {
  try {
    return await pool.getConnection();
  } catch (error) {
    console.error("Pool Connection Error: =======>");
    console.error(error);
    throw error;
  }
};
