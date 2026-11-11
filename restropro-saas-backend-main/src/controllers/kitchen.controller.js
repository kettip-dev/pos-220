const {
  getKitchenOrdersDB,
  updateOrderItemStatusDB,
  bulkUpdateOrderItemStatusDB,
  markOrderAllItemsStatusDB,
  getDelayReasonsDB,
  saveDelayReasonsDB,
  addKitchenDelayDB,
} = require("../services/kitchen.service");
const { notifyOrderReady } = require("../services/notification.service");

const ALLOWED_ITEM_STATUSES = ["created", "preparing", "completed", "cancelled", "delivered"];

// Broadcast a socket event to every client in the tenant's room (kitchen,
// waiter, captain). Room names are coerced to strings so they match the
// `String(tenant_id)` rooms used elsewhere (e.g. waiter.controller.js).
const emitToTenant = (req, event, payload) => {
  const io = req.app.get("io");
  if (!io) return;
  const room = String(req.user.tenant_id);
  const clients = io.sockets.adapter.rooms.get(room)?.size ?? 0;
  console.log(`[socket] emit "${event}" to tenant room "${room}" (${clients} client(s))`);
  io.to(room).emit(event, payload);
};

// When items become `completed` they are ready for the waiter to pick up, so
// also fire `ready_for_pickup` which the waiter app listens for specifically.
const broadcastItemStatusChange = (req, status, payload) => {
  emitToTenant(req, "order_update", { source: "kitchen", ...payload });
  if (status === "completed") {
    emitToTenant(req, "ready_for_pickup", { source: "kitchen", ...payload });
    // Push ORDER_READY to the assigned waiter's devices. Fire-and-forget:
    // a Firebase failure must never fail the kitchen's status update.
    notifyOrderReady(req.user.tenant_id, {
      orderId: payload.orderId,
      orderItemIds: payload.orderItemIds ?? (payload.orderItemId ? [payload.orderItemId] : undefined),
    });
  }
};

