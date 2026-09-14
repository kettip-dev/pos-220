const { bulkInsertMenuItemsDB, findCategoryByNameDB, findTaxByNameDB, getMenuItemsForExportDB } = require("../services/menu_item_import.service");
const { addCategoryDB } = require("../services/settings.service");

/**
 * GET /menu-items/export
 * Export all menu items as CSV download.
 */
exports.exportMenuItems = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const items = await getMenuItemsForExportDB(tenantId);

        // Build CSV string
        const headers = ["Title", "Description", "Price", "Net Price", "Category", "Tax", "Status"];
        const csvRows = [headers.join(",")];

        for (const item of items) {
            const row = [
                escapeCSV(item.title || ""),
                escapeCSV(item.description || ""),
                item.price || "",
                item.net_price || "",
                escapeCSV(item.category_title || ""),
                escapeCSV(item.tax_title || ""),
                item.status || "enabled",
            ];
            csvRows.push(row.join(","));
        }

        const csvContent = csvRows.join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=menu_items_export.csv");
        return res.status(200).send(csvContent);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later"),
        });
    }
};

/**
 * GET /menu-items/import/template
 * Download a CSV template with correct headers and sample rows.
 */
exports.downloadImportTemplate = async (req, res) => {
    try {
        const headers = ["Title", "Description", "Price", "Net Price", "Category", "Tax", "Status"];
        const sampleRows = [
            ["Margherita Pizza", "Classic margherita with fresh basil", "299", "250", "Pizza", "", "enabled"],
            ["Chicken Burger", "Grilled chicken burger with cheese", "199", "", "Burgers", "", "enabled"],
            ["Fresh Lime Soda", "Refreshing lime soda drink", "79", "60", "Beverages", "", "enabled"],
        ];

        const csvRows = [headers.join(",")];
        for (const row of sampleRows) {
            csvRows.push(row.map(escapeCSV).join(","));
        }

        const csvContent = csvRows.join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=menu_items_template.csv");
        return res.status(200).send(csvContent);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later"),
        });
    }
};

/**
 * POST /menu-items/import
 * Bulk import menu items from mapped CSV/XLSX data.
 * Body: { items: [{ title, description, price, netPrice, category, tax, status }] }
 */
exports.bulkImportMenuItems = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No items provided for import.",
            });
        }

        // Limit import size
        if (items.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Maximum 500 items can be imported at once.",
            });
        }

        const errors = [];
        const categoriesCreated = [];
        const processedItems = [];

        // Cache for category and tax lookups to avoid repeated DB queries
        const categoryCache = new Map(); // name (lowercase) -> id
        const taxCache = new Map(); // name (lowercase) -> id

        for (let i = 0; i < items.length; i++) {
            const row = items[i];
            const rowNum = i + 1;

            // Validate required fields
            const title = (row.title || "").toString().trim();
            const price = parseFloat(row.price);

            if (!title) {
                errors.push({ row: rowNum, field: "title", message: "Title is required." });
                continue;
            }
            if (isNaN(price) || price < 0) {
                errors.push({ row: rowNum, field: "price", message: "Price must be a valid number >= 0." });
                continue;
            }

            // Parse optional fields
            const description = (row.description || "").toString().trim() || null;
            const netPrice = row.netPrice ? parseFloat(row.netPrice) : null;
            const categoryName = (row.category || "").toString().trim();
            const taxName = (row.tax || "").toString().trim();
            const statusStr = (row.status || "").toString().trim().toLowerCase();

            // Resolve status
            let isEnabled = 1;
            if (["disabled", "false", "0", "no", "inactive"].includes(statusStr)) {
                isEnabled = 0;
            }

            // Resolve category
            let categoryId = null;
            if (categoryName) {
                const cacheKey = categoryName.toLowerCase();
                if (categoryCache.has(cacheKey)) {
                    categoryId = categoryCache.get(cacheKey);
                } else {
                    const existing = await findCategoryByNameDB(categoryName, tenantId);
                    if (existing) {
                        categoryId = existing.id;
                        categoryCache.set(cacheKey, categoryId);
                    } else {
                        // Auto-create category
                        const newCategoryId = await addCategoryDB(categoryName, tenantId);
                        categoryId = newCategoryId;
                        categoryCache.set(cacheKey, categoryId);
                        categoriesCreated.push(categoryName);
                    }
                }
            }

            // Resolve tax
            let taxId = null;
            if (taxName) {
                const cacheKey = taxName.toLowerCase();
                if (taxCache.has(cacheKey)) {
                    taxId = taxCache.get(cacheKey);
                } else {
                    const existing = await findTaxByNameDB(taxName, tenantId);
                    if (existing) {
                        taxId = existing.id;
                        taxCache.set(cacheKey, taxId);
                    }
                    // If not found, taxId remains null (taxes not auto-created)
                }
            }

            processedItems.push({
                title,
                description,
                price,
                netPrice: netPrice !== null && !isNaN(netPrice) ? netPrice : null,
                taxId,
                categoryId,
                isEnabled,
            });
        }

        // Bulk insert all valid items
        let insertedCount = 0;
        if (processedItems.length > 0) {
            const result = await bulkInsertMenuItemsDB(processedItems, tenantId);
            insertedCount = result.insertedCount;
        }

        return res.status(200).json({
            success: true,
            message: `Successfully imported ${insertedCount} menu items.`,
            imported: insertedCount,
            errors,
            categoriesCreated,
            totalRows: items.length,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later"),
        });
    }
};

/**
 * Escape a value for CSV output.
 * Wraps in quotes if contains comma, quote, or newline.
 */
function escapeCSV(value) {
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}
