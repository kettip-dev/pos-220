const {
  getPickupQueueDB,
  markItemServedDB,
  bulkMarkItemsServedDB,
  serveAllReadyForOrderDB,
  listServiceRequestsDB,
  createServiceRequestDB,
  getServiceRequestByIdDB,
  ackServiceRequestDB,
  resolveServiceRequestDB,
  cancelServiceRequestDB,
  getFloorOverviewDB,
  listMyZonesDB,
  setMyZonesDB,
  listTableAssignmentsDB,
  setStaffTableAssignmentsDB,
  setTableAssignmentDB,
} = require("../services/waiter.service");
const { notifyCaptainCall } = require("../services/notification.service");

const ALLOWED_REASONS = [
  "water",
  "bill",
  "order_more",
  "cutlery",
  "condiments",
  "napkins",
  "clean_table",
  "complaint",
  "captain",
  "other",
];

const emitToTenant = (req, event, payload) => {
  const io = req.app.get("io");
  if (!io) return;
  io.to(String(req.user.tenant_id)).emit(event, payload);
};

exports.getPickupQueue = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { orders, items } = await getPickupQueueDB(tenantId);

    const grouped = orders
      .map((order) => ({
        ...order,
        items: items.filter((it) => it.order_id === order.id),
      }))
      .filter((o) => o.items.length > 0);

    return res.status(200).json(grouped);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.serveItem = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: req.__("invalid_request") });
    }
    await markItemServedDB(tenantId, id);
    emitToTenant(req, "order_update", { source: "waiter", orderItemId: id });
    return res.status(200).json({ success: true, message: req.__("order_item_status_updated") });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.bulkServeItems = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { orderItemIds } = req.body || {};
    if (!Array.isArray(orderItemIds) || orderItemIds.length === 0) {
      return res.status(400).json({ success: false, message: req.__("invalid_request") });
    }
    const ids = orderItemIds.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: req.__("invalid_request") });
    }
    const updated = await bulkMarkItemsServedDB(tenantId, ids);
    emitToTenant(req, "order_update", { source: "waiter", bulk: true });
    return res.status(200).json({ success: true, updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.serveOrderAll = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ success: false, message: req.__("invalid_request") });
    }
    const updated = await serveAllReadyForOrderDB(tenantId, orderId);
    emitToTenant(req, "order_update", { source: "waiter", orderId });
    return res.status(200).json({ success: true, updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.listRequests = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { status } = req.query;
    const rows = await listServiceRequestsDB(tenantId, { status });
    return res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.createRequest = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { tableId, tableTitle, floor, orderId, reason, notes, raisedBy } = req.body || {};
    const safeReason = ALLOWED_REASONS.includes(reason) ? reason : "other";

    const insertId = await createServiceRequestDB({
      tenantId,
      tableId,
      tableTitle,
      floor,
      orderId,
      reason: safeReason,
      notes,
      raisedBy: raisedBy || "waiter",
      raisedByUserId: req.user.username,
    });

    const created = await getServiceRequestByIdDB(tenantId, insertId);
    emitToTenant(req, "table_call", created);

    // Captain -> Waiter push. Fire-and-forget: a Firebase failure must never
    // fail the request creation itself.
    if (raisedBy === "captain" || safeReason === "captain") {
      notifyCaptainCall(tenantId, {
        requestId: insertId,
        tableId: created?.table_id ?? tableId,
        tableTitle: created?.table_title ?? tableTitle,
      });
    }

    return res.status(201).json({ success: true, request: created });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.ackRequest = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: req.__("invalid_request") });
    }
    await ackServiceRequestDB(tenantId, id, req.user.username);
    const updated = await getServiceRequestByIdDB(tenantId, id);
    emitToTenant(req, "request_update", updated);
    return res.status(200).json({ success: true, request: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.resolveRequest = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: req.__("invalid_request") });
    }
    await resolveServiceRequestDB(tenantId, id, req.user.username);
    const updated = await getServiceRequestByIdDB(tenantId, id);
    emitToTenant(req, "request_update", updated);
    return res.status(200).json({ success: true, request: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: req.__("invalid_request") });
    }
    await cancelServiceRequestDB(tenantId, id, req.user.username);
    const updated = await getServiceRequestByIdDB(tenantId, id);
    emitToTenant(req, "request_update", updated);
    return res.status(200).json({ success: true, request: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.getFloor = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const rows = await getFloorOverviewDB(tenantId);
    return res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.getMyZones = async (req, res) => {
  try {
    const floors = await listMyZonesDB(req.user.tenant_id, req.user.username);
    return res.status(200).json({ floors });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.setMyZones = async (req, res) => {
  try {
    const floors = Array.isArray(req.body?.floors) ? req.body.floors.filter((f) => typeof f === "string") : [];
    await setMyZonesDB(req.user.tenant_id, req.user.username, floors);
    return res.status(200).json({ success: true, floors });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

// ── Table assignments (managed from web) ──────────────────────────

exports.getTableAssignments = async (req, res) => {
  try {
    const assignments = await listTableAssignmentsDB(req.user.tenant_id);
    return res.status(200).json({ assignments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.setTableAssignments = async (req, res) => {
  try {
    const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    const role = req.body?.role === "captain" ? "captain" : "waiter";
    const tableIds = Array.isArray(req.body?.tableIds) ? req.body.tableIds : [];
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }
    await setStaffTableAssignmentsDB(req.user.tenant_id, userId, role, tableIds);
    const assignments = await listTableAssignmentsDB(req.user.tenant_id);
    return res.status(200).json({ success: true, assignments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

// Assign/clear a single table's waiter or captain (table-first dialog).
exports.setTableAssignment = async (req, res) => {
  try {
    const tableId = Number(req.body?.tableId);
    const role = req.body?.role === "captain" ? "captain" : "waiter";
    // Empty/null userId clears the assignment.
    const userId = typeof req.body?.userId === "string" && req.body.userId.trim() ? req.body.userId.trim() : null;
    if (!Number.isFinite(tableId)) {
      return res.status(400).json({ success: false, message: "tableId is required" });
    }
    await setTableAssignmentDB(req.user.tenant_id, tableId, role, userId);
    const assignments = await listTableAssignmentsDB(req.user.tenant_id);
    return res.status(200).json({ success: true, assignments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};
