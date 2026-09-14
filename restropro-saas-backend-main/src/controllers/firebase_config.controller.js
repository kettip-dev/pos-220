/**
 * Superadmin-only management of the platform-global Firebase (FCM)
 * configuration. Responses NEVER include the service account JSON or any of
 * its fields except project_id — the private key, client_email, etc. stay
 * encrypted in the database and are only decrypted to initialize the Admin
 * SDK. Tenants have no access to any of these endpoints.
 */
const {
  parseServiceAccount,
  getFirebaseConfigStatusDB,
  upsertFirebaseConfigDB,
  deleteFirebaseConfigDB,
  getDecryptedServiceAccountDB,
} = require("../services/firebase_config.service");
const {
  reloadFirebase,
  testServiceAccount,
  getFirebaseRuntimeStatus,
} = require("../config/firebase");

/**
 * GET /superadmin/firebase-config
 * Sanitized status only — safe to render in the UI.
 */
exports.getFirebaseConfig = async (req, res) => {
  try {
    const row = await getFirebaseConfigStatusDB();
    const runtime = await getFirebaseRuntimeStatus();

    return res.status(200).json({
      configured: Boolean(row?.has_credentials),
      enabled: row ? row.is_enabled === 1 : false,
      projectId: row?.project_id ?? null,
      updatedBy: row?.updated_by ?? null,
      updatedAt: row?.updated_at ?? null,
      // Whether pushes are currently possible, and from which credential
      // source ('database' | 'env' | null). Lets the UI show that the
      // platform is still running on .env credentials before any upload.
      active: runtime.active,
      source: runtime.source,
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
 * PUT /superadmin/firebase-config
 * Body: { serviceAccountJson?: string | object, isEnabled?: boolean }
 * Upload/replace the service account and/or flip the enable toggle. The
 * config is validated, encrypted, saved, and the Admin SDK is reinitialized
 * in-process — no restart.
 */
exports.updateFirebaseConfig = async (req, res) => {
  try {
    const { serviceAccountJson, isEnabled } = req.body ?? {};

    if (serviceAccountJson === undefined && isEnabled === undefined) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update — provide serviceAccountJson and/or isEnabled.",
      });
    }
    if (isEnabled !== undefined && typeof isEnabled !== "boolean") {
      return res.status(400).json({ success: false, message: "isEnabled must be a boolean." });
    }

    let serviceAccount;
    if (serviceAccountJson !== undefined) {
      try {
        serviceAccount = parseServiceAccount(serviceAccountJson);
        // Prove the key actually authenticates before persisting it.
        await testServiceAccount(serviceAccount);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Invalid Firebase configuration. ${error.message}`,
        });
      }
    } else {
      // Toggling only makes sense once credentials exist somewhere the
      // toggle governs (i.e. in the database).
      const existing = await getFirebaseConfigStatusDB();
      if (!existing?.has_credentials) {
        return res.status(400).json({
          success: false,
          message: "Upload a service account JSON before enabling/disabling notifications.",
        });
      }
    }

    await upsertFirebaseConfigDB({
      serviceAccount,
      isEnabled,
      updatedBy: req.user?.username ?? null,
    });

    // Hot-swap the Admin SDK to the new credentials/state.
    const runtime = await reloadFirebase().then(() => getFirebaseRuntimeStatus());

    return res.status(200).json({
      success: true,
      message: "Firebase configuration saved.",
      active: runtime.active,
      projectId: runtime.projectId,
      source: runtime.source,
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
 * POST /superadmin/firebase-config/test
 * Body: { serviceAccountJson?: string | object }
 * With a body: validate + authenticate that JSON (pre-save check).
 * Without: test the currently stored configuration.
 */
exports.testFirebaseConfig = async (req, res) => {
  try {
    const { serviceAccountJson } = req.body ?? {};

    let serviceAccount;
    if (serviceAccountJson !== undefined) {
      serviceAccount = parseServiceAccount(serviceAccountJson);
    } else {
      const stored = await getDecryptedServiceAccountDB();
      if (!stored) {
        return res.status(400).json({
          success: false,
          message: "Invalid Firebase configuration. No service account is configured.",
        });
      }
      serviceAccount = stored.serviceAccount;
    }

    const projectId = await testServiceAccount(serviceAccount);
    return res.status(200).json({ success: true, projectId });
  } catch (error) {
    // Validation/auth failures are expected outcomes of a test — 200-level
    // handling would also be defensible, but mirror the PUT behavior.
    console.error("[firebase] Test configuration failed:", error.message);
    return res.status(400).json({
      success: false,
      message: `Invalid Firebase configuration. ${error.message ?? ""}`.trim(),
    });
  }
};

/**
 * DELETE /superadmin/firebase-config
 * Remove stored credentials and reinitialize. Per the credential resolution
 * order, Firebase falls back to .env credentials when present; with no .env
 * credentials (the normal production case) notifications become disabled.
 */
exports.deleteFirebaseConfig = async (req, res) => {
  try {
    await deleteFirebaseConfigDB();
    const runtime = await reloadFirebase().then(() => getFirebaseRuntimeStatus());

    return res.status(200).json({
      success: true,
      message: "Firebase configuration removed.",
      active: runtime.active,
      source: runtime.source,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};
