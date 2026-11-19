const {
  getPmsSettingsDB,
  savePmsSettingsDB,
  verifyRoomGuestDB,
  getCheckedInRoomsDB,
  postRoomChargeForOrderDB,
  voidRoomChargeForOrderDB,
  getSyncQueueDB,
  processSyncQueueDB,
} = require("../services/pms.service");

exports.getPmsSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const settings = await getPmsSettingsDB(tenantId);
    return res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("getPmsSettings error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve PMS settings.",
    });
  }
};

exports.savePmsSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { is_enabled, pms_base_url, pms_property_id, pms_api_key, auto_post_on_settle } = req.body;

    const updated = await savePmsSettingsDB(tenantId, {
      is_enabled: Boolean(is_enabled),
      pms_base_url,
      pms_property_id,
      pms_api_key,
      auto_post_on_settle: auto_post_on_settle !== undefined ? Boolean(auto_post_on_settle) : 1,
    });

    return res.status(200).json({
      success: true,
      message: "PMS settings updated successfully.",
      settings: updated,
    });
  } catch (error) {
    console.error("savePmsSettings error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save PMS settings.",
    });
  }
};

exports.verifyRoom = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const roomNumber = req.query.room || req.query.room_number;

    if (!roomNumber || !String(roomNumber).trim()) {
      return res.status(400).json({
        success: false,
        message: "Room number query parameter is required.",
      });
    }

    const verification = await verifyRoomGuestDB(tenantId, String(roomNumber).trim());
    return res.status(200).json({
      success: true,
      ...verification,
    });
  } catch (error) {
    console.error("verifyRoom error:", error);
    return res.status(error.status || 500).json({
      success: false,
      valid: false,
      message: error.message || "Error communicating with PMS to verify room.",
    });
  }
};

exports.getCheckedInRooms = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const result = await getCheckedInRoomsDB(tenantId);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("getCheckedInRooms error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Error fetching checked-in rooms from PMS.",
    });
  }
};

exports.postRoomCharge = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const orderId = req.params.id;
    const username = req.user.username || "Bong POS Cashier";

    const result = await postRoomChargeForOrderDB(tenantId, orderId, username);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("postRoomCharge error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to post room charge to PMS.",
    });
  }
};

exports.voidRoomCharge = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const orderId = req.params.id;
    const voidReason = req.body.void_reason || req.body.reason || "Order cancelled in POS";

    const result = await voidRoomChargeForOrderDB(tenantId, orderId, voidReason);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("voidRoomCharge error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to void room charge in PMS.",
    });
  }
};

exports.getSyncQueue = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const queue = await getSyncQueueDB(tenantId);
    return res.status(200).json({
      success: true,
      queue,
    });
  } catch (error) {
    console.error("getSyncQueue error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve sync queue.",
    });
  }
};

exports.retrySyncQueue = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const result = await processSyncQueueDB(tenantId);
    return res.status(200).json({
      success: true,
      message: "Sync queue processing completed.",
      ...result,
    });
  } catch (error) {
    console.error("retrySyncQueue error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process sync queue.",
    });
  }
};
