const {
  getPrintAgentsDB,
  createPrintAgentDB,
  regeneratePrintAgentTokenDB,
  deletePrintAgentDB,
} = require("../services/print_agent.service");
const { getPrintJobsDB, retryPrintJob } = require("../services/print_job.service");

function handleError(req, res, error) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(error);
  return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
}

// ─── Print Agents ─────────────────────────────────────────

exports.getPrintAgents = async (req, res) => {
  try {
    const printAgents = await getPrintAgentsDB(req.user.tenant_id);
    return res.status(200).json({ success: true, printAgents });
  } catch (error) {
    return handleError(req, res, error);
  }
};

exports.createPrintAgent = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim().slice(0, 100);
    if (!name) {
      return res.status(400).json({ success: false, message: "Agent name is required." });
    }
    const { id, token } = await createPrintAgentDB(req.user.tenant_id, name);
    // The token is only ever returned here; it is stored hashed.
    return res.status(200).json({ success: true, id, token });
  } catch (error) {
    return handleError(req, res, error);
  }
};

exports.regeneratePrintAgentToken = async (req, res) => {
  try {
    const result = await regeneratePrintAgentTokenDB(req.user.tenant_id, req.params.id);
    if (!result) return res.status(404).json({ success: false, message: "Print agent not found." });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleError(req, res, error);
  }
};

exports.deletePrintAgent = async (req, res) => {
  try {
    await deletePrintAgentDB(req.user.tenant_id, req.params.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return handleError(req, res, error);
  }
};

// ─── Print Jobs ───────────────────────────────────────────

exports.getPrintJobs = async (req, res) => {
  try {
    const printJobs = await getPrintJobsDB(req.user.tenant_id, {
      status: req.query.status,
      limit: req.query.limit,
    });
    return res.status(200).json({ success: true, printJobs });
  } catch (error) {
    return handleError(req, res, error);
  }
};

exports.retryPrintJob = async (req, res) => {
  try {
    const result = await retryPrintJob(req.user.tenant_id, req.params.id);
    if (result.status === "printed") return res.status(200).json({ success: true, ...result });
    if (result.status === "queued" || result.status === "sending") return res.status(202).json({ success: true, ...result });
    return res.status(502).json({ success: false, ...result });
  } catch (error) {
    return handleError(req, res, error);
  }
};
