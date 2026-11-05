const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { findCustomerPhone } = require("../utils/phone");

/**
 * Customer 360: everything we know about one customer, in one call.
 *
 * "This customer's bills" = invoices of the tenant that either carry the
 * customer's phone (newer bills) or hold an order placed for them (older bills,
 * before invoices.customer_phone existed). Selecting invoice ids first, instead
 * of joining orders, keeps a multi-order invoice from being counted twice.
 */

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 30;
const MAX_NOTES_LENGTH = 2000;
const MAX_ALLERGIES_LENGTH = 500;

/** WHERE fragment (alias `i`) + params selecting this customer's invoices. */
const customerInvoices = (tenantId, phone) => ({
  sql: `i.tenant_id = ? AND (
          i.customer_phone = ?
          OR i.id IN (SELECT o.invoice_id FROM orders o
                      WHERE o.tenant_id = ? AND o.customer_id = ? AND o.invoice_id IS NOT NULL)
        )`,
  params: [tenantId, phone, tenantId, phone],
});

const parseTags = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const daysBetween = (from, to) => Math.floor((to.getTime() - from.getTime()) / DAY_MS);

/**
 * Segment from recency, frequency and spend rank. Ordered so the first rule
 * that matches wins: a lapsed big spender is "Lapsed" (actionable), not "VIP".
 */
// `reason` is English for API consumers; the UI translates `customer360.reason_<key>` with `args`.
const computeSegment = ({ visits, daysSinceLastVisit, daysSinceFirstVisit, avgDaysBetweenVisits, spendPercentile }) => {
  if (!visits) return { key: "prospect", reason: "No completed bills yet", args: {} };
  if (daysSinceLastVisit > 90) {
    return { key: "lapsed", reason: `No visit in ${daysSinceLastVisit} days`, args: { days: daysSinceLastVisit } };
  }

  const expectedGap = Math.max(14, avgDaysBetweenVisits || 0);
  if (visits >= 2 && daysSinceLastVisit > 30 && daysSinceLastVisit > expectedGap * 2) {
    const days = Math.round(expectedGap);
    return { key: "at_risk", reason: `Overdue: usually returns every ~${days} days`, args: { days } };
  }
  if (daysSinceFirstVisit <= 30 && visits <= 2) return { key: "new", reason: "First visit in the last 30 days", args: {} };
  if (spendPercentile !== null && spendPercentile >= 90 && visits >= 3) {
    const pct = Math.max(1, 100 - spendPercentile);
    return { key: "vip", reason: `Top ${pct}% by spend`, args: { pct } };
  }
  if (visits >= 4) return { key: "loyal", reason: `${visits} visits`, args: { n: visits } };
  return { key: "occasional", reason: `${visits} visit(s)`, args: { n: visits } };
};

exports.resolveCustomerPhoneDB = async (raw, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    return await findCustomerPhone(conn, raw, tenantId);
  } finally {
    conn.release();
  }
};

