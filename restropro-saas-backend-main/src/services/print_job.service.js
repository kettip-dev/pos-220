const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { parseTcpPrinterAddress } = require("../utils/printerAddress");
const { getOnlineAgent } = require("./print_agent.service");
const { sendRawTcpPrintJob } = require("./printer.service");

/**
 * Print job queue.
 *
 * Every receipt / KOT / test print is recorded in print_jobs before it is sent,
 * so a failed or offline printer never silently loses a ticket:
 *   - printers with an agent_id are relayed through that print agent; if the
 *     agent is offline the job stays queued and is flushed when it reconnects;
 *   - printers without an agent are printed by the server over TCP (only works
 *     when the server shares the printer's network; disable on cloud hosts
 *     with PRINT_SERVER_DIRECT=false).
 * Clients send an idempotency key so "Retry" re-sends only jobs that did not print.
 */

const AGENT_ACK_TIMEOUT_MS = 15000;
const QUEUED_JOB_MAX_AGE_MINUTES = 15;
const MAX_PAYLOAD_BASE64_LENGTH = 4 * 1024 * 1024;
const SERVER_DIRECT_ATTEMPTS = 3;
const JOB_TYPES = ["receipt", "kot", "test", "raw"];

function serverDirectEnabled() {
  return String(process.env.PRINT_SERVER_DIRECT ?? "true").toLowerCase() !== "false";
}

class PrintJobError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
exports.PrintJobError = PrintJobError;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Serialize server-direct jobs per printer: most thermal printers accept only
// one RAW connection at a time and would refuse or interleave concurrent jobs.
const printerLocks = new Map();
function withPrinterLock(printerId, fn) {
  const previous = printerLocks.get(printerId) || Promise.resolve();
  const run = previous.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  printerLocks.set(printerId, tail);
  tail.then(() => {
    if (printerLocks.get(printerId) === tail) printerLocks.delete(printerId);
  });
  return run;
}

async function loadPrinter(conn, tenantId, printerId) {
  const [rows] = await conn.query(
    `SELECT id, tenant_id, name, transport, address, paper_size, auto_cut, agent_id
     FROM printer_configs WHERE id = ? AND tenant_id = ?`,
    [printerId, tenantId]
  );
  return rows[0] || null;
}

async function markJob(tenantId, jobId, status, lastError = null) {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(
      `UPDATE print_jobs
       SET status = ?, last_error = ?, printed_at = IF(? = 'printed', NOW(), printed_at)
       WHERE id = ? AND tenant_id = ?`,
      [status, lastError ? String(lastError).slice(0, 500) : null, status, jobId, tenantId]
    );
  } finally {
    conn.release();
  }
}

async function beginAttempt(tenantId, jobId, agentId) {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(
      `UPDATE print_jobs SET status = 'sending', attempts = attempts + 1, agent_id = ?
       WHERE id = ? AND tenant_id = ?`,
      [agentId || null, jobId, tenantId]
    );
  } finally {
    conn.release();
  }
}

/**
 * Send one job to its printer, through the agent or directly.
 * @returns {Promise<{ jobId:number, status:string, message:string }>}
 */
