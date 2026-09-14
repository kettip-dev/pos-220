const { getMySqlPromiseConnection } = require("../config/mysql.db");

const DEFAULT_NAME = "My Dashboard";

exports.getDefaultLayoutDB = async (tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, name, template_key, layout_json, version, updated_at
         FROM dashboard_layouts
        WHERE tenant_id = ? AND username = ? AND is_default = 1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [tenantId, username]
    );
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

exports.upsertDefaultLayoutDB = async (tenantId, username, payload) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const name = payload.name || DEFAULT_NAME;
    const layoutJson = JSON.stringify(payload.layout_json);
    const templateKey = payload.template_key || null;

    await conn.query(
      `INSERT INTO dashboard_layouts
         (tenant_id, username, name, is_default, template_key, layout_json, version)
       VALUES (?, ?, ?, 1, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         template_key = VALUES(template_key),
         layout_json  = VALUES(layout_json),
         version      = version + 1,
         is_default   = 1`,
      [tenantId, username, name, templateKey, layoutJson]
    );

    const [rows] = await conn.query(
      `SELECT id, name, template_key, layout_json, version, updated_at
         FROM dashboard_layouts
        WHERE tenant_id = ? AND username = ? AND name = ?`,
      [tenantId, username, name]
    );
    return rows[0];
  } finally {
    conn.release();
  }
};

exports.deleteDefaultLayoutDB = async (tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(
      `DELETE FROM dashboard_layouts
        WHERE tenant_id = ? AND username = ? AND is_default = 1`,
      [tenantId, username]
    );
  } finally {
    conn.release();
  }
};
