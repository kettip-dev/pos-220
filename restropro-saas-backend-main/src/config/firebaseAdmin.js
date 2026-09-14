/**
 * Firebase Admin Authentication wrapper.
 *
 * Uses `firebase.js` as reference to dynamically resolve Firebase Admin credentials
 * from the database (encrypted at rest via firebase_config table) with .env fallback.
 */
const { getAuth } = require("firebase-admin/auth");
const { getFirebaseApp } = require("./firebase");

/**
 * Proxy for Firebase Auth instance that lazily initializes the app from the
 * database on first method invocation (e.g. verifyIdToken).
 */
const authProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      return async (...args) => {
        const app = await getFirebaseApp();
        if (!app) {
          throw new Error(
            "Firebase Admin SDK is not configured. Please configure Firebase settings in SuperAdmin."
          );
        }
        const authInstance = getAuth(app);
        const targetAttr = authInstance[prop];
        if (typeof targetAttr === "function") {
          return targetAttr.apply(authInstance, args);
        }
        return targetAttr;
      };
    },
  }
);

module.exports = {
  get app() {
    return getFirebaseApp();
  },
  auth: () => authProxy,
};
