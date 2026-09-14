const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Get the active storage configuration for this white-label installation.
 * Returns { mode: 'local'|'cloud', config: null|Object }
 */
exports.getActiveStorageConfig = async () => {
    try {
        const superAdminConfig = await exports.getSuperAdminImageStorageConfigDB();
        if (
            superAdminConfig &&
            superAdminConfig.provider_name !== 'local' &&
            superAdminConfig.status === 1 &&
            superAdminConfig.credentials
        ) {
            return { mode: 'cloud', config: superAdminConfig };
        }

        return { mode: 'local', config: null };
    } catch (error) {
        console.error("Error getting active storage config:", error);
        return { mode: 'local', config: null };
    }
};

/**
 * Get the global image storage config for superadmin.
 */
exports.getSuperAdminImageStorageConfigDB = async () => {
    const conn = await getMySqlPromiseConnection();
    try {
        const [rows] = await conn.query(
            `SELECT *
             FROM superadmin_service_configs
             WHERE provider_name IN ('local', 's3')
             ORDER BY id ASC
             LIMIT 1`
        );
        if (!rows.length) return null;

        return {
            id: rows[0].id,
            provider_name: rows[0].provider_name,
            credentials: rows[0].credentials ? JSON.parse(rows[0].credentials) : null,
            status: rows[0].status,
            created_at: rows[0].created_at,
            updated_at: rows[0].updated_at,
        };
    } catch (error) {
        console.error("getSuperAdminImageStorageConfigDB error:", error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Upsert the global image storage config for superadmin.
 */
exports.upsertSuperAdminImageStorageConfigDB = async (providerName, credentials, status) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
            INSERT INTO superadmin_service_configs (id, provider_name, credentials, status)
            VALUES (1, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                provider_name = VALUES(provider_name),
                credentials = VALUES(credentials),
                status = VALUES(status)
        `;

        await conn.query(sql, [
            providerName,
            credentials ? JSON.stringify(credentials) : null,
            status ? 1 : 0,
        ]);

        return true;
    } catch (error) {
        console.error("upsertSuperAdminImageStorageConfigDB error:", error);
        throw error;
    } finally {
        conn.release();
    }
};
