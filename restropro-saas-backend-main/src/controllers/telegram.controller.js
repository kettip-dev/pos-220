const {
  getTelegramSettingsDB,
  updateTelegramSettingsDB,
  testTelegramConnection,
  sendEodTelegramNotification,
} = require("../services/telegram.service");

exports.getSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const settings = await getTelegramSettingsDB(tenantId);
    return res.status(200).json(settings);
  } catch (error) {
    console.error("[telegram.controller] getSettings error:", error);
    return res.status(500).json({ message: "Failed to load telegram settings" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const {
      bot_token,
      orders_chat_id,
      orders_thread_id,
      eod_chat_id,
      eod_thread_id,
      is_orders_enabled,
      is_eod_enabled,
      eod_time,
    } = req.body;

    const updated = await updateTelegramSettingsDB(tenantId, {
      bot_token,
      orders_chat_id,
      orders_thread_id,
      eod_chat_id,
      eod_thread_id,
      is_orders_enabled,
      is_eod_enabled,
      eod_time,
    });

    return res.status(200).json({
      message: "Telegram settings saved successfully",
      data: updated,
    });
  } catch (error) {
    console.error("[telegram.controller] updateSettings error:", error);
    return res.status(500).json({ message: "Failed to update telegram settings" });
  }
};

exports.testConnection = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    let { bot_token, chat_id, thread_id } = req.body;

    // Fall back to saved settings if not passed
    if (!bot_token || !chat_id) {
      const saved = await getTelegramSettingsDB(tenantId);
      bot_token = bot_token || saved?.bot_token;
      chat_id = chat_id || saved?.orders_chat_id;
      thread_id = thread_id !== undefined ? thread_id : saved?.orders_thread_id;
    }

    if (!bot_token) {
      return res.status(400).json({ message: "Bot token is required for test connection" });
    }
    if (!chat_id) {
      return res.status(400).json({ message: "Chat ID is required for test connection" });
    }

    await testTelegramConnection(bot_token, chat_id, thread_id);
    return res.status(200).json({
      message: "Test message sent successfully! Check your Telegram group or chat.",
    });
  } catch (error) {
    console.error("[telegram.controller] testConnection error:", error);
    return res.status(400).json({
      message: error.message || "Failed to send test message to Telegram",
    });
  }
};

exports.sendManualEod = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const date = req.body.date || new Date().toISOString().substring(0, 10);

    const outcome = await sendEodTelegramNotification(tenantId, date, { force: true });
    if (outcome === "skipped") {
      return res.status(200).json({
        message: "EOD Summary skipped (no sales recorded today or Telegram notifications disabled)",
      });
    }

    return res.status(200).json({
      message: `EOD Summary for ${date} sent to Telegram!`,
    });
  } catch (error) {
    console.error("[telegram.controller] sendManualEod error:", error);
    return res.status(400).json({
      message: error.message || "Failed to send EOD report to Telegram",
    });
  }
};
