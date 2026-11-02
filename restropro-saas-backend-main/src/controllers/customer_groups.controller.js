const customerGroupsService = require("../services/customer_groups.service");

exports.getCustomerGroups = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.tenant_id;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required.",
      });
    }
    const groups = await customerGroupsService.getCustomerGroupsDB(tenantId);
    return res.status(200).json({
      success: true,
      customer_groups: groups,
    });
  } catch (error) {
    console.error("getCustomerGroups error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch customer groups.",
    });
  }
};

exports.getCustomerGroupById = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.tenant_id;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required.",
      });
    }
    const { id } = req.params;
    const group = await customerGroupsService.getCustomerGroupByIdDB(id, tenantId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Customer group not found.",
      });
    }
    return res.status(200).json({
      success: true,
      customer_group: group,
    });
  } catch (error) {
    console.error("getCustomerGroupById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch customer group.",
    });
  }
};

exports.createCustomerGroup = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.tenant_id;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required.",
      });
    }
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer group name is required.",
      });
    }

    const insertId = await customerGroupsService.createCustomerGroupDB(tenantId, req.body);
    return res.status(201).json({
      success: true,
      message: "Customer group created successfully.",
      id: insertId,
    });
  } catch (error) {
    console.error("createCustomerGroup error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create customer group.",
    });
  }
};

exports.updateCustomerGroup = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.tenant_id;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required.",
      });
    }
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer group name is required.",
      });
    }

    await customerGroupsService.updateCustomerGroupDB(id, tenantId, req.body);
    return res.status(200).json({
      success: true,
      message: "Customer group updated successfully.",
    });
  } catch (error) {
    console.error("updateCustomerGroup error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update customer group.",
    });
  }
};

exports.deleteCustomerGroup = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.tenant_id;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required.",
      });
    }
    const { id } = req.params;
    const { reassign_to = "none" } = req.query;

    await customerGroupsService.deleteCustomerGroupDB(id, tenantId, reassign_to);
    return res.status(200).json({
      success: true,
      message: "Customer group deleted successfully.",
    });
  } catch (error) {
    console.error("deleteCustomerGroup error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete customer group.",
    });
  }
};

exports.bulkAssignCustomers = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.tenant_id;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required.",
      });
    }
    const { customerPhones, customerGroupId } = req.body;

    if (!Array.isArray(customerPhones) || customerPhones.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No customer phones provided for assignment.",
      });
    }

    const affected = await customerGroupsService.bulkAssignCustomerGroupDB(
      tenantId,
      customerPhones,
      customerGroupId
    );

    return res.status(200).json({
      success: true,
      message: `Assigned ${affected} customers successfully.`,
      affected,
    });
  } catch (error) {
    console.error("bulkAssignCustomers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to bulk assign customers.",
    });
  }
};
