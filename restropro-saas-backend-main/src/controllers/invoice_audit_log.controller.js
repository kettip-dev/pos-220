const {
  getInvoiceAuditLogsDB,
  getInvoiceAuditLogsForInvoiceDB,
} = require("../services/invoice_audit_log.service");

const labelBusinesses = (rows, scope) => {
  if (scope?.mode !== "all") return rows;

  return rows.map(({ business_tenant_id, ...rest }) =>
    business_tenant_id == null
      ? rest
      : {
          ...rest,
          business: scope.businessNames?.[business_tenant_id] || `#${business_tenant_id}`,
          businessTenantId: business_tenant_id,
        }
  );
};

exports.getInvoiceAuditLogs = async (req, res) => {
  try {
    const scope = req.dataScope;
    const {
      page,
      perPage,
      invoiceNumber,
      performedBy,
      action,
      type,
      from,
      to,
    } = req.query;

    const result = await getInvoiceAuditLogsDB(scope, {
      page,
      perPage,
      invoiceNumber,
      performedBy,
      action,
      type,
      from,
      to,
    });

    return res.status(200).json({
      ...result,
      auditLogs: labelBusinesses(result.auditLogs, scope),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.getInvoiceAuditLogForInvoice = async (req, res) => {
  try {
    const scope = req.dataScope;
    const invoiceId = req.params.invoiceId;

    const auditLogs = await getInvoiceAuditLogsForInvoiceDB(scope, invoiceId);

    return res.status(200).json({
      auditLogs: labelBusinesses(auditLogs, scope),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};