exports.getCustomer360DB = async (tenantId, phone) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [customerRows] = await conn.query(
      `SELECT c.phone, c.name, c.email, c.birth_date, c.gender, c.is_member, c.created_at,
              DATE_FORMAT(c.birth_date, "%Y-%m-%d") AS birth_date_str,
              c.customer_group_id, cg.name AS customer_group_name, cg.color AS customer_group_color,
              c.points_balance, c.lifetime_points_earned, c.membership_tier, c.credit_limit,
              c.notes, c.allergies, c.tags
       FROM customers c
       LEFT JOIN customer_groups cg ON cg.id = c.customer_group_id AND cg.tenant_id = c.tenant_id
       WHERE c.tenant_id = ? AND c.phone = ?
       LIMIT 1`,
      [tenantId, phone]
    );
    const customer = customerRows[0];
    if (!customer) return null;

    const inv = customerInvoices(tenantId, phone);
    const run = (sql, params) => conn.query(sql, params).then(([rows]) => rows);

    const [
      statsRows,
      monthlyRows,
      dayRows,
      hourRows,
      channelRows,
      paymentRows,
      favoriteRows,
      creditRows,
      reservationRows,
      reservationStatsRows,
      feedbackStatsRows,
      feedbackRows,
      loyaltyRows,
      creditPaymentRows,
      recentInvoiceRows,
      rankRows,
    ] = await Promise.all([
      // Lifetime numbers. Net = total minus refunds.
      run(
        `SELECT
           COUNT(*) AS visits,
           COUNT(DISTINCT DATE(i.created_at)) AS visit_days,
           SUM(i.total - IFNULL(i.refunded_total, 0)) AS net_spend,
           SUM(i.total) AS gross_spend,
           SUM(IFNULL(i.refunded_total, 0)) AS refunded,
           SUM(IFNULL(i.discount_total, 0) + IFNULL(i.promotion_discount_total, 0)
               + IFNULL(i.customer_group_discount_total, 0) + IFNULL(i.loyalty_discount_amount, 0)) AS savings,
           MIN(i.created_at) AS first_visit,
           MAX(i.created_at) AS last_visit,
           MAX(i.total) AS biggest_bill,
           SUM(CASE WHEN i.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN i.total - IFNULL(i.refunded_total, 0) ELSE 0 END) AS this_month_spend,
           SUM(CASE WHEN i.created_at >= CURDATE() - INTERVAL 30 DAY THEN i.total - IFNULL(i.refunded_total, 0) ELSE 0 END) AS spend_30d,
           SUM(CASE WHEN i.created_at >= CURDATE() - INTERVAL 90 DAY THEN i.total - IFNULL(i.refunded_total, 0) ELSE 0 END) AS spend_90d,
           SUM(CASE WHEN i.created_at >= CURDATE() - INTERVAL 90 DAY THEN 1 ELSE 0 END) AS visits_90d,
           (SELECT COUNT(*) FROM invoices i WHERE ${inv.sql} AND i.status = 'VOID') AS void_count,
           (SELECT IFNULL(SUM(o.tip_total), 0) FROM orders o
              WHERE o.tenant_id = ? AND o.customer_id = ? AND o.status <> 'cancelled') AS tips
         FROM invoices i
         WHERE ${inv.sql} AND i.status <> 'VOID'`,
        [...inv.params, tenantId, phone, ...inv.params]
      ),
      // Last 12 months, oldest first.
      run(
        `SELECT DATE_FORMAT(i.created_at, '%Y-%m') AS month,
                COUNT(*) AS visits,
                SUM(i.total - IFNULL(i.refunded_total, 0)) AS spend
         FROM invoices i
         WHERE ${inv.sql} AND i.status <> 'VOID'
           AND i.created_at >= DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH, '%Y-%m-01')
         GROUP BY month
         ORDER BY month`,
        inv.params
      ),
      // 1 = Sunday … 7 = Saturday (MySQL DAYOFWEEK).
      run(
        `SELECT DAYOFWEEK(i.created_at) AS dow, COUNT(*) AS visits
         FROM invoices i WHERE ${inv.sql} AND i.status <> 'VOID'
         GROUP BY dow`,
        inv.params
      ),
      run(
        `SELECT HOUR(i.created_at) AS hour, COUNT(*) AS visits
         FROM invoices i WHERE ${inv.sql} AND i.status <> 'VOID'
         GROUP BY hour`,
        inv.params
      ),
      run(
        `SELECT LOWER(IFNULL(NULLIF(o.delivery_type, ''), 'other')) AS channel, COUNT(DISTINCT o.id) AS orders
         FROM orders o
         WHERE o.tenant_id = ? AND o.customer_id = ? AND o.status <> 'cancelled'
         GROUP BY channel
         ORDER BY orders DESC`,
        [tenantId, phone]
      ),
      run(
        `SELECT CASE WHEN pt.title IS NOT NULL THEN pt.title
                     WHEN i.credit_amount > 0 THEN 'Pay Later'
                     ELSE 'Other' END AS payment_type,
                COUNT(*) AS bills
         FROM invoices i
         LEFT JOIN payment_types pt ON pt.id = i.payment_type_id AND pt.tenant_id = i.tenant_id
         WHERE ${inv.sql} AND i.status <> 'VOID'
         GROUP BY payment_type
         ORDER BY bills DESC`,
        inv.params
      ),
      // Favourite items: what they order, how often, and when they last had it.
      run(
        `SELECT mi.id, mi.title, mi.image,
                SUM(oi.quantity) AS quantity,
                COUNT(DISTINCT o.id) AS times_ordered,
                SUM(oi.quantity * oi.price) AS spend,
                MAX(o.date) AS last_ordered
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
         JOIN menu_items mi ON mi.id = oi.item_id
         WHERE o.tenant_id = ? AND o.customer_id = ? AND o.status <> 'cancelled' AND oi.status <> 'cancelled'
         GROUP BY mi.id, mi.title, mi.image
         ORDER BY quantity DESC, spend DESC
         LIMIT 8`,
        [tenantId, phone]
      ),
      run(
        `SELECT
           IFNULL(SUM(balance_due), 0) AS outstanding,
           COUNT(*) AS open_bills,
           IFNULL(SUM(CASE WHEN due_date IS NOT NULL AND due_date < CURDATE() THEN balance_due ELSE 0 END), 0) AS overdue,
           DATE_FORMAT(MIN(due_date), "%Y-%m-%d") AS next_due_date,
           MIN(created_at) AS oldest_open
         FROM invoices
         WHERE tenant_id = ? AND customer_phone = ? AND status <> 'VOID' AND balance_due > 0`,
        [tenantId, phone]
      ),
      run(
        `SELECT r.id, r.date, r.status, r.people_count, r.notes, r.unique_code, st.table_title
         FROM reservations r
         LEFT JOIN store_tables st ON st.id = r.table_id AND st.tenant_id = r.tenant_id
         WHERE r.tenant_id = ? AND r.customer_id = ?
         ORDER BY r.date DESC
         LIMIT 50`,
        [tenantId, phone]
      ),
      run(
        `SELECT status, COUNT(*) AS count FROM reservations
         WHERE tenant_id = ? AND customer_id = ? GROUP BY status`,
        [tenantId, phone]
      ),
      run(
        `SELECT COUNT(*) AS count,
                AVG(average_rating) AS average, AVG(food_quality_rating) AS food,
                AVG(service_rating) AS service, AVG(staff_behavior_rating) AS staff,
                AVG(ambiance_rating) AS ambiance, AVG(recommend_rating) AS recommend
         FROM feedbacks WHERE tenant_id = ? AND phone = ?`,
        [tenantId, phone]
      ),
      run(
        `SELECT id, invoice_id, date, average_rating, food_quality_rating, service_rating,
                staff_behavior_rating, ambiance_rating, recommend_rating, remarks, created_by
         FROM feedbacks WHERE tenant_id = ? AND phone = ?
         ORDER BY date DESC LIMIT 20`,
        [tenantId, phone]
      ),
      run(
        `SELECT id, transaction_type, points, balance_after, notes, invoice_id, created_by_user_id, created_at
         FROM customer_loyalty_transactions
         WHERE tenant_id = ? AND customer_phone = ?
         ORDER BY created_at DESC, id DESC LIMIT 30`,
        [tenantId, phone]
      ),
      run(
        `SELECT id, amount, payment_type_title, reference, note, created_by, created_at
         FROM customer_credit_payments
         WHERE tenant_id = ? AND customer_phone = ?
         ORDER BY created_at DESC, id DESC LIMIT 30`,
        [tenantId, phone]
      ),
      run(
        `SELECT i.id, i.created_at, i.total, i.status, i.refunded_total, i.payment_status, i.balance_due,
                i.created_by, pt.title AS payment_type,
                (SELECT o.delivery_type FROM orders o WHERE o.invoice_id = i.id AND o.tenant_id = i.tenant_id LIMIT 1) AS channel,
                (SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                   WHERE o.invoice_id = i.id AND o.tenant_id = i.tenant_id AND oi.status <> 'cancelled') AS item_count
         FROM invoices i
         LEFT JOIN payment_types pt ON pt.id = i.payment_type_id AND pt.tenant_id = i.tenant_id
         WHERE ${inv.sql}
         ORDER BY i.created_at DESC
         LIMIT 30`,
        inv.params
      ),
      // Spend rank among this tenant's customers who have bought anything.
      run(
        `SELECT
           SUM(CASE WHEN t.spend > me.spend THEN 1 ELSE 0 END) AS above,
           COUNT(*) AS ranked
         FROM (
           SELECT o.customer_id, SUM(i.total - IFNULL(i.refunded_total, 0)) AS spend
           FROM invoices i
           JOIN (SELECT DISTINCT invoice_id, customer_id FROM orders
                 WHERE tenant_id = ? AND customer_id IS NOT NULL AND invoice_id IS NOT NULL) o ON o.invoice_id = i.id
           WHERE i.tenant_id = ? AND i.status <> 'VOID'
           GROUP BY o.customer_id
         ) t
         CROSS JOIN (
           SELECT IFNULL(SUM(i.total - IFNULL(i.refunded_total, 0)), 0) AS spend
           FROM invoices i WHERE ${inv.sql} AND i.status <> 'VOID'
         ) me`,
        [tenantId, tenantId, ...inv.params]
      ),
    ]);

    const now = new Date();
    const s = statsRows[0] || {};
    const visits = Number(s.visits || 0);
    const netSpend = round2(s.net_spend);
    const firstVisit = s.first_visit ? new Date(s.first_visit) : null;
    const lastVisit = s.last_visit ? new Date(s.last_visit) : null;
    const daysSinceLastVisit = lastVisit ? daysBetween(lastVisit, now) : null;
    const daysSinceFirstVisit = firstVisit ? daysBetween(firstVisit, now) : null;
    // Gaps between distinct visit days, so two bills at one lunch do not read as "every 0 days".
    const visitDays = Number(s.visit_days || 0);
    const avgDaysBetweenVisits = visitDays >= 2 && firstVisit && lastVisit
      ? round2((lastVisit - firstVisit) / DAY_MS / (visitDays - 1))
      : null;
    const nextVisitExpected = avgDaysBetweenVisits && lastVisit
      ? new Date(lastVisit.getTime() + avgDaysBetweenVisits * DAY_MS)
      : null;

    const rank = rankRows[0] || {};
    const ranked = Number(rank.ranked || 0);
    const spendPercentile = visits > 0 && ranked > 0
      ? Math.min(100, Math.max(0, Math.round(((ranked - Number(rank.above || 0) - 1) / Math.max(1, ranked - 1)) * 100)))
      : null;

    // Fill the last 12 months so the chart has no gaps.
    const monthMap = new Map(monthlyRows.map((r) => [r.month, r]));
    const monthly = [];
    for (let k = 11; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = monthMap.get(key);
      monthly.push({ month: key, visits: Number(row?.visits || 0), spend: round2(row?.spend) });
    }

    // Monday-first week.
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dowMap = new Map(dayRows.map((r) => [Number(r.dow), Number(r.visits)]));
    const byDay = [2, 3, 4, 5, 6, 7, 1].map((dow) => ({ day: dayNames[dow - 1], visits: dowMap.get(dow) || 0 }));
    const hourMap = new Map(hourRows.map((r) => [Number(r.hour), Number(r.visits)]));
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, visits: hourMap.get(hour) || 0 }));

    const peak = (rows, key) => rows.reduce((best, r) => (r.visits > (best?.visits || 0) ? r : best), null)?.[key] ?? null;
    const dayparts = [
      { key: "breakfast", from: 5, to: 10 },
      { key: "lunch", from: 11, to: 14 },
      { key: "afternoon", from: 15, to: 16 },
      { key: "dinner", from: 17, to: 21 },
      { key: "late_night", from: 22, to: 28 },
    ].map((p) => ({
      key: p.key,
      visits: byHour.filter((h) => (h.hour >= p.from && h.hour <= p.to) || (p.to > 23 && h.hour <= p.to - 24)).reduce((a, h) => a + h.visits, 0),
    }));

    const segment = computeSegment({ visits, daysSinceLastVisit, daysSinceFirstVisit, avgDaysBetweenVisits, spendPercentile });

    const credit = creditRows[0] || {};
    const creditLimit = customer.credit_limit === null ? null : round2(customer.credit_limit);
    const outstanding = round2(credit.outstanding);

    const reservationStats = Object.fromEntries(reservationStatsRows.map((r) => [r.status, Number(r.count)]));
    const fb = feedbackStatsRows[0] || {};
    const avg = (v) => (v === null || v === undefined ? null : round2(v));

    // Birthday: days until the next one.
    let birthday = null;
    if (customer.birth_date_str) {
      const [, month, day] = customer.birth_date_str.split("-").map(Number);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let next = new Date(today.getFullYear(), month - 1, day);
      if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
      birthday = { date: customer.birth_date_str, days_until: Math.round((next - today) / DAY_MS) };
    }

    // One merged activity feed, newest first.
    const timeline = [
      ...recentInvoiceRows.map((i) => ({
        type: i.status === "VOID" ? "bill_void" : "bill",
        at: i.created_at,
        ref: i.id,
        amount: round2(i.total),
        detail: { channel: i.channel, payment_type: i.payment_type, item_count: Number(i.item_count || 0), payment_status: i.payment_status, by: i.created_by },
      })),
      ...creditPaymentRows.map((p) => ({
        type: "due_payment",
        at: p.created_at,
        ref: p.id,
        amount: round2(p.amount),
        detail: { payment_type: p.payment_type_title, note: p.note, by: p.created_by },
      })),
      ...loyaltyRows
        .filter((t) => t.transaction_type !== "EARNED")
        .map((t) => ({
          type: `loyalty_${t.transaction_type.toLowerCase()}`,
          at: t.created_at,
          ref: t.id,
          points: t.points,
          detail: { note: t.notes, invoice_id: t.invoice_id, by: t.created_by_user_id },
        })),
      ...reservationRows.map((r) => ({
        type: "reservation",
        at: r.date,
        ref: r.id,
        detail: { status: r.status, people: r.people_count, table: r.table_title, note: r.notes },
      })),
      ...feedbackRows.map((f) => ({
        type: "feedback",
        at: f.date,
        ref: f.id,
        rating: avg(f.average_rating),
        detail: { remarks: f.remarks, invoice_id: f.invoice_id },
      })),
      { type: "joined", at: customer.created_at, ref: customer.phone, detail: {} },
    ]
      .filter((e) => e.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 60);

    return {
      profile: {
        phone: customer.phone,
        name: customer.name,
        email: customer.email,
        birth_date: customer.birth_date_str || null,
        gender: customer.gender,
        is_member: !!customer.is_member,
        created_at: customer.created_at,
        customer_group_id: customer.customer_group_id,
        customer_group_name: customer.customer_group_name,
        customer_group_color: customer.customer_group_color,
        notes: customer.notes || "",
        allergies: customer.allergies || "",
        tags: parseTags(customer.tags),
        birthday,
      },
      segment,
      stats: {
        visits,
        net_spend: netSpend,
        gross_spend: round2(s.gross_spend),
        refunded: round2(s.refunded),
        savings: round2(s.savings),
        tips: round2(s.tips),
        avg_bill: visits ? round2(netSpend / visits) : 0,
        biggest_bill: round2(s.biggest_bill),
        this_month_spend: round2(s.this_month_spend),
        spend_30d: round2(s.spend_30d),
        spend_90d: round2(s.spend_90d),
        visits_90d: Number(s.visits_90d || 0),
        void_count: Number(s.void_count || 0),
        first_visit: firstVisit,
        last_visit: lastVisit,
        days_since_last_visit: daysSinceLastVisit,
        avg_days_between_visits: avgDaysBetweenVisits,
        next_visit_expected: nextVisitExpected,
        spend_percentile: spendPercentile,
        ranked_customers: ranked,
      },
      behaviour: {
        monthly,
        by_day: byDay,
        by_hour: byHour,
        dayparts,
        peak_day: peak(byDay, "day"),
        peak_hour: peak(byHour, "hour"),
        channels: channelRows.map((r) => ({ channel: r.channel, orders: Number(r.orders) })),
        payment_types: paymentRows.map((r) => ({ payment_type: r.payment_type, bills: Number(r.bills) })),
      },
      favorites: favoriteRows.map((r) => ({
        id: r.id,
        title: r.title,
        image: r.image,
        quantity: Number(r.quantity || 0),
        times_ordered: Number(r.times_ordered || 0),
        spend: round2(r.spend),
        last_ordered: r.last_ordered,
      })),
      loyalty: {
        points_balance: Number(customer.points_balance || 0),
        lifetime_points_earned: Number(customer.lifetime_points_earned || 0),
        membership_tier: customer.membership_tier || "Standard",
      },
      credit: {
        credit_limit: creditLimit,
        outstanding,
        available: creditLimit === null ? null : round2(Math.max(0, creditLimit - outstanding)),
        open_bills: Number(credit.open_bills || 0),
        overdue: round2(credit.overdue),
        next_due_date: credit.next_due_date || null,
        oldest_open: credit.oldest_open || null,
      },
      reservations: {
        total: reservationRows.length,
        by_status: reservationStats,
        upcoming: reservationRows
          .filter((r) => new Date(r.date) >= now && !["cancelled", "no_show", "completed"].includes(r.status))
          .sort((a, b) => new Date(a.date) - new Date(b.date)),
        recent: reservationRows,
      },
      feedback: {
        count: Number(fb.count || 0),
        average: avg(fb.average),
        food: avg(fb.food),
        service: avg(fb.service),
        staff: avg(fb.staff),
        ambiance: avg(fb.ambiance),
        recommend: avg(fb.recommend),
        recent: feedbackRows.map((f) => ({ ...f, average_rating: avg(f.average_rating) })),
      },
      timeline,
    };
  } finally {
    conn.release();
  }
};

/** Validate and store staff notes, allergies and tags. Returns the cleaned values. */
exports.updateCustomerProfileNotesDB = async (tenantId, phone, { notes, allergies, tags }) => {
  const clean = {
    notes: notes ? String(notes).trim().slice(0, MAX_NOTES_LENGTH) : null,
    allergies: allergies ? String(allergies).trim().slice(0, MAX_ALLERGIES_LENGTH) : null,
    tags: [
      ...new Set(
        (Array.isArray(tags) ? tags : [])
          .map((t) => String(t || "").trim().slice(0, MAX_TAG_LENGTH))
          .filter(Boolean)
      ),
    ].slice(0, MAX_TAGS),
  };

  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `UPDATE customers SET notes = ?, allergies = ?, tags = ? WHERE tenant_id = ? AND phone = ?`,
      [clean.notes || null, clean.allergies || null, JSON.stringify(clean.tags), tenantId, phone]
    );
    if (result.affectedRows === 0) return null;
    return { notes: clean.notes || "", allergies: clean.allergies || "", tags: clean.tags };
  } finally {
    conn.release();
  }
};
