/**
 * Firebase Admin SDK lifecycle.
 *
 * Credential resolution order (see firebase_config.service.js for storage):
 *   1. Database configuration (superadmin-managed, encrypted at rest).
 *      When a row with credentials exists it wins — and its is_enabled
 *      toggle can disable pushes globally without deleting the key.
 *   2. .env fallback (FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT_PATH /
 *      GOOGLE_APPLICATION_CREDENTIALS) for backward compatibility.
 *   3. Neither -> notifications are disabled; every getter returns null and
 *      the notification service no-ops (fire-and-forget stays intact).
 *
 * The initialized app is cached; reloadFirebase() tears it down so credential
 * changes take effect immediately without a server restart.
 */
const fs = require("fs");

const admin = require("firebase-admin");

const { CONFIG } = require("./index");
const { getDecryptedServiceAccountDB } = require("../services/firebase_config.service");

// cached = undefined -> never loaded; null -> loaded, firebase unavailable;
// otherwise { app, projectId, source: 'database' | 'env' }.
let cached;
let loadPromise = null;

const loadEnvCredential = () => {
  if (CONFIG.FIREBASE_SERVICE_ACCOUNT) {
    const parsed = JSON.parse(CONFIG.FIREBASE_SERVICE_ACCOUNT);
    return { credential: admin.credential.cert(parsed), projectId: parsed.project_id };
  }
  if (CONFIG.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const parsed = JSON.parse(fs.readFileSync(CONFIG.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
    return { credential: admin.credential.cert(parsed), projectId: parsed.project_id };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { credential: admin.credential.applicationDefault(), projectId: undefined };
  }
  return null;
};

const load = async () => {
  // 1. Database configuration takes precedence.
  try {
    const dbConfig = await getDecryptedServiceAccountDB();
    if (dbConfig) {
      if (!dbConfig.isEnabled) {
        console.log("[firebase] Push notifications disabled by superadmin toggle.");
        return null;
      }
      const app = admin.initializeApp(
        { credential: admin.credential.cert(dbConfig.serviceAccount) },
        // Named app so a stale default app from a previous config can never collide.
        `restropro-${Date.now()}`
      );
      console.log(`[firebase] Admin SDK initialized from database config (${dbConfig.serviceAccount.project_id}).`);
      return { app, projectId: dbConfig.serviceAccount.project_id, source: "database" };
    }
  } catch (error) {
    // A broken DB config must not silently fall through to stale env
    // credentials — surface it and keep pushes off until it is fixed.
    console.error("[firebase] Database config failed to load:", error.message);
    return null;
  }

  // 2. .env fallback (backward compatibility).
  try {
    const envCredential = loadEnvCredential();
    if (envCredential) {
      const app = admin.initializeApp({ credential: envCredential.credential }, `restropro-${Date.now()}`);
      console.log("[firebase] Admin SDK initialized from .env credentials.");
      return { app, projectId: envCredential.projectId, source: "env" };
    }
  } catch (error) {
    console.error("[firebase] .env credentials failed to load:", error.message);
    return null;
  }

  // 3. Nothing configured.
  console.warn("[firebase] No credentials configured (database or .env). Push notifications are disabled.");
  return null;
};

/** Lazily initialize and cache. Concurrent callers share one load. */
const getState = async () => {
  if (cached !== undefined) return cached;
  if (!loadPromise) {
    loadPromise = load()
      .then((state) => {
        cached = state;
        return state;
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
};

exports.getFirebaseApp = async () => (await getState())?.app ?? null;

exports.getMessaging = async () => {
  const state = await getState();
  return state ? admin.messaging(state.app) : null;
};

/**
 * OAuth access token for Google APIs the Admin SDK does not wrap
 * (e.g. the FCM batchImport endpoint that converts APNs tokens).
 */
exports.getFirebaseAccessToken = async () => {
  const state = await getState();
  if (!state) return null;
  const { access_token } = await state.app.options.credential.getAccessToken();
  return access_token;
};

/** { active, projectId, source } of the live instance (null fields when off). */
exports.getFirebaseRuntimeStatus = async () => {
  const state = await getState();
  return {
    active: Boolean(state),
    projectId: state?.projectId ?? null,
    source: state?.source ?? null,
  };
};

/**
 * Drop the cached instance and re-resolve credentials on next use. Called
 * after every superadmin config change so no restart is ever needed.
 */
exports.reloadFirebase = async () => {
  const state = cached;
  cached = undefined;
  if (state?.app) {
    await state.app.delete().catch((error) => {
      console.error("[firebase] Failed to delete previous app:", error.message);
    });
  }
  return getState();
};

/**
 * Initialize a throwaway app from the given (already validated) service
 * account to prove the credentials work, then tear it down. Returns the
 * project id. Used by the superadmin "Test configuration" action.
 */
exports.testServiceAccount = async (serviceAccount) => {
  const app = admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount) },
    `restropro-test-${Date.now()}`
  );
  try {
    // cert() only validates shape; force a real credential exchange so bad
    // keys (revoked, malformed private_key) fail here instead of at send time.
    await app.options.credential.getAccessToken();
    return serviceAccount.project_id;
  } finally {
    await app.delete().catch(() => {});
  }
};