async function dispatchJob(job, printer) {
  const tenantId = Number(job.tenant_id);

  if (printer.agent_id) {
    const live = getOnlineAgent(printer.agent_id);
    if (!live || Number(live.tenantId) !== tenantId) {
      const message = `Print agent is offline. The job is queued and will print when the agent reconnects (within ${QUEUED_JOB_MAX_AGE_MINUTES} min).`;
      await markJob(tenantId, job.id, "queued", message);
      return { jobId: job.id, status: "queued", message };
    }

    await beginAttempt(tenantId, job.id, printer.agent_id);
    let ack;
    try {
      ack = await live.socket.timeout(AGENT_ACK_TIMEOUT_MS).emitWithAck("print_job", {
        jobId: job.id,
        jobType: job.job_type,
        printer: {
          id: printer.id,
          name: printer.name,
          transport: printer.transport,
          address: printer.address,
        },
        payload: job.payload,
      });
    } catch (_) {
      const message = "Sent to print agent, but it did not confirm in time. Check the printer.";
      await markJob(tenantId, job.id, "sending", message);
      return { jobId: job.id, status: "sending", message };
    }

    if (ack?.ok) {
      await markJob(tenantId, job.id, "printed");
      return { jobId: job.id, status: "printed", message: `Printed on ${printer.name}` };
    }
    const message = ack?.error ? String(ack.error) : "Print agent could not print the job.";
    await markJob(tenantId, job.id, "failed", message);
    return { jobId: job.id, status: "failed", message };
  }

  if (!serverDirectEnabled()) {
    const message = `${printer.name} has no print agent. Install the Bong POS print agent on a computer in the restaurant and assign it to this printer.`;
    await markJob(tenantId, job.id, "failed", message);
    return { jobId: job.id, status: "failed", message };
  }

  if (printer.transport !== "tcp") {
    const message = `${printer.name} is a USB printer and can only print through a print agent.`;
    await markJob(tenantId, job.id, "failed", message);
    return { jobId: job.id, status: "failed", message };
  }

  let target;
  try {
    target = parseTcpPrinterAddress(printer.address);
  } catch (error) {
    await markJob(tenantId, job.id, "failed", error.message);
    return { jobId: job.id, status: "failed", message: error.message };
  }

  const buffer = Buffer.from(job.payload, "base64");
  return withPrinterLock(printer.id, async () => {
    let lastError;
    for (let attempt = 1; attempt <= SERVER_DIRECT_ATTEMPTS; attempt++) {
      await beginAttempt(tenantId, job.id, null);
      try {
        await sendRawTcpPrintJob(target.host, target.port, buffer);
        await markJob(tenantId, job.id, "printed");
        return { jobId: job.id, status: "printed", message: `Printed on ${printer.name}` };
      } catch (error) {
        lastError = error;
        if (attempt < SERVER_DIRECT_ATTEMPTS) await sleep(400 * attempt);
      }
    }
    await markJob(tenantId, job.id, "failed", lastError?.message);
    return { jobId: job.id, status: "failed", message: lastError?.message || "Printer unreachable" };
  });
}

/**
 * Record a print job and dispatch it.
 * With an idempotency key, a job that already printed is not printed again,
 * and a failed/queued job with the same key is re-sent instead of duplicated.
 */
