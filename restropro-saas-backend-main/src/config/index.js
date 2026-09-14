// Browsers cannot scope cookies to a raw IP address.
// If FRONTEND_DOMAIN_COOKIE is an IP, omit the domain attribute entirely so
// the browser automatically scopes the cookie to whatever host served it.
function resolveCookieDomain(value) {
  if (!value) return undefined;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return ipRegex.test(value.trim()) ? undefined : value.trim();
}

exports.CONFIG = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRY: process.env.JWT_EXPIRY,
    JWT_EXPIRY_REFRESH: process.env.JWT_EXPIRY_REFRESH,
    COOKIE_EXPIRY: process.env.COOKIE_EXPIRY,
    COOKIE_EXPIRY_REFRESH: process.env.COOKIE_EXPIRY_REFRESH,
    FRONTEND_DOMAIN: process.env.FRONTEND_DOMAIN,
    FRONTEND_DOMAIN_COOKIE: resolveCookieDomain(process.env.FRONTEND_DOMAIN_COOKIE),
    PASSWORD_SALT: parseInt(process.env.PASSWORD_SALT) || 10,
    STRIPE_SECRET: process.env.STRIPE_SECRET,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_EMAIL: process.env.SMTP_EMAIL,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    // Firebase Admin (push notifications). Provide ONE of:
    //  - FIREBASE_SERVICE_ACCOUNT: the service account JSON as a single-line string
    //  - FIREBASE_SERVICE_ACCOUNT_PATH: path to the service account JSON file
    //  - GOOGLE_APPLICATION_CREDENTIALS: standard ADC path (picked up automatically)
    FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
    FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    // iOS bundle id registered in the Firebase project; used to exchange APNs
    // tokens for FCM registration tokens when an iOS device registers.
    FIREBASE_IOS_BUNDLE_ID: process.env.FIREBASE_IOS_BUNDLE_ID || "com.uiflow.waiterapp",
    // "true" while sending to development (sandbox) APNs builds.
    FIREBASE_APNS_SANDBOX: process.env.FIREBASE_APNS_SANDBOX === "true",
    // Day-end reconciliation push (Owner App). The scheduler ticks every minute
    // and fires the first tick at or after this time, read on the *database*
    // clock so it lines up with the "today" report it summarises. Set
    // DAY_END_RECONCILIATION_ENABLED=false to turn the sweep off.
    DAY_END_RECONCILIATION_ENABLED: process.env.DAY_END_RECONCILIATION_ENABLED !== "false",
    DAY_END_RECONCILIATION_TIME: process.env.DAY_END_RECONCILIATION_TIME || "23:59",
    // Owner App report the notification tap opens.
    DAY_END_RECONCILIATION_REPORT_ID: process.env.DAY_END_RECONCILIATION_REPORT_ID || "payment-summary",
};

exports.LANGUAGES = [
    'en',
    'km'
]
