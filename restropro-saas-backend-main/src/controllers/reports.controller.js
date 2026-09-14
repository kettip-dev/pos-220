const { getOrdersCountDB, getNewCustomerCountDB, getRepeatCustomerCountDB, getAverageOrderValueDB, getTotalCustomersDB, getTotalNetRevenueDB, getTotalTaxDB, getRevenueDB, getTopSellingItemsDB, getTotalPaymentsByPaymentTypesDB, getTotalServiceChargeDB, getReportByIdDB } = require("../services/reports.service")
const { getCurrencyDB } = require("../services/settings.service")

const validateReportQuery = (req, res) => {
    const from = req.query.from || null;
    const to = req.query.to || null;
    const type = req.query.type;

    if(!type) {
        res.status(400).json({
            success: false,
            message: req.__("please_provide_required_details")
        });
        return null;
    }

    if(type == 'custom' && !(from && to)) {
        res.status(400).json({
            success: false,
            message: req.__("provide_from_to_dates")
        });
        return null;
    }

    return { from, to, type };
};

exports.getReports = async (req, res) => {
    try {
        // Resolved by resolveDataScope (Phase 1). A single business for Business
        // Admins and Staff, so their totals are unchanged; the whole business
        // group for a Group Owner viewing All Businesses.
        const scope = req.dataScope;
        // Currency is a per-business store setting; the owner's selected
        // business supplies it. req.user.tenant_id is populated in both modes.
        const currencyTenantId = req.user.tenant_id || scope.tenantIds[0];

        const query = validateReportQuery(req, res);
        if(!query) return;
        const { from, to, type } = query;

        const [ordersCount, newCustomers, repeatedCustomers, averageOrderValue, totalCustomers, netRevenue, taxTotal, serviceChargeTotal,  revenueTotal, topSellingItems, totalPaymentsByPaymentTypes, currency] = await Promise.all([
            getOrdersCountDB(type, from, to, scope),
            getNewCustomerCountDB(type, from, to, scope),
            getRepeatCustomerCountDB(type, from, to, scope),
            getAverageOrderValueDB(type, from, to, scope),
            getTotalCustomersDB(scope),
            getTotalNetRevenueDB(type, from, to, scope),
            getTotalTaxDB(type, from, to, scope),
            getTotalServiceChargeDB(type, from, to, scope),
            getRevenueDB(type, from, to, scope),
            getTopSellingItemsDB(type, from, to, scope),
            getTotalPaymentsByPaymentTypesDB(type, from, to, scope),
            getCurrencyDB(currencyTenantId),
        ]);

        return res.status(200).json({
            ordersCount, newCustomers, repeatedCustomers, currency, averageOrderValue, totalCustomers, netRevenue, taxTotal, serviceChargeTotal, revenueTotal, topSellingItems, totalPaymentsByPaymentTypes
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.getReportById = async (req, res) => {
    try {
        const scope = req.dataScope;
        const currencyTenantId = req.user.tenant_id || scope.tenantIds[0];
        const reportId = req.params.reportId;

        const query = validateReportQuery(req, res);
        if(!query) return;
        const { from, to, type } = query;

        const report = await getReportByIdDB(reportId, type, from, to, scope, currencyTenantId);
        return res.status(200).json(report);
    } catch (error) {
        console.error(error);

        // Operational reports (per-table, per-kitchen, per-shift…) cannot be
        // consolidated. Answered with the same 409 + flag the rest of the
        // platform uses, so the client renders the "select a business" screen
        // rather than a generic failure.
        if (error.statusCode === 409) {
            return res.status(409).json({
                success: false,
                requiresSingleBusiness: true,
                message: req.__("select_single_business_required"),
            });
        }

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode === 404 ? "Report not found" : req.__("something_went_wrong_try_later")
        });
    }
};