exports.submitPrintJob = async (tenantId, printerId, { payloadBase64, jobType, reference, idempotencyKey } = {}) => {
  if (!payloadBase64 || typeof payloadBase64 !== "string") {
    throw new PrintJobError("Print payload (base64Data) is required.");
  }
  if (payloadBase64.length > MAX_PAYLOAD_BASE64_LENGTH) {
    throw new PrintJobError("Print payload is too large.", 413);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payloadBase64)) {
    throw new PrintJobError("Print payload must be base64 encoded.");
  }

  const type = JOB_TYPES.includes(jobType) ? jobType : "raw";
  const ref = reference ? String(reference).slice(0, 100) : null;
  const key = idempotencyKey ? String(idempotencyKey).slice(0, 120) : null;

  const conn = await getMySqlPromiseConnection();
  let printer;
  let job;
  try {
    printer = await loadPrinter(conn, tenantId, printerId);
    if (!printer) throw new PrintJobError(`Printer with ID ${printerId} not found.`, 404);

    if (key) {
      const [existing] = await conn.query(
        `SELECT id, status, TIMESTAMPDIFF(SECOND, updated_at, NOW()) AS idle_seconds
         FROM print_jobs WHERE tenant_id = ? AND idempotency_key = ?`,
        [tenantId, key]
      );
      if (existing.length > 0) {
        const prev = existing[0];
        if (prev.status === "printed") {
          return { jobId: prev.id, status: "printed", duplicate: true, message: `Already printed on ${printer.name}` };
        }
        if (prev.status === "sending" && prev.idle_seconds < AGENT_ACK_TIMEOUT_MS / 1000 + 5) {
          return { jobId: prev.id, status: "sending", duplicate: true, message: "This job is already being printed." };
        }
        await conn.query(
          `UPDATE print_jobs SET printer_id = ?, payload = ?, job_type = ?, reference = ?, status = 'queued', last_error = NULL
           WHERE id = ? AND tenant_id = ?`,
          [printer.id, payloadBase64, type, ref, prev.id, tenantId]
        );
        job = { id: prev.id, tenant_id: tenantId, job_type: type, payload: payloadBase64 };
      }
    }

    if (!job) {
      const [result] = await conn.query(
        `INSERT INTO print_jobs (tenant_id, printer_id, agent_id, job_type, reference, idempotency_key, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, printer.id, printer.agent_id || null, type, ref, key, payloadBase64]
      );
      job = { id: result.insertId, tenant_id: tenantId, job_type: type, payload: payloadBase64 };
    }
  } finally {
    conn.release();
  }

  return dispatchJob(job, printer);
};

/**
 * Re-send a previous job (e.g. after fixing a paper jam).
 */
exports.retryPrintJob = async (tenantId, jobId) => {
  const conn = await getMySqlPromiseConnection();
  let job;
  let printer;
  try {
    const [rows] = await conn.query(
      `SELECT id, tenant_id, printer_id, job_type, payload FROM print_jobs WHERE id = ? AND tenant_id = ?`,
      [jobId, tenantId]
    );
    job = rows[0];
    if (!job) throw new PrintJobError("Print job not found.", 404);
    if (!job.payload) throw new PrintJobError("This job is too old to reprint. Print it again from the order.", 410);

    printer = await loadPrinter(conn, tenantId, job.printer_id);
    if (!printer) throw new PrintJobError("The printer for this job was deleted.", 404);
  } finally {
    conn.release();
  }
  return dispatchJob(job, printer);
};

exports.getPrintJobsDB = async (tenantId, { status, limit = 30 } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const params = [tenantId];
    let where = "j.tenant_id = ?";
    if (["queued", "sending", "printed", "failed"].includes(status)) {
      where += " AND j.status = ?";
      params.push(status);
    }
    params.push(Math.min(Math.max(Number(limit) || 30, 1), 100));
    const [rows] = await conn.query(
      `SELECT j.id, j.printer_id, p.name AS printer_name, j.agent_id, j.job_type, j.reference, j.status,
              j.attempts, j.last_error, j.created_at, j.updated_at, j.printed_at,
              (j.payload IS NOT NULL) AS can_retry
       FROM print_jobs j
       LEFT JOIN printer_configs p ON p.id = j.printer_id AND p.tenant_id = j.tenant_id
       WHERE ${where}
       ORDER BY j.id DESC
       LIMIT ?`,
      params
    );
    return rows;
  } finally {
    conn.release();
  }
};

/**
 * Called when a print agent connects: expire stale jobs, then send the backlog
 * for every printer currently assigned to the agent, oldest first.
 */
exports.flushAgentQueue = async ({ id: agentId, tenantId }) => {
  const conn = await getMySqlPromiseConnection();
  let pending;
  try {
    await expireStaleJobs(conn, tenantId);
    const [rows] = await conn.query(
      `SELECT j.id, j.tenant_id, j.job_type, j.payload,
              p.id AS p_id, p.name AS p_name, p.transport AS p_transport, p.address AS p_address, p.agent_id AS p_agent_id
       FROM print_jobs j
       JOIN printer_configs p ON p.id = j.printer_id AND p.tenant_id = j.tenant_id
       WHERE j.tenant_id = ? AND p.agent_id = ? AND j.status IN ('queued', 'sending') AND j.payload IS NOT NULL
       ORDER BY j.id ASC
       LIMIT 200`,
      [tenantId, agentId]
    );
    pending = rows;
  } finally {
    conn.release();
  }

  if (pending.length > 0) console.log(`[print-agent] flushing ${pending.length} queued job(s) to agent #${agentId}`);
  for (const row of pending) {
    const printer = { id: row.p_id, name: row.p_name, transport: row.p_transport, address: row.p_address, agent_id: row.p_agent_id };
    await dispatchJob(row, printer);
  }
};

async function expireStaleJobs(conn, tenantId = null) {
  // A kitchen ticket printed long after the order was placed does more harm
  // than good; surface it as failed so staff can reprint on purpose.
  const params = [QUEUED_JOB_MAX_AGE_MINUTES];
  let tenantFilter = "";
  if (tenantId !== null) {
    tenantFilter = " AND tenant_id = ?";
    params.push(tenantId);
  }
  await conn.query(
    `UPDATE print_jobs
     SET status = 'failed', last_error = 'Expired: printer was unreachable for too long. Reprint if still needed.'
     WHERE status IN ('queued', 'sending') AND created_at < NOW() - INTERVAL ? MINUTE${tenantFilter}`,
    params
  );
}

/**
 * Housekeeping: expire stale jobs, drop payloads of printed jobs after a day
 * and delete job history after two weeks.
 */
exports.startPrintJobMaintenance = () => {
  const run = async () => {
    const conn = await getMySqlPromiseConnection();
    try {
      await expireStaleJobs(conn);
      await conn.query(`UPDATE print_jobs SET payload = NULL WHERE payload IS NOT NULL AND status = 'printed' AND created_at < NOW() - INTERVAL 1 DAY`);
      await conn.query(`UPDATE print_jobs SET payload = NULL WHERE payload IS NOT NULL AND created_at < NOW() - INTERVAL 3 DAY`);
      await conn.query(`DELETE FROM print_jobs WHERE created_at < NOW() - INTERVAL 14 DAY`);
    } catch (error) {
      console.error("[print-jobs] maintenance error:", error.message);
    } finally {
      conn.release();
    }
  };
  setTimeout(run, 60 * 1000);
  setInterval(run, 5 * 60 * 1000).unref();
};
