const {
    getTodaysTopSellingItemsDB,
    getTodaysOrdersCountDB,
    getTodaysNewCustomerCountDB,
    getTodaysRepeatCustomerCountDB,
    getTodaysRevenueDB,
    getYesterdaysRevenueDB,
    getYesterdaysOrdersCountDB,
    getYesterdaysNewCustomerCountDB,
    getRevenueTrendDB,
    getSalesByHourDB,
    getOrdersByTypeDB,
    getPaymentMixDB,
    getLowStockAlertsDB,
    getRecentFeedbackDB,
    getCancelledOrdersCountDB,
    getRevenueByBusinessDB,
    getOrdersByBusinessDB,
} = require("../services/dashboard.service");
const { getReservationsDB } = require("../services/reservation.service");
const { getCurrencyDB } = require("../services/settings.service");

/**
 * Merge the per-business revenue and order breakdowns into the rows the
 * Enterprise dashboard renders (Revenue by Business, Orders by Business,
 * Business Comparison, Top Performing Business).
 *
 * Names come from the scope the middleware already resolved, so no extra join
 * against `tenants` is needed. Every business in the group appears — including
 * ones with no activity today, which would otherwise silently vanish from a
 * comparison chart and look like a data error.
 */
const buildBusinessBreakdown = (scope, revenueRows, orderRows) => {
    const revenueByTenant = new Map(revenueRows.map((r) => [Number(r.tenant_id), r]));
    const ordersByTenant = new Map(orderRows.map((r) => [Number(r.tenant_id), r]));

    return scope.tenantIds
        .map((tenantId) => {
            const revenue = revenueByTenant.get(tenantId);
            const orders = ordersByTenant.get(tenantId);

            return {
                tenantId,
                name: scope.businessNames[tenantId] || `#${tenantId}`,
                revenue: Number(revenue?.revenue || 0),
                averageOrderValue: Number(revenue?.average_order_value || 0),
                invoiceCount: Number(revenue?.invoice_count || 0),
                ordersCount: Number(orders?.orders_count || 0),
                cancelledCount: Number(orders?.cancelled_count || 0),
            };
        })
        .sort((a, b) => b.revenue - a.revenue);
};

exports.getDashboardData = async (req, res) => {
    try {
        // The resolved scope drives every query. It is a single business for
        // Business Admins and Staff, so their dashboard is unchanged.
        const scope = req.dataScope;
        const isConsolidated = scope.mode === "all";

        // Currency is a per-business store setting. A group is assumed to trade
        // in one currency, so the owner's currently selected business supplies
        // it — req.user.tenant_id is still populated in both modes.
        const currencyTenantId = req.user.tenant_id || scope.tenantIds[0];

        const [
            reservations,
            topSellingItems,
            ordersCount,
            newCustomerCount,
            repeatedCustomerCount,
            currency,
            // New analytics data
            todayRevenue,
            yesterdayRevenue,
            yesterdayOrders,
            yesterdayNewCustomers,
            revenueTrend,
            salesByHour,
            ordersByType,
            paymentMix,
            lowStockAlerts,
            recentFeedback,
            cancelledOrders,
            // Enterprise-only: skipped entirely for a single business so its
            // dashboard costs exactly the queries it did before.
            revenueByBusiness,
            ordersByBusiness,
        ] = await Promise.all([
            getReservationsDB("today", null, null, scope),
            getTodaysTopSellingItemsDB(scope),
            getTodaysOrdersCountDB(scope),
            getTodaysNewCustomerCountDB(scope),
            getTodaysRepeatCustomerCountDB(scope),
            getCurrencyDB(currencyTenantId),
            // New analytics queries
            getTodaysRevenueDB(scope),
            getYesterdaysRevenueDB(scope),
            getYesterdaysOrdersCountDB(scope),
            getYesterdaysNewCustomerCountDB(scope),
            getRevenueTrendDB(scope),
            getSalesByHourDB(scope),
            getOrdersByTypeDB(scope),
            getPaymentMixDB(scope),
            getLowStockAlertsDB(scope),
            getRecentFeedbackDB(scope),
            getCancelledOrdersCountDB(scope),
            isConsolidated ? getRevenueByBusinessDB(scope) : Promise.resolve([]),
            isConsolidated ? getOrdersByBusinessDB(scope) : Promise.resolve([]),
        ]);

        const payload = {
            // Existing data (backward compatible)
            reservations,
            topSellingItems,
            ordersCount,
            newCustomerCount,
            repeatedCustomerCount,
            currency,
            // New analytics data
            todayRevenue,
            yesterdayRevenue,
            yesterdayOrders,
            yesterdayNewCustomers,
            revenueTrend,
            salesByHour,
            ordersByType,
            paymentMix,
            lowStockAlerts,
            recentFeedback,
            cancelledOrders,
        };

        // A single-business response is byte-for-byte what it was before this
        // feature: nothing below is added unless the caller is consolidating.
        if (!isConsolidated) {
            return res.status(200).json(payload);
        }

        const businesses = buildBusinessBreakdown(scope, revenueByBusiness, ordersByBusiness);

        return res.status(200).json({
            ...payload,
            scope: "all",
            businessCount: businesses.length,
            businesses,
            // Highest revenue today. Null when no business has taken money yet,
            // so the widget shows an empty state instead of an arbitrary winner.
            topPerformingBusiness: businesses.length > 0 && businesses[0].revenue > 0
                ? businesses[0]
                : null,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};
