const {
  getKitchenOrdersDB,
  updateOrderItemStatusDB,
  bulkUpdateOrderItemStatusDB,
  markOrderAllItemsStatusDB,
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
    const {addons,kitchenOrders,kitchenOrdersItems} = await getKitchenOrdersDB(tenantId);

    const formattedOrders = kitchenOrders.map((order)=>{
      const orderItems = kitchenOrdersItems.filter((oi)=>oi.order_id == order.id);
      
      orderItems.forEach((oi, index)=>{
        const addonsIds = oi?.addons ? JSON.parse(oi?.addons) : null;

        if(addonsIds) {
          const itemAddons = addonsIds.map((addonId)=>{
            const addon = addons.filter((a)=>a.id == addonId);
            return addon[0];
          });
          orderItems[index].addons = [...itemAddons];
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
    const { status, fromStatuses } = req.body;

    if (!Number.isInteger(orderId) || orderId <= 0 || !status || !ALLOWED_ITEM_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    const filterStatuses = Array.isArray(fromStatuses)
      ? fromStatuses.filter((s) => ALLOWED_ITEM_STATUSES.includes(s))
      : null;

    const updated = await markOrderAllItemsStatusDB(tenantId, orderId, status, filterStatuses);

    broadcastItemStatusChange(req, status, { orderId, status });

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

    await updateOrderItemStatusDB(tenantId, orderItemId, status)

    broadcastItemStatusChange(req, status, { orderItemId, status });

    return res.status(200).json({
      success: true,
      message: req.__("order_item_status_updated") // Translate message
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};