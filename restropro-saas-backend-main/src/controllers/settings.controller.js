const { nanoid } = require("nanoid");
const { getStoreSettingDB, setStoreSettingDB, uploadStoreImageDB, deleteStoreImageDB, getPrintSettingDB, setPrintSettingDB, getTaxesDB, addTaxDB, updateTaxDB, deleteTaxDB, getTaxDB, addPaymentTypeDB, getPaymentTypesDB, updatePaymentTypeDB, deletePaymentTypeDB, togglePaymentTypeDB, addStoreTableDB, getStoreTablesDB, updateStoreTableDB, deleteStoreTableDB, addCategoryDB, getCategoriesDB, updateCategoryDB, deleteCategoryDB, getQRMenuCodeDB, updateQRMenuCodeDB, changeCategoryVisibiltyDB, updateServiceChargeDB, getServiceChargeDB, getStoreTablesWithLiveStatusDB, saveTableLayoutPositionsDB, uploadFloorPlanImageDB, deleteFloorPlanImageDB } = require("../services/settings.service");
const { getSuperAdminImageStorageConfigDB } = require("../services/image_storage.service");
const { validateImageFile, getActiveStorageConfig, getStorageProvider, buildObjectKey, detectStorageType } = require("../utils/imageStorage");
const path = require("path");
const fs = require("fs");

const STORE_IMAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const getTenantPublicDir = (tenantId) =>
    path.resolve(__dirname, "../../public", String(tenantId));

const getSafeStoreImagePath = (tenantId, uniqueId) => {
    if (typeof uniqueId !== "string" || !STORE_IMAGE_ID_PATTERN.test(uniqueId)) {
        return null;
    }

    const tenantPublicDir = getTenantPublicDir(tenantId);
    const imagePath = path.resolve(tenantPublicDir, uniqueId);

    if (imagePath !== path.join(tenantPublicDir, path.basename(imagePath))) {
        return null;
    }

    return imagePath;
};

exports.getStoreDetails = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const [result, globalStorage] = await Promise.all([
            getStoreSettingDB(tenantId),
            getSuperAdminImageStorageConfigDB(),
        ]);

        let imageStorageConfig = { publicUrl: null };
        if (globalStorage && globalStorage.status === 1 && globalStorage.credentials) {
            imageStorageConfig.publicUrl = globalStorage.credentials.public_url || null;
        }

        const storeSettings = {
            storeImage : result?.store_image || null,
            storeName: result?.store_name || null,
            address: result?.address || null,
            phone: result?.phone || null,
            email: result?.email || null,
            currency: result?.currency || null,
            image: result?.image || null,
            isQRMenuEnabled: result?.is_qr_menu_enabled || false,
            isQROrderEnabled: result?.is_qr_order_enabled || false,
            uniqueQRCode: result?.unique_qr_code || null,
            isFeedbackEnabled: result?.is_feedback_enabled || false,
            uniqueId:result?.unique_id || null,
            imageStorageConfig,
        };

        return res.status(200).json(storeSettings);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.setStoreDetails = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const storeName = req.body.storeName;
        const address = req.body.address;
        const phone = req.body.phone;
        const email = req.body.email;
        const currency = req.body.currency;
        const isQRMenuEnabled = req.body.isQRMenuEnabled;
        const isQROrderEnabled = req.body.isQROrderEnabled;
        const isFeedbackEnabled = req.body.isFeedbackEnabled;

        const uniqueQRCode = nanoid();

        const qrCodeExists = await getQRMenuCodeDB(tenantId);
        if(qrCodeExists) {
            await setStoreSettingDB(storeName, address, phone, email, currency, isQRMenuEnabled,isQROrderEnabled , uniqueQRCode, isFeedbackEnabled, tenantId);
        } else {
            await updateQRMenuCodeDB(uniqueQRCode, tenantId);
            await setStoreSettingDB(storeName, address, phone, email, currency, isQRMenuEnabled, isQROrderEnabled, uniqueQRCode, isFeedbackEnabled, tenantId);
        }

        return res.status(200).json({
            success: true,
            message: req.__("details_saved_successfully")
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.uploadStoreImage = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const file = req.files.store_image;

        // Validate file type, magic bytes, and size
        const validation = validateImageFile(file);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.error
            });
        }

        const uniqueId = nanoid();
        const storageConfig = await getActiveStorageConfig();

        let imageURL;

        if (storageConfig.mode === "cloud") {
            // Upload to R2
            const provider = getStorageProvider(storageConfig);
            const objectKey = buildObjectKey(tenantId, "store", uniqueId);

            // Fetch old store image to delete it (preventing orphaned files on re-upload)
            const storeSettings = await getStoreSettingDB(tenantId);
            const oldImage = storeSettings?.store_image;
            if (oldImage && detectStorageType(oldImage) === "cloud") {
                try { await provider.delete(oldImage); } catch (e) { console.error("Old store image delete failed:", e); }
            }

            await provider.upload(objectKey, file, file.mimetype);

            imageURL = objectKey;

            // Save to DB, rollback S3 on failure
            try {
                await uploadStoreImageDB(imageURL, uniqueId, tenantId);
            } catch (dbError) {
                // Rollback: delete the just-uploaded S3 object
                try { await provider.delete(objectKey); } catch (e) { console.error("S3 rollback failed:", e); }
                throw dbError;
            }
        } else {
            // Upload to local filesystem (existing behavior)
            const tenantPublicDir = getTenantPublicDir(tenantId);
            const imagePath = path.join(tenantPublicDir, uniqueId);

            if(!fs.existsSync(tenantPublicDir)) {
                fs.mkdirSync(tenantPublicDir, { recursive: true });
            }

            imageURL = `/public/${tenantId}/${uniqueId}`;

            await file.mv(imagePath);
            await uploadStoreImageDB(imageURL, uniqueId, tenantId);
        }

        return res.status(200).json({
            success: true,
            message: req.__("store_image_uploaded"),
            imageURL: imageURL
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.deleteStoreImage = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const uniqueId = req.body.uniqueId;

        const storeSettings = await getStoreSettingDB(tenantId);
        if(storeSettings?.unique_id !== uniqueId) {
            return res.status(200).json({
                success: false,
                message: req.__("invalid_request"),
            })
        }

        const currentImage = storeSettings?.store_image;
        const storageType = detectStorageType(currentImage);

        if (storageType === "cloud") {
            // Delete from R2
            const storageConfig = await getActiveStorageConfig();
            if (storageConfig.mode === "cloud") {
                const provider = getStorageProvider(storageConfig);
                try {
                    await provider.delete(currentImage);
                } catch (e) {
                    console.error("S3 delete failed:", e);
                }
            }
        } else if (storageType === "local") {
            // Delete from local filesystem
            const imagePath = getSafeStoreImagePath(tenantId, uniqueId);
            if (imagePath && fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await deleteStoreImageDB(null, uniqueId, tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("store_image_removed"),
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.updateServiceCharge = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const serviceCharge = req.body.serviceCharge;

        if(!(serviceCharge)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_service_charge")
            });
        }

        if(serviceCharge < 0 || serviceCharge > 100) {
            return res.status(400).json({
                success: false,
                message: req.__("invalid_service_charge")
            });
        }

        await updateServiceChargeDB(serviceCharge, tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("service_charge_updated")
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.getServiceCharge = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const serviceCharge = await getServiceChargeDB(tenantId);

        return res.status(200).json(serviceCharge);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.getPrintSettings = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const result = await getPrintSettingDB(tenantId);

        const printSettings = {
            pageFormat: result?.page_format || null,
            header: result?.header || null,
            footer: result?.footer || null,
            showNotes: result?.show_notes || null,
            isEnablePrint: result?.is_enable_print || null,
            showStoreDetails: result?.show_store_details || null,
            showCustomerDetails: result?.show_customer_details || null,
            printToken: result?.print_token || null,
            printMode: result?.print_mode || 'browser',
            autoCut: result?.auto_cut !== undefined && result?.auto_cut !== null ? Boolean(result.auto_cut) : true,
            cashDrawerKick: result?.cash_drawer_kick !== undefined && result?.cash_drawer_kick !== null ? Boolean(result.cash_drawer_kick) : true,
        };

        return res.status(200).json(printSettings);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.setPrintSettings = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;

        const pageFormat = req.body.pageFormat;
        const header = req.body.header;
        const footer = req.body.footer;
        const showNotes = req.body.showNotes;
        const isEnablePrint = req.body.isEnablePrint;
        const showStoreDetails = req.body.showStoreDetails;
        const showCustomerDetails = req.body.showCustomerDetails;
        const printToken = req.body.printToken;
        const printMode = req.body.printMode || 'browser';
        const autoCut = req.body.autoCut !== undefined ? req.body.autoCut : 1;
        const cashDrawerKick = req.body.cashDrawerKick !== undefined ? req.body.cashDrawerKick : 1;

        await setPrintSettingDB(pageFormat, header, footer, showNotes, isEnablePrint, showStoreDetails, showCustomerDetails, printToken, printMode, autoCut, cashDrawerKick, tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("details_saved_successfully")
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.getAllTaxes = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const result = await getTaxesDB(tenantId);
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.getTax = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const taxId = req.params.id;
        const result = await getTaxDB(taxId, tenantId);
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.addTax = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const title = req.body.title;
        const taxRate = req.body.rate;
        const type = req.body.type;

        if(!(title && taxRate && type)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details")
            });
        }

        const taxId = await addTaxDB(title, taxRate, type, tenantId);
        return res.status(200).json({
            success: true,
            message: req.__("tax_details_added"),
            taxId
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.updateTax = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const taxId = req.params.id;
        const title = req.body.title;
        const taxRate = req.body.rate;
        const type = req.body.type;

        if(!(title && taxRate && type)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details")
            });
        }

        await updateTaxDB(taxId, title, taxRate, type, tenantId);
        return res.status(200).json({
            success: true,
            message: req.__("tax_details_updated"),
            taxId
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.deletTax = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const taxId = req.params.id;

        await deleteTaxDB(taxId, tenantId);
        return res.status(200).json({
            success: true,
            message: req.__("tax_detail_removed"),
            taxId
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};


exports.addPaymentType = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const title = req.body.title;
        const isActive = req.body.isActive;
        const icon = req.body.icon;

        if(!(title)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details")
            });
        }

        const id = await addPaymentTypeDB(title, isActive, tenantId, icon);
        return res.status(200).json({
            success: true,
            message: req.__("payment_type_added"),
            id
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.getAllPaymentTypes = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const result = await getPaymentTypesDB(false, tenantId);
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.updatePaymentType = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const id = req.params.id;
        const title = req.body.title;
        const isActive = req.body.isActive;
        const icon = req.body.icon;

        if(!(title)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details")
            });
        }

        await updatePaymentTypeDB(id, title, isActive, tenantId, icon);
        return res.status(200).json({
            success: true,
            message: req.__("payment_type_updated"),
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.togglePaymentType = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const id = req.params.id;
        const isActive = req.body.isActive;

        await togglePaymentTypeDB(id, isActive, tenantId);
        return res.status(200).json({
            success: true,
            message: req.__("payment_type_status_updated"),
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.deletePaymentType = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const id = req.params.id;

        await deletePaymentTypeDB(id, tenantId);
        return res.status(200).json({
            success: true,
            message: req.__("payment_type_deleted"),
            id
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.addStoreTable = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const title = req.body.title;
        const floor = req.body.floor;
        const seatingCapacity = req.body.seatingCapacity;
        const shape = req.body.shape || 'round';
        const rotation = req.body.rotation || 0;
        const posX = req.body.posX !== undefined ? req.body.posX : null;
        const posY = req.body.posY !== undefined ? req.body.posY : null;

        if(!(title && floor && seatingCapacity)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details")
            });
        }

        if(seatingCapacity < 0) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_valid_seating_capacity_count")
            });
        }

        const id = await addStoreTableDB(title, floor, seatingCapacity, tenantId, shape, rotation, posX, posY);

        const io = req.app.get("io");
        if (io) {
            io.to(tenantId).emit("table_status_update", { action: "table_added", tableId: id });
        }

        return res.status(200).json({
            success: true,
            message: req.__("store_table_added"),
            id
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.getAllStoreTables = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const result = await getStoreTablesDB(tenantId);
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.getStoreTablesLiveStatus = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const result = await getStoreTablesWithLiveStatusDB(tenantId);
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.saveStoreTablesLayout = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { floor, tables, floorSettings } = req.body;

        await saveTableLayoutPositionsDB(tenantId, floor, tables, floorSettings);

        const io = req.app.get("io");
        if (io) {
            io.to(tenantId).emit("table_layout_updated", { floor, tables, floorSettings });
            io.to(tenantId).emit("table_status_update", { action: "layout_updated" });
        }

        return res.status(200).json({
            success: true,
            message: req.__("store_table_layout_saved") || "Table layout saved successfully"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.uploadFloorPlanImage = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const floor = req.body.floor || "Floor 1";

        if (!req.files || (!req.files.image && !req.files.floor_plan_image && !req.files.file)) {
            return res.status(400).json({
                success: false,
                message: "No image file provided"
            });
        }

        const file = req.files.image || req.files.floor_plan_image || req.files.file;
        const ext = (path.extname(file.name) || ".png").toLowerCase();
        const allowedExts = [".svg", ".png", ".jpg", ".jpeg", ".webp"];

        if (!allowedExts.includes(ext)) {
            return res.status(400).json({
                success: false,
                message: "Invalid file type. Only SVG, PNG, JPG, and WEBP are allowed."
            });
        }

        if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: "File size exceeds limit of 10MB"
            });
        }

        const tenantPublicDir = getTenantPublicDir(tenantId);
        const floorPlanDir = path.join(tenantPublicDir, "floor_plans");

        if (!fs.existsSync(floorPlanDir)) {
            fs.mkdirSync(floorPlanDir, { recursive: true });
        }

        const uniqueFileName = `fp_${nanoid(12)}${ext}`;
        const filePath = path.join(floorPlanDir, uniqueFileName);

        await file.mv(filePath);

        const imageURL = `/public/${tenantId}/floor_plans/${uniqueFileName}`;
        await uploadFloorPlanImageDB(tenantId, floor, imageURL);

        const io = req.app.get("io");
        if (io) {
            io.to(tenantId).emit("table_layout_updated", { floor, floorPlanImage: imageURL });
            io.to(tenantId).emit("table_status_update", { action: "floor_plan_uploaded" });
        }

        return res.status(200).json({
            success: true,
            message: "Floor plan uploaded successfully",
            imageURL: imageURL
        });
    } catch (error) {
        console.error("uploadFloorPlanImage error:", error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.deleteFloorPlanImage = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const floor = req.body.floor || "Floor 1";

        await deleteFloorPlanImageDB(tenantId, floor);

        const io = req.app.get("io");
        if (io) {
            io.to(tenantId).emit("table_layout_updated", { floor, floorPlanImage: null });
            io.to(tenantId).emit("table_status_update", { action: "floor_plan_deleted" });
        }

        return res.status(200).json({
            success: true,
            message: "Floor plan removed successfully"
        });
    } catch (error) {
        console.error("deleteFloorPlanImage error:", error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.updateStoreTable = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const id = req.params.id;
        const title = req.body.title;
        const floor = req.body.floor;
        const seatingCapacity = req.body.seatingCapacity;
        const shape = req.body.shape !== undefined ? req.body.shape : null;
        const rotation = req.body.rotation !== undefined ? req.body.rotation : null;
        const posX = req.body.posX !== undefined ? req.body.posX : null;
        const posY = req.body.posY !== undefined ? req.body.posY : null;

        if(!(title && floor && seatingCapacity)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details")
            });
        }

        await updateStoreTableDB(id, title, floor, seatingCapacity, tenantId, shape, rotation, posX, posY);

        const io = req.app.get("io");
        if (io) {
            io.to(tenantId).emit("table_status_update", { action: "table_updated", tableId: id });
        }

        return res.status(200).json({
            success: true,
            message: req.__("store_table_details_updated"),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.deleteStoreTable = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const id = req.params.id;

        await deleteStoreTableDB(id, tenantId);

        const io = req.app.get("io");
        if (io) {
            io.to(tenantId).emit("table_status_update", { action: "table_deleted", tableId: id });
        }

        return res.status(200).json({
            success: true,
            message: req.__("store_table_details_deleted"),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};


exports.addCategory = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const title = req.body.title;

        if(!(title)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details")
            });
        }

        const id = await addCategoryDB(title, tenantId);
        return res.status(200).json({
            success: true,
            message: req.__("category_added"),
            id
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const result = await getCategoriesDB(tenantId);
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const id = req.params.id;
        const title = req.body.title;

        if(!(title)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details")
            });
        }

        await updateCategoryDB(id, title, tenantId);
        return res.status(200).json({
            success: true,
            message: req.__("category_updated"),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};


exports.deleteCategory = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const id = req.params.id;

        await deleteCategoryDB(id, tenantId);
        return res.status(200).json({
            success: true,
            message: req.__("category_deleted"),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.changeCategoryVisibilty = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const id = req.params.id;
        const isEnabled = req.body.isEnabled;

        await changeCategoryVisibiltyDB(id, isEnabled, tenantId);
        return res.status(200).json({
            success: true,
            message: req.__("category_visibility_updated"),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};


// ── Image Storage Config ─────────────────────────────────────────────────────

/**
 * Save or update image storage config for the current tenant.
 * Encrypts R2 credentials before storing.
 */
