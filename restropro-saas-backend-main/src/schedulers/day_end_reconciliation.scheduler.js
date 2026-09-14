/**
 * Day-end payment reconciliation notification (Owner App).
 *
 * Once a day, every tenant with a signed-in owner/manager device gets a push
 * summarising the day's sales, deep-linking to the payment reconciliation
 * report.
 *
 * Why a plain interval instead of a cron library: the backend has no scheduling
 * dependency today and this needs one job. A one-minute tick reading the clock
 * from MySQL is both simpler and more correct here than a cron expression
 * evaluated against the Node process clock, because the report it summarises is
 * built from CURDATE()/NOW() on the database.
 *
 * Failure handling:
 *  - the tick can never throw into the event loop (top-level catch);
 *  - one tenant's failure never stops the sweep (per-tenant catch);
 *  - ticks cannot overlap (`running` guard), and even if they did, the dispatch
 *    claim is an atomic INSERT IGNORE so a tenant can only ever be sent once
 *    per day (see notification_dispatch.service);
 *  - an unexpected failure releases the claim so a later tick retries the same
 *    day; a deliberate skip (no sales) keeps it.
 */
const { CONFIG } = require("../config");
const {
  NOTIFICATION_TYPES,
  OWNER_ALERT_SCOPES,
  notifyDayEndReconciliation,
} = require("../services/notification.service");
const { getTenantsWithManagerDevicesDB } = require("../services/device.service");
const { getRevenueDB, getTotalPaymentsByPaymentTypesDB } = require("../services/reports.service");
const { getCurrencyDB } = require("../services/settings.service");
const {
  getDatabaseClockDB,
  claimScheduledDispatchDB,
  recordScheduledDispatchResultDB,
  releaseScheduledDispatchDB,
} = require("../services/notification_dispatch.service");

const TICK_MS = 60 * 1000;
const TYPE = NOTIFICATION_TYPES.DAY_END_RECONCILIATION;

/** "23:59" -> 1439. Returns null for anything unparseable so a typo disables the job loudly. */
const parseTimeToMinutes = (value) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/**
 * Build and send one tenant's day-end summary for `date`.
 *
 * The figures come from the same reports.service functions the dashboard and
 * the Reports module use — no reporting logic is reimplemented here, so the
 * push can never disagree with the report the owner opens from it.
 *
 * Exported on its own so a manual "send now" endpoint can reuse it later:
 * pass `force` to bypass the once-per-day claim.
 *
 * Returns 'sent' | 'skipped' | 'already-sent'.
 */
const runDayEndReconciliationForTenant = async (tenantId, date, { force = false } = {}) => {
  const claimed = force || (await claimScheduledDispatchDB(tenantId, TYPE, date));
  if (!claimed) return "already-sent";

  try {
    const [totalSales, paymentRows, currency] = await Promise.all([
      getRevenueDB("today", null, null, tenantId),
      getTotalPaymentsByPaymentTypesDB("today", null, null, tenantId),
      getCurrencyDB(tenantId),
    ]);

    const invoiceCount = paymentRows.reduce((sum, row) => sum + Number(row.invoice_count || 0), 0);

    // A closed restaurant should not be pushed "sales totaled ₹0" every night.
    // The claim is kept so the day stays settled rather than being retried on
    // every remaining tick.
    if (invoiceCount === 0 && Number(totalSales || 0) === 0) {
      console.log(`[scheduler] DAY_END_RECONCILIATION tenant=${tenantId} date=${date} skipped (no sales)`);
      return "skipped";
    }

    const result = await notifyDayEndReconciliation(tenantId, {
      date,
      totalSales: Number(totalSales || 0),
      currency,
      invoiceCount,
      reportId: CONFIG.DAY_END_RECONCILIATION_REPORT_ID,
    });

    await recordScheduledDispatchResultDB(tenantId, TYPE, date, result.successCount);
    return "sent";
  } catch (error) {
    console.error(`[scheduler] DAY_END_RECONCILIATION tenant=${tenantId} date=${date} failed:`, error);
    if (!force) await releaseScheduledDispatchDB(tenantId, TYPE, date);
    return "skipped";
  }
};
exports.runDayEndReconciliationForTenant = runDayEndReconciliationForTenant;

/**
 * One sweep across every eligible tenant. Safe to call repeatedly — tenants
 * already sent today are filtered out by their dispatch claim.
 */
const runDayEndReconciliationSweep = async (date) => {
  const tenantIds = await getTenantsWithManagerDevicesDB(OWNER_ALERT_SCOPES[TYPE]);
  if (tenantIds.length === 0) return;

  let sent = 0;
  for (const tenantId of tenantIds) {
    // Sequential on purpose: a nightly sweep has no deadline, and this keeps
    // the report queries from spiking the connection pool that live POS
    // traffic shares.
    const outcome = await runDayEndReconciliationForTenant(tenantId, date).catch((error) => {
      console.error(`[scheduler] DAY_END_RECONCILIATION tenant=${tenantId} crashed:`, error);
      return "skipped";
    });
    if (outcome === "sent") sent += 1;
  }

  if (sent > 0) {
    console.log(`[scheduler] DAY_END_RECONCILIATION date=${date} tenants=${tenantIds.length} sent=${sent}`);
  }
};
exports.runDayEndReconciliationSweep = runDayEndReconciliationSweep;

let running = false;

const tick = async (scheduledMinutes) => {
  if (running) return;
  running = true;
  try {
    const { date, minutes } = await getDatabaseClockDB();
    // Only fire at/after the configured time *on the same business date*. The
    // comparison is against today's clock, so a restart at 00:10 does not fire
    // yesterday's 23:59 run against a day with no sales yet.
    if (minutes < scheduledMinutes) return;
    await runDayEndReconciliationSweep(date);
  } catch (error) {
    console.error("[scheduler] DAY_END_RECONCILIATION tick failed:", error);
  } finally {
    running = false;
  }
};

/** Start the daily job. Called once from the server entrypoint. */
exports.startDayEndReconciliationScheduler = () => {
  if (!CONFIG.DAY_END_RECONCILIATION_ENABLED) {
    console.log("[scheduler] DAY_END_RECONCILIATION disabled by config.");
    return null;
  }

  const scheduledMinutes = parseTimeToMinutes(CONFIG.DAY_END_RECONCILIATION_TIME);
  if (scheduledMinutes === null) {
    console.error(
      `[scheduler] DAY_END_RECONCILIATION_TIME "${CONFIG.DAY_END_RECONCILIATION_TIME}" is not HH:MM — scheduler not started.`
    );
    return null;
  }

  const timer = setInterval(() => tick(scheduledMinutes), TICK_MS);
  // Never keep the process alive just for the next tick.
  timer.unref?.();

  console.log(`[scheduler] DAY_END_RECONCILIATION armed for ${CONFIG.DAY_END_RECONCILIATION_TIME} (db clock).`);
  return timer;
};
