const {
  getDefaultLayoutDB,
  upsertDefaultLayoutDB,
  deleteDefaultLayoutDB,
} = require("../services/dashboard_layout.service");

const MAX_ITEMS = 60;
const SUPPORTED_BREAKPOINTS = ["lg", "md", "sm", "xs", "xxs"];

function parseLayoutJson(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

function validateLayout(payload) {
  if (!payload || typeof payload !== "object") return "Invalid payload.";
  const layout = payload.layout_json;
  if (!layout || typeof layout !== "object") return "Missing layout_json.";
  if (!Array.isArray(layout.items)) return "layout_json.items must be an array.";
  if (layout.items.length > MAX_ITEMS) return `Too many widgets (max ${MAX_ITEMS}).`;

  for (const it of layout.items) {
    if (!it || typeof it !== "object") return "Invalid item.";
    if (typeof it.i !== "string" || !it.i) return "Item missing id (i).";
    if (typeof it.type !== "string" || !it.type) return "Item missing type.";
    if (it.layout && typeof it.layout !== "object") return "Item.layout must be an object.";
  }
  return null;
}

exports.getMyLayout = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    if (!username) {
      return res.status(400).json({ success: false, message: "Missing username in session." });
    }

    const row = await getDefaultLayoutDB(tenantId, username);

    if (!row) {
      return res.status(200).json({
        success: true,
        layout: null,
      });
    }

    return res.status(200).json({
      success: true,
      layout: {
        id: row.id,
        name: row.name,
        template_key: row.template_key,
        layout_json: parseLayoutJson(row.layout_json),
        version: row.version,
        updated_at: row.updated_at,
      },
    });
  } catch (error) {
    console.error("getMyLayout error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.saveMyLayout = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    if (!username) {
      return res.status(400).json({ success: false, message: "Missing username in session." });
    }

    const validation = validateLayout(req.body);
    if (validation) {
      return res.status(400).json({ success: false, message: validation });
    }

    const layout = req.body.layout_json;
    if (!layout.version) layout.version = 1;
    if (!layout.breakpoints) {
      layout.breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
    }
    if (!layout.cols) {
      layout.cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
    }

    const saved = await upsertDefaultLayoutDB(tenantId, username, {
      name: req.body.name,
      template_key: req.body.template_key || null,
      layout_json: layout,
    });

    return res.status(200).json({
      success: true,
      layout: {
        id: saved.id,
        name: saved.name,
        template_key: saved.template_key,
        layout_json: parseLayoutJson(saved.layout_json),
        version: saved.version,
        updated_at: saved.updated_at,
      },
    });
  } catch (error) {
    console.error("saveMyLayout error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.resetMyLayout = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    if (!username) {
      return res.status(400).json({ success: false, message: "Missing username in session." });
    }
    await deleteDefaultLayoutDB(tenantId, username);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("resetMyLayout error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};
