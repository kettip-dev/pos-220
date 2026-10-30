const {
  addVendorDB,
  getVendorsDB,
  getVendorDetailsDB,
  updateVendorDB,
  deleteVendorDB,
  getAllVendorsSimpleDB,
} = require("../services/vendor.service");

exports.addVendor = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { name, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Supplier name is required.",
      });
    }

    const newId = await addVendorDB(req.body, tenantId);

    return res.status(201).json({
      success: true,
      message: "Supplier added successfully.",
      vendorId: newId,
    });
  } catch (error) {
    console.error("addVendor error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add supplier.",
    });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { page = 1, perPage = 10, search = "" } = req.query;

    const data = await getVendorsDB(page, perPage, search, tenantId);

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("getVendors error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch suppliers.",
    });
  }
};

exports.getVendorDetails = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const vendor = await getVendorDetailsDB(id, tenantId);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found.",
      });
    }

    return res.status(200).json({
      success: true,
      vendor,
    });
  } catch (error) {
    console.error("getVendorDetails error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch supplier details.",
    });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Supplier name is required.",
      });
    }

    const updated = await updateVendorDB(id, req.body, tenantId);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found or no changes made.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Supplier updated successfully.",
    });
  } catch (error) {
    console.error("updateVendor error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update supplier.",
    });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    await deleteVendorDB(id, tenantId);

    return res.status(200).json({
      success: true,
      message: "Supplier deleted successfully.",
    });
  } catch (error) {
    console.error("deleteVendor error:", error);
    if (error.code === "HAS_ACTIVE_ORDERS") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete supplier.",
    });
  }
};

exports.getAllVendorsSimple = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const vendors = await getAllVendorsSimpleDB(tenantId);

    return res.status(200).json({
      success: true,
      vendors,
    });
  } catch (error) {
    console.error("getAllVendorsSimple error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch simple suppliers list.",
    });
  }
};
