const {
  upsertDeviceTokenDB,
  deleteDeviceTokenDB,
} = require("../services/device.service");
const { convertApnsTokenToFcm } = require("../services/notification.service");

const ALLOWED_PLATFORMS = ["android", "ios"];

// APNs device tokens are 64+ hex chars; FCM registration tokens contain ':'.
// iOS clients using expo-notifications send the raw APNs token, which must be
// exchanged for an FCM registration token before Firebase Admin can use it.
const looksLikeApnsToken = (token) => /^[0-9a-fA-F]{64,}$/.test(token);

exports.registerDevice = async (req, res) => {
  try {
    const { tenant_id: tenantId, username } = req.user;
    const platform = String(req.body?.platform || "").toLowerCase();
    const rawToken = typeof req.body?.fcmToken === "string" ? req.body.fcmToken.trim() : "";

    if (!ALLOWED_PLATFORMS.includes(platform) || !rawToken || rawToken.length > 512) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    let fcmToken = rawToken;
    if (platform === "ios" && looksLikeApnsToken(rawToken)) {
      const converted = await convertApnsTokenToFcm(rawToken);
      if (!converted) {
        return res.status(502).json({
          success: false,
          message: req.__("something_went_wrong_try_later"),
        });
      }
      fcmToken = converted;
    }

    await upsertDeviceTokenDB({ tenantId, userId: username, platform, fcmToken });

    return res.status(200).json({
      success: true,
      // The app stores this to unregister the same row on logout; on iOS it
      // differs from the APNs token it sent.
      fcmToken,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.removeDevice = async (req, res) => {
  try {
    const { tenant_id: tenantId, username } = req.user;
    const fcmToken = typeof req.body?.fcmToken === "string" ? req.body.fcmToken.trim() : "";

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    const removed = await deleteDeviceTokenDB(tenantId, username, fcmToken);

    return res.status(200).json({ success: true, removed });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};
