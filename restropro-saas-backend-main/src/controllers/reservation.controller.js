const { nanoid } = require("nanoid");
const { addReservationDB, updateReservationDB, cancelReservationDB, deleteReservationDB, searchReservationsDB, getReservationsDB, getReservationSummaryDB, getReservationsByBusinessDB } = require("../services/reservation.service");
const { getStoreTablesDB } = require("../services/settings.service")

/**
 * Replace the internal tenant id on a consolidated row with the business name
 * the UI shows in its Business column. Costs no query — names come from the
 * scope the middleware already resolved. Rows are untouched for a single
 * business, keeping those responses byte-identical to before Enterprise mode.
 */
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

/**
 * Businesses in the caller's group whose NAME matches the search term, so
 * "search by business" works off the resolved scope instead of a join on
 * `tenants` — and can never widen the result beyond the group.
 */
const businessIdsMatchingName = (scope, search) => {
    if (scope?.mode !== "all") return [];
    const needle = String(search || "").trim().toLowerCase();
    if (!needle) return [];

    return Object.entries(scope.businessNames || {})
        .filter(([, name]) => String(name).toLowerCase().includes(needle))
        .map(([tenantId]) => Number(tenantId));
};

exports.initReservation = async (req, res) => {
    try {
        const scope = req.dataScope;
        const isConsolidated = scope.mode === "all";
        // Tables belong to one business, and are only used to ASSIGN a table —
        // an operation that already requires a single business — so this keeps
        // using the selected business in both modes.
        const tenantId = req.user.tenant_id || scope.tenantIds[0];

        const [storeTables, summary, byBusiness] = await Promise.all([
            getStoreTablesDB(tenantId),
            // Two extra queries, and only when consolidating.
            isConsolidated ? getReservationSummaryDB(scope) : Promise.resolve(null),
            isConsolidated ? getReservationsByBusinessDB(scope) : Promise.resolve([]),
        ]);

        if (!isConsolidated) {
            return res.status(200).json({
                storeTables
            });
        }

        const byTenant = new Map(byBusiness.map((r) => [Number(r.tenant_id), r]));

        return res.status(200).json({
            storeTables,
            scope: "all",
            businessCount: scope.tenantIds.length,
            summary,
            // Every business in the group is listed, including ones with no
            // reservations — a business missing from a comparison reads as a
            // data error rather than as "none yet".
            businesses: scope.tenantIds
                .map((tenantId) => {
                    const row = byTenant.get(Number(tenantId));
                    return {
                        tenantId,
                        business: scope.businessNames?.[tenantId] || `#${tenantId}`,
                        total: Number(row?.total || 0),
                        today: Number(row?.today || 0),
                        upcoming: Number(row?.upcoming || 0),
                        booked: Number(row?.booked || 0),
                        paid: Number(row?.paid || 0),
                        cancelled: Number(row?.cancelled || 0),
                        guests: Number(row?.guests || 0),
                    };
                })
                .sort((a, b) => b.total - a.total),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.addReservation = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        
        const customerId = req.body.customerId;
        const date = req.body.date;
        const tableId = req.body.tableId;
        const status = req.body.status;
        const notes = req.body.notes;
        const peopleCount = req.body.peopleCount;
        
        if(!(customerId && date && peopleCount)) {
            return res.status(400).json({
                success: false,
                message: req.__("reservation_provide_required_details") // Translate message
            });
        }

        const uniqueCode = nanoid(10);

        const reservationId = await addReservationDB(customerId, date, tableId, status, notes, peopleCount, uniqueCode, tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("reservation_done"), // Translate message
            reservationId,
            uniqueCode
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.updateReservation = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const reservationId = req.params.id;
        const date = req.body.date;
        const tableId = req.body.tableId;
        const status = req.body.status;
        const notes = req.body.notes;
        const peopleCount = req.body.peopleCount;
        
        await updateReservationDB(reservationId, date, tableId, status, notes, peopleCount, tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("reservation_details_updated"), // Translate message
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.cancelReservation = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const reservationId = req.params.id;
        await cancelReservationDB(reservationId, "CANCELLED", tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("reservation_cancelled"), // Translate message
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.deleteReservation = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const reservationId = req.params.id;
        await deleteReservationDB(reservationId, tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("reservation_deleted"), // Translate message
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.searchReservation = async (req, res) => {
    try {
        const scope = req.dataScope;

        const searchString = req.query.q;

        if(!searchString) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details") // Translate message
            });
        }

        const result = await searchReservationsDB(
            searchString,
            scope,
            businessIdsMatchingName(scope, searchString)
        );

        if(result.length > 0) {
            return res.status(200).json(labelBusinesses(result, scope));
        } else {
            return res.status(404).json({
                success: false,
                message: req.__("no_results_found") // Translate message
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.getReservations = async (req, res) => {
    try {
        const scope = req.dataScope;

        const from = req.query.from || null;
        const to = req.query.to || null;
        const type = req.query.type;

        if(!type) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details") // Translate message
            });
        }

        if(type == 'custom') {
            if(!(from && to)) {
                return res.status(400).json({
                    success: false,
                    message: req.__("provide_from_to_dates") // Translate message
                });
            }
        }

        const result = await getReservationsDB(type, from, to, scope);

        // ALWAYS a bare array, in both modes. The page does
        // `reservations.map(...)` directly on this response, so returning an
        // object when consolidating would crash it. The Enterprise KPIs and the
        // per-business breakdown are served by /reservations/init instead,
        // which already returns an object.
        return res.status(200).json(
            result.length > 0 ? labelBusinesses(result, scope) : []
        );
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};