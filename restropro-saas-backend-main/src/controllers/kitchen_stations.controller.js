const {
  getKitchenStationsDB,
  addKitchenStationDB,
  updateKitchenStationDB,
  deleteKitchenStationDB,
} = require("../services/kitchen_stations.service");

exports.getKitchenStations = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const stations = await getKitchenStationsDB(tenantId);
    return res.status(200).json(stations);
  } catch (error) {
    console.error("getKitchenStations error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.addKitchenStation = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { name, color, icon, printer_id, is_enabled, sort_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"),
      });
    }

    const id = await addKitchenStationDB(tenantId, {
      name: name.trim(),
      color,
      icon,
      printer_id,
      is_enabled,
      sort_order,
    });

    return res.status(200).json({
      success: true,
      message: req.__("kitchen_station_added") || "Kitchen station created successfully",
      id,
    });
  } catch (error) {
    console.error("addKitchenStation error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.updateKitchenStation = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = Number(req.params.id);
    const { name, color, icon, printer_id, is_enabled, sort_order } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    await updateKitchenStationDB(tenantId, id, {
      name: name ? name.trim() : undefined,
      color,
      icon,
      printer_id,
      is_enabled,
      sort_order,
    });

    return res.status(200).json({
      success: true,
      message: req.__("kitchen_station_updated") || "Kitchen station updated successfully",
    });
  } catch (error) {
    console.error("updateKitchenStation error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.deleteKitchenStation = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = Number(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    await deleteKitchenStationDB(tenantId, id);

    return res.status(200).json({
      success: true,
      message: req.__("kitchen_station_deleted") || "Kitchen station deleted successfully",
    });
  } catch (error) {
    console.error("deleteKitchenStation error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};
