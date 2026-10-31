const { getMySqlPromiseConnection } = require("../config/mysql.db");

exports.getProfileDB = async (username, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT 
        u.username,
        u.name,
        u.role,
        u.photo,
        u.designation,
        u.phone,
        u.email,
        u.scope,
        u.tenant_id,
        t.name AS business_name,
        t.is_active AS business_active
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.username = ? AND u.tenant_id = ?
      LIMIT 1;
    `;
    const [rows] = await conn.query(sql, [username, tenantId]);
    return rows[0] || null;
  } catch (error) {
    console.error("getProfileDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.updateProfileDB = async (username, name, phone, email, designation, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      UPDATE users
      SET name = ?, phone = ?, email = ?, designation = ?
      WHERE username = ? AND tenant_id = ?;
    `;
    await conn.query(sql, [name, phone, email, designation, username, tenantId]);
    return;
  } catch (error) {
    console.error("updateProfileDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.updatePhotoDB = async (username, photo, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      UPDATE users
      SET photo = ?
      WHERE username = ? AND tenant_id = ?;
    `;
    await conn.query(sql, [photo, username, tenantId]);
    return;
  } catch (error) {
    console.error("updatePhotoDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getUserSecurityDetailsDB = async (username, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT password, photo FROM users
      WHERE username = ? AND tenant_id = ?
      LIMIT 1;
    `;
    const [rows] = await conn.query(sql, [username, tenantId]);
    return rows[0] || null;
  } catch (error) {
    console.error("getUserSecurityDetailsDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.changePasswordDB = async (username, passwordHash, tenantId, currentRefreshToken) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      UPDATE users
      SET password = ?
      WHERE username = ? AND tenant_id = ?;
    `;
    await conn.query(sql, [passwordHash, username, tenantId]);

    // Invalidate refresh tokens of other sessions, keeping the current session alive
    if (currentRefreshToken) {
      await conn.query(
        `DELETE FROM refresh_tokens WHERE username = ? AND tenant_id = ? AND token != ?;`,
        [username, tenantId, currentRefreshToken]
      );
    }
    return;
  } catch (error) {
    console.error("changePasswordDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};
