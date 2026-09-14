const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const fs = require("fs");
const { getActiveStorageConfig: getActiveStorageConfigFromDB } = require("../services/image_storage.service");
const { decryptCredentials } = require("./encryptCredentials");

// ── File validation ──────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

// Magic byte signatures for each allowed image type
const MAGIC_BYTES = [
    { type: "image/jpeg", bytes: [0xFF, 0xD8, 0xFF] },
    { type: "image/png",  bytes: [0x89, 0x50, 0x4E, 0x47] },
    { type: "image/webp", bytes: null, check: (buf) => buf.length >= 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP" },
    { type: "image/gif",  bytes: [0x47, 0x49, 0x46] },
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const R2_ENDPOINT_PATTERN = /^https?:\/\/[^/]+\.r2\.cloudflarestorage\.com\/?$/i;

exports.normalizeCloudStorageCredentials = (credentials = {}) => {
    const normalized = { ...credentials };

    // Cloudflare R2 uses the literal "auto" region for its S3-compatible API.
    if (!normalized.region && R2_ENDPOINT_PATTERN.test(String(normalized.endpoint || "").trim())) {
        normalized.region = "auto";
    }

    return normalized;
};

/**
 * Validate an uploaded image file.
 * Checks MIME type, magic bytes, and file size.
 * @param {object} file - express-fileupload file object
 * @returns {{ valid: boolean, error?: string }}
 */
exports.validateImageFile = (file) => {
    if (!file) {
        return { valid: false, error: "No file provided" };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` };
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return { valid: false, error: `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, GIF` };
    }

    // Check magic bytes
    let fileBuffer;
    if (file.tempFilePath) {
        // express-fileupload with useTempFiles=true
        fileBuffer = fs.readFileSync(file.tempFilePath).slice(0, 16);
    } else if (file.data) {
        fileBuffer = file.data.slice(0, 16);
    } else {
        return { valid: false, error: "Cannot read file data for validation" };
    }

    const magicMatch = MAGIC_BYTES.some((sig) => {
        if (sig.check) return sig.check(fileBuffer);
        if (!sig.bytes) return false;
        return sig.bytes.every((byte, i) => fileBuffer[i] === byte);
    });

    if (!magicMatch) {
        return { valid: false, error: "File content does not match an allowed image format" };
    }

    return { valid: true };
};

// ── S3 key builder ───────────────────────────────────────────────────────────

const PROJECT_PREFIX = "restropro_saas";

/**
 * Build the S3 object key for an image.
 * @param {number} tenantId
 * @param {"menu-items"|"store"} type
 * @param {string|number} id - item ID or unique ID
 * @returns {string} e.g. "restropro_saas/5/42"
 */
exports.buildObjectKey = (tenantId, type, id) => {
    // Return identical filename and path structure as local storage
    return `${PROJECT_PREFIX}/${tenantId}/${id}`;
};


// ── Storage provider factory ─────────────────────────────────────────────────

/**
 * Get the active installation-wide storage config.
 * Returns { mode: "local"|"cloud", config: {...} } 
 * If no config or status=0, returns local mode.
 */
exports.getActiveStorageConfig = async () => {
    const result = await getActiveStorageConfigFromDB();

    if (result.mode !== 'cloud' || !result.config) {
        return { mode: 'local', config: null };
    }

    // Decrypt the credentials from the global superadmin config
    const decrypted = decryptCredentials(result.config.credentials || {});

    // Ensure plaintext fields like public_url are preserved
    if (result.config.credentials && result.config.credentials.public_url) {
        decrypted.public_url = result.config.credentials.public_url;
    }

    return {
        mode: 'cloud',
        config: {
            ...result.config,
            credentials: decrypted,
        },
    };
};

/**
 * Create a storage provider object based on config.
 * Follows the same factory pattern as getPaymentGateway() in plans.service.js.
 * 
 * @param {{ mode: "local"|"cloud", config: object }} storageConfig
 * @returns {{ upload, delete, getPublicUrl }}
 */
exports.getStorageProvider = (storageConfig) => {
    if (storageConfig.mode === "local") {
        return createLocalProvider();
    }

    const creds = storageConfig.config.credentials;
    return createS3Provider(creds);
};

/**
 * Local filesystem storage provider.
 */
function createLocalProvider() {
    return {
        /**
         * Upload file to local filesystem.
         * @param {string} localPath - absolute path on disk
         * @param {object} file - express-fileupload file
         * @param {string} _contentType - unused for local
         * @returns {Promise<string>} the relative URL path
         */
        upload: async (localPath, file, _contentType) => {
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            await file.mv(localPath);
        },

        /**
         * Delete file from local filesystem.
         * @param {string} localPath - absolute path on disk
         */
        delete: async (localPath) => {
            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
        },
    };
}

/**
 * Generic S3-compatible cloud storage provider.
 * Creates a new S3Client from decrypted credentials on each call.
 */
function createS3Provider(credentials) {
    const client = new S3Client({
        region: credentials.region || "auto",
        endpoint: credentials.endpoint,
        credentials: {
            accessKeyId: credentials.access_key_id,
            secretAccessKey: credentials.secret_access_key,
        },
        forcePathStyle: false,
    });

    const bucketName = credentials.bucket_name;

    return {
        /**
         * Upload file to R2.
         * @param {string} objectKey - the S3 key (e.g., "restropro_saas/tenant_5/menu-items/42_xxx")
         * @param {object} file - express-fileupload file
         * @param {string} contentType - MIME type
         */
        upload: async (objectKey, file, contentType) => {
            let fileBuffer;
            if (file.tempFilePath) {
                fileBuffer = fs.readFileSync(file.tempFilePath);
            } else {
                fileBuffer = file.data;
            }

            await client.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: objectKey,
                Body: fileBuffer,
                ContentType: contentType || "application/octet-stream",
            }));
        },

        /**
         * Delete file from R2.
         * @param {string} objectKey - the S3 key
         */
        delete: async (objectKey) => {
            await client.send(new DeleteObjectCommand({
                Bucket: bucketName,
                Key: objectKey,
            }));
        },
    };
}


// ── Credential validation ────────────────────────────────────────────────────

/**
 * Validate generic S3-compatible storage credentials by attempting a HeadBucket call.
 * @param {object} credentials - decrypted credentials
 * @returns {{ valid: boolean, error?: string }}
 */
exports.validateCloudStorageCredentials = async (credentials) => {
    try {
        credentials = exports.normalizeCloudStorageCredentials(credentials);
        if (!credentials.endpoint || !credentials.region || !credentials.access_key_id || 
            !credentials.secret_access_key || !credentials.bucket_name || 
            !credentials.public_url) {
            return { valid: false, error: "Missing required credential fields" };
        }

        const client = new S3Client({
            region: credentials.region,
            endpoint: credentials.endpoint,
            credentials: {
                accessKeyId: credentials.access_key_id,
                secretAccessKey: credentials.secret_access_key,
            },
            forcePathStyle: false,
        });

        await client.send(new HeadBucketCommand({
            Bucket: credentials.bucket_name,
        }));

        return { valid: true };
    } catch (error) {
        console.error("Cloud storage credential validation failed:", error.message);
        return { valid: false, error: "Invalid cloud storage credentials or bucket not accessible: " + error.message };
    }
};


// ── Helper: detect storage type from stored path ─────────────────────────────

/**
 * Detect whether a stored image path is local, cloud, or external.
 * @param {string} imagePath - the value stored in the DB image column
 * @returns {"local"|"cloud"|"external"}
 */
exports.detectStorageType = (imagePath) => {
    if (!imagePath) return null;
    if (/^https?:\/\//i.test(imagePath)) return "external";
    if (imagePath.startsWith("/public/")) return "local";
    if (imagePath.startsWith(PROJECT_PREFIX + "/")) return "cloud";
    // Fallback: treat as local for backward compatibility
    return "local";
};