exports.getKitchenOrders = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { stationId } = req.query;
    const {addons,kitchenOrders,kitchenOrdersItems} = await getKitchenOrdersDB(tenantId, stationId);

    const formattedOrders = kitchenOrders.map((order)=>{
      const orderItems = kitchenOrdersItems.filter((oi)=>oi.order_id == order.id);
      
      orderItems.forEach((oi, index)=>{
        let addonsIds = [];
        try {
          addonsIds = oi?.addons ? JSON.parse(oi?.addons) : [];
        } catch (e) {
          addonsIds = [];
        }

        if (Array.isArray(addonsIds) && addonsIds.length > 0) {
          const itemAddons = addonsIds.map((addonRef)=>{
            if (typeof addonRef === 'object' && addonRef !== null) {
              return addonRef;
            }
            const found = addons.find((a) =>
              (typeof addonRef === 'number' || !isNaN(Number(addonRef)))
                ? a.id == addonRef
                : a.title?.toLowerCase() === String(addonRef).toLowerCase()
            );
            return found || { id: null, title: String(addonRef), price: 0 };
          });
          orderItems[index].addons = [...itemAddons.filter(Boolean)];
        } else {
          orderItems[index].addons = [];
        }
      });

      return {
        ...order,
        items: orderItems
      }
    })

    return res.status(200).json(formattedOrders);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.bulkUpdateKitchenOrderItemStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { orderItemIds, status } = req.body;

    if (!Array.isArray(orderItemIds) || orderItemIds.length === 0 || !status || !ALLOWED_ITEM_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    const numericIds = orderItemIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (numericIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    const updated = await bulkUpdateOrderItemStatusDB(tenantId, numericIds, status);

    broadcastItemStatusChange(req, status, { orderItemIds: numericIds, status, bulk: true });

    return res.status(200).json({
      success: true,
      message: req.__("order_item_status_updated"),
      updated,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.markOrderAllItemsStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const orderId = Number(req.params.orderId);
    const { status, fromStatuses, stationId } = req.body;

    if (!Number.isInteger(orderId) || orderId <= 0 || !status || !ALLOWED_ITEM_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    const filterStatuses = Array.isArray(fromStatuses)
      ? fromStatuses.filter((s) => ALLOWED_ITEM_STATUSES.includes(s))
      : null;

    const { affectedRows, allFinished } = await markOrderAllItemsStatusDB(tenantId, orderId, status, filterStatuses, stationId);

    broadcastItemStatusChange(req, status, { orderId, status, allFinished, stationId });

    return res.status(200).json({
      success: true,
      message: req.__("order_item_status_updated"),
      updated: affectedRows,
      allFinished,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.updateKitchenOrderItemStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const orderItemId = Number(req.params.id);
    const { status } = req.body

    if(!status || !ALLOWED_ITEM_STATUSES.includes(status) || !Number.isInteger(orderItemId) || orderItemId <= 0) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") // Translate message
      });
    }

    const result = await updateOrderItemStatusDB(tenantId, orderItemId, status);

    broadcastItemStatusChange(req, status, { 
      orderItemId, 
      status, 
      allFinished: result.allFinished, 
      orderId: result.orderId 
    });

    return res.status(200).json({
      success: true,
      message: req.__("order_item_status_updated"), // Translate message
      allFinished: result.allFinished
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

const toPositiveIds = (list) =>
  (Array.isArray(list) ? list : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

exports.getDelayReasons = async (req, res) => {
  try {
    const reasons = await getDelayReasonsDB(req.user.tenant_id);
    return res.status(200).json(reasons);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.saveDelayReasons = async (req, res) => {
  try {
    const input = Array.isArray(req.body?.reasons) ? req.body.reasons : null;
    if (!input || input.length > 30) {
      return res.status(400).json({ success: false, message: req.__("invalid_request") });
    }
    const reasons = [];
    for (const r of input) {
      const label = String(r?.label || "").trim().slice(0, 80);
      const minutes = Number(r?.default_minutes);
      if (!label || !Number.isInteger(minutes) || minutes < 0 || minutes > 240) {
        return res.status(400).json({ success: false, message: req.__("invalid_request") });
      }
      const id = Number(r?.id);
      reasons.push({
        id: Number.isInteger(id) && id > 0 ? id : null,
        label,
        icon: r?.icon ? String(r.icon).trim().slice(0, 16) : null,
        default_minutes: minutes,
      });
    }
    const saved = await saveDelayReasonsDB(req.user.tenant_id, reasons);
    return res.status(200).json({ success: true, reasons: saved });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.addKitchenDelay = async (req, res) => {
  try {
    const orderItemIds = toPositiveIds(req.body?.orderItemIds);
    const clear = req.body?.clear === true;
    const minutes = Number(req.body?.minutes);
    const reasonId = Number(req.body?.reasonId) || null;
    const reasonLabel = req.body?.reasonLabel ? String(req.body.reasonLabel).trim().slice(0, 80) : null;

    const minutesValid = Number.isInteger(minutes) && minutes !== 0 && Math.abs(minutes) <= 240;
    if (orderItemIds.length === 0 || orderItemIds.length > 200 || (!clear && !minutesValid)) {
      return res.status(400).json({ success: false, message: req.__("invalid_request") });
    }

    const groups = await addKitchenDelayDB(req.user.tenant_id, {
      orderItemIds,
      minutes: clear ? 0 : minutes,
      reasonId,
      reasonLabel,
      clear,
      username: req.user.username,
    });

    if (groups.length > 0) {
      emitToTenant(req, "order_update", { source: "kitchen", type: "delay", orderIds: groups.map((g) => g.orderId) });
      // Front-of-house alert: only when the kitchen actually needs more time.
      if (!clear && minutes > 0) {
        groups.forEach((g) => emitToTenant(req, "kitchen_delay", { ...g, itemIds: undefined }));
      }
    }

    return res.status(200).json({ success: true, updated: groups.reduce((n, g) => n + g.itemIds.length, 0) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};
