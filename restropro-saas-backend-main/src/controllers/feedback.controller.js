const { getOverallFeedbackSummaryDB, getOverallFeedbackSummaryByQuestionDB, getFeedbacksDB, searchFeedbacksDB, getFeedbackByBusinessDB } = require("../services/feedback.service");

/**
 * Replace the internal tenant id on a consolidated row with the business name
 * the UI shows in its Business column.
 *
 * Names come from the scope the middleware already resolved, so this costs no
 * query. Rows are returned untouched for a single business, keeping those
 * responses byte-identical to before Enterprise mode.
 */
const labelBusinesses = (rows, scope) => {
  if (scope?.mode !== "all") return rows;

  return rows.map(({ business_tenant_id, ...rest }) =>
    business_tenant_id == null
      ? rest
      : {
          ...rest,
          business: scope.businessNames?.[business_tenant_id] || `#${business_tenant_id}`,
          businessTenantId: business_tenant_id,
        }
  );
};

/**
 * Businesses in the caller's group whose NAME matches the search term.
 *
 * Lets "search by business" work off the already-resolved scope instead of a
 * join against `tenants`, and can never widen the result set beyond the group.
 */
const businessIdsMatchingName = (scope, search) => {
  if (scope?.mode !== "all") return [];
  const needle = String(search || "").trim().toLowerCase();
  if (!needle) return [];

  return Object.entries(scope.businessNames || {})
    .filter(([, name]) => String(name).toLowerCase().includes(needle))
    .map(([tenantId]) => Number(tenantId));
};

/**
 * Per-business rating breakdown for the consolidated view: powers
 * "Ratings by Business", "Reviews by Business" and "Average Rating by Business".
 *
 * Every business in the group is listed, including ones with no reviews yet —
 * a business silently missing from a comparison reads as a data error.
 */
const buildBusinessBreakdown = (rows, scope) => {
  const byTenant = new Map(rows.map((r) => [Number(r.tenant_id), r]));

  return scope.tenantIds
    .map((tenantId) => {
      const row = byTenant.get(Number(tenantId));
      return {
        tenantId,
        business: scope.businessNames?.[tenantId] || `#${tenantId}`,
        totalReviews: Number(row?.total_reviews || 0),
        // null (not 0) when a business has no reviews: a zero average would
        // rank it as the worst-rated branch rather than "no data yet".
        averageRating: row?.average_rating != null ? Number(row.average_rating) : null,
        loved: Number(row?.loved || 0),
        good: Number(row?.good || 0),
        average: Number(row?.average || 0),
        bad: Number(row?.bad || 0),
        worst: Number(row?.worst || 0),
      };
    })
    .sort((a, b) => (b.averageRating ?? -1) - (a.averageRating ?? -1));
};

exports.getFeedbackInit = async (req, res) => {
  try {
    const scope = req.dataScope;
    const isConsolidated = scope.mode === "all";

    const [overallFeedbackCounting, summary, feedbacks, byBusiness] = await Promise.all([
      getOverallFeedbackSummaryDB(scope),
      getOverallFeedbackSummaryByQuestionDB(scope),
      getFeedbacksDB('last_7days', null, null, scope),
      // Skipped entirely for a single business, so that request costs exactly
      // the queries it did before.
      isConsolidated ? getFeedbackByBusinessDB(scope) : Promise.resolve([]),
    ]);

    const payload = {
      overallFeedbackCounting: {
        loved: overallFeedbackCounting?.loved || 0,
        good: overallFeedbackCounting?.good || 0,
        average: overallFeedbackCounting?.average || 0,
        bad: overallFeedbackCounting?.bad || 0,
        worst: overallFeedbackCounting?.worst || 0,
      },
      averageRating: summary?.average_rating || 0,
      foodRating: summary?.food_quality_rating || 0,
      staffRating: summary?.staff_behavior_rating || 0,
      ambianceRating: summary?.ambiance_rating || 0,
      serviceRating: summary?.service_rating || 0,
      recommendRating: summary?.recommend_rating || 0,
      feedbacks: labelBusinesses(feedbacks || [], scope)
    };

    if (!isConsolidated) {
      return res.status(200).json(payload);
    }

    return res.status(200).json({
      ...payload,
      scope: "all",
      businessCount: scope.tenantIds.length,
      businesses: buildBusinessBreakdown(byBusiness, scope),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.getFeedbacks = async (req, res) => {
  try {
    const scope = req.dataScope;

    const from = req.query.from || null;
    const to = req.query.to || null;
    const type = req.query.type;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"), // Translate message
      });
    }

    if (type == "custom") {
      if (!(from && to) || (from == 'null' || to == 'null')) {
        return res.status(400).json({
          success: false,
          message: req.__("provide_from_to_dates"), // Translate message
        });
      }
    }

    const result = await getFeedbacksDB(type, from, to, scope);

    if (result.length > 0) {
      return res.status(200).json(labelBusinesses(result, scope));
    } else {
      return res.status(200).json([]);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.searchFeedbacks = async (req, res) => {
  try {
    const scope = req.dataScope;
    const searchString = req.query.q;

    if (!searchString) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"), // Translate message
      });
    }

    const result = await searchFeedbacksDB(
      searchString,
      scope,
      businessIdsMatchingName(scope, searchString)
    );

    if (result.length > 0) {
      return res.status(200).json(labelBusinesses(result, scope));
    } else {
      return res.status(200).json([]);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};
