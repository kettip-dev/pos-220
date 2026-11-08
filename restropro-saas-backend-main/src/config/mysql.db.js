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

// Register schema extends order_sub_invoices, so it waits for the split-bill schema.
const splitBillSchemaReady = ensureSplitBillSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring bill splitting schema:", err);
});

ensureShiftRosterSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring shift & roster schema:", err);
});

ensureInventoryAdjustmentsAndTransfersSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring inventory adjustments & transfers schema:", err);
});

ensureCustomerGroupSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring customer groups schema:", err);
});

ensureKitchenModeSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring kitchen mode schema:", err);
});

ensurePrintAgentsSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring print agents schema:", err);
});

ensureCustomer360Schema(pool).catch((err) => {
  console.error("[Migration] Error ensuring customer 360 schema:", err);
});

ensureDesktopLoginSchema(pool).catch((err) => {
  console.error("[Migration] Error ensuring desktop login schema:", err);
});

// Add-on library extends menu_item_addons, so it waits for the availability column.
ensureAddonAvailabilitySchema(pool)
  .catch((err) => {
    console.error("[Migration] Error ensuring addon availability schema:", err);
  })
  .then(() => ensureAddonLibrarySchema(pool))
  .catch((err) => {
    console.error("[Migration] Error ensuring addon library schema:", err);
  })
  // Menu translations add a column to addon_library, so they wait for it.
  .then(() => ensureMenuLanguageSchema(pool))
  .catch((err) => {
    console.error("[Migration] Error ensuring menu language schema:", err);
  });

// Pay-later extends register_payments.source and invoice_audit_log.action, so it waits for the register schema.
splitBillSchemaReady
  .then(() => ensureRegisterSchema(pool))
  .catch((err) => {
    console.error("[Migration] Error ensuring register schema:", err);
  })
  .then(() => ensureCustomerCreditSchema(pool))
  .catch((err) => {
    console.error("[Migration] Error ensuring customer credit schema:", err);
  })
  // POS features extend register/invoice tables, so they run last.
  .then(() => ensurePosFeaturesSchema(pool))
  .catch((err) => {
    console.error("[Migration] Error ensuring POS features schema:", err);
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
