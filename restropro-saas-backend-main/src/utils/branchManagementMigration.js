/**
 * Migration: Ensures multi-branch management columns and quotas exist.
 * Idempotent: safe to run on every startup.
 */
exports.ensureBranchManagementSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      const hasColumn = async (tableName, columnName) => {
        const [rows] = await conn.query(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = ? 
             AND COLUMN_NAME = ?`,
          [tableName, columnName]
        );
        return rows.length > 0;
      };

      // 1. Add max_branches to business_groups if missing
      if (!(await hasColumn("business_groups", "max_branches"))) {
        await conn.query(`
          ALTER TABLE business_groups 
          ADD COLUMN max_branches INT NOT NULL DEFAULT 5
        `);
        console.log("[Migration] Added max_branches to business_groups");
      }

      // 2. Add is_main_branch to tenants if missing
      if (!(await hasColumn("tenants", "is_main_branch"))) {
        await conn.query(`
          ALTER TABLE tenants 
          ADD COLUMN is_main_branch TINYINT(1) NOT NULL DEFAULT 0
        `);
        console.log("[Migration] Added is_main_branch to tenants");
      }

      // 3. Add branch_code to tenants if missing
      if (!(await hasColumn("tenants", "branch_code"))) {
        await conn.query(`
          ALTER TABLE tenants 
          ADD COLUMN branch_code VARCHAR(50) DEFAULT NULL
        `);
        console.log("[Migration] Added branch_code to tenants");
      }

      // 4. Add max_branches to plans if missing
      if (!(await hasColumn("plans", "max_branches"))) {
        await conn.query(`
          ALTER TABLE plans 
          ADD COLUMN max_branches INT NOT NULL DEFAULT 1
        `);
        console.log("[Migration] Added max_branches to plans");
      }

      // 5. Backfill: For any business_group that has linked tenants but no is_main_branch=1,
      // mark the oldest tenant in the group as is_main_branch=1.
      await conn.query(`
        UPDATE tenants t
        JOIN (
          SELECT business_group_id, MIN(id) AS min_id
          FROM tenants
          WHERE business_group_id IS NOT NULL
          GROUP BY business_group_id
        ) first_tenant ON t.id = first_tenant.min_id
        SET t.is_main_branch = 1
        WHERE t.is_main_branch = 0
          AND NOT EXISTS (
            SELECT 1 FROM (SELECT id, business_group_id, is_main_branch FROM tenants) sub
            WHERE sub.business_group_id = t.business_group_id AND sub.is_main_branch = 1
          )
      `);

      console.log("[Migration] Branch management schema verified successfully.");
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensureBranchManagementSchema error:", err);
  }
};
