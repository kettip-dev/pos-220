const { doCustomerExistDB, addCustomerDB, getCustomersDB, updateCustomerDB, deleteCustomerDB, getCustomerDB, searchCustomerDB, getAllCustomersDB, uploadBulkCustomersDB, getCustomerInsightsDB, getCustomerInvoicesDB } = require("../services/customer.service");

exports.addCustomer = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const phone = req.body.phone;
        const name = req.body.name;
        const email = req.body.email;
        const birthDate = req.body.birthDate;
        const gender = req.body.gender;
        const isMember = req.body.isMember;

        if(!(phone && name)) {
            return res.status(400).json({
                success: false,
                message: req.__("customer_provide_required_details") // Translate message
            });
        }

        const doCustomerExist = await doCustomerExistDB(phone, tenantId);

        if(doCustomerExist) {
            return res.status(400).json({
                success: false,
                message: req.__("customer_already_exists", { phone }) // Translate message
            });
        }

        await addCustomerDB(phone, name, email, birthDate, gender, isMember, tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("customer_added", { phone }) // Translate message
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

/**
 * Replace the internal tenant id(s) on a consolidated row with the business
 * name(s) the UI shows in its Business column.
 *
 * Names come from the scope the middleware already resolved, so this costs no
 * query. Returns rows untouched for a single business, keeping that response
 * byte-identical to before Enterprise mode.
 */
const labelBusinesses = (rows, scope) => {
    if (scope?.mode !== "all") return rows;

    const nameOf = (tenantId) => scope.businessNames?.[tenantId] || `#${tenantId}`;

    return rows.map(({ business_tenant_id, business_tenant_ids, ...rest }) => {
        // Grouped list rows carry a CSV of ids; flat rows carry a single id.
        const ids = business_tenant_ids
            ? String(business_tenant_ids).split(",").filter(Boolean)
            : business_tenant_id != null
                ? [business_tenant_id]
                : [];

        if (ids.length === 0) return rest;

        const businesses = ids.map(nameOf);
        return { ...rest, businesses, business: businesses.join(", ") };
    });
};

exports.getCustomers = async (req, res) => {
    try {
        const scope = req.dataScope;

        const { page, perPage, sort, filter } = req.query;

        const result = await getCustomersDB(page, perPage, sort, filter, scope);

        return res.status(200).json({
            ...result,
            customers: labelBusinesses(result.customers, scope),
            ...(scope.mode === "all" ? { scope: "all", businessCount: scope.tenantIds.length } : {}),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.getAllCustomers = async (req, res) => {
    try {
        const scope = req.dataScope;

        const result = await getAllCustomersDB(scope);

        return res.status(200).json(labelBusinesses(result, scope));
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.uploadBulkCustomers = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const customers = req.body.customers;

        if(customers?.length == 0) {
            return res.status(400).json({
                success: false, 
                message: req.__("empty_file_provided") // Translate message
            });
        }

        const formattedResult = customers.map((item, i)=>{
            const phone = item[0]
            const name = item[1]
            const email = item[2] || null
            const birth_date = item[3] || null
            const gender = item[4] || null

            if(gender) {
                const g = new String(gender).toLowerCase();
                if(g != "male" && g != "female") {
                    throw new Error(req.__("invalid_gender_value", { row: i+1, phone })) // Translate message
                }
            }

            return [phone, name, email, birth_date, gender, tenantId];
        })

        await uploadBulkCustomersDB(formattedResult);

        return res.status(200).json({
            success: true,
            message: req.__("customers_uploaded_successfully") // Translate message
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message || req.__("something_went_wrong_try_later"), // Translate message
        });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const phone = req.params.id;
        const name = req.body.name;
        const email = req.body.email;
        const birthDate = req.body.birthDate;
        const gender = req.body.gender;

        if(!(phone && name)) {
            return res.status(400).json({
                success: false,
                message: req.__("customer_provide_required_details") // Translate message
            });
        }

        await updateCustomerDB(phone, name, email, birthDate, gender, tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("customer_details_updated", { phone }) // Translate message
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};


exports.deleteCustomer = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const phone = req.params.id;

        await deleteCustomerDB(phone, tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("customer_deleted", { phone }) // Translate message
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.getCustomer = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const phone = req.params.id;

        const result = await getCustomerDB(phone, tenantId);

        if(result) {
            return res.status(200).json(result);
        }
        return res.status(404).json({
            success: false,
            message: req.__("no_customer_found", { phone }) // Translate message
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.searchCustomer = async (req, res) => {
    try {
        const scope = req.dataScope;

        const searchString = req.query.q;

        const result = await searchCustomerDB(searchString, scope);

        if(result.length > 0) {
            return res.status(200).json(labelBusinesses(result, scope));
        }
        return res.status(404).json({
            success: false,
            message: req.__("no_customers_found") // Translate message
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.getCustomerInsights = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const phone = req.params.id;

        const result = await getCustomerInsightsDB(phone, tenantId);

        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.getCustomerInvoices = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const phone = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await getCustomerInvoicesDB(phone, tenantId, page, limit);

        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};