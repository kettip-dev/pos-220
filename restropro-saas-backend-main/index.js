// Polyfill: Node.js v25 removed SlowBuffer, which breaks buffer-equal-constant-time (jsonwebtoken dep)
const _bufModule = require('buffer');
if (!_bufModule.SlowBuffer) {
  _bufModule.SlowBuffer = Buffer;
}

const app = require("./src/app");

const { createServer } = require("http");
const { Server } = require("socket.io");
const { CONFIG } = require("./src/config");
const { getTenantIdFromQRCode } = require("./src/services/settings.service");
const { startDayEndReconciliationScheduler } = require("./src/schedulers/day_end_reconciliation.scheduler");

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        // Mobile apps (kitchen/waiter/captain) connect from LAN device origins
        // that never match FRONTEND_DOMAIN, and Socket.IO enforces cors.origin
        // on the handshake (including the polling transport). Allow any origin
        // so the native apps can connect; credentials must be false when using
        // a wildcard origin.
        origin: true,
        credentials: false,
        methods: ["GET", "POST"],
    }
});

// Expose io to controllers via req.app.get("io") so they can broadcast
// table calls, request updates, and ready-for-pickup events to the tenant room.
app.set("io", io);

// In-memory tracking for dual-screen rooms (roomId -> tenantId)
const roomOwners = new Map();

io.on("connection", (socket)=>{
    console.log(socket.id);

    socket.on('authenticate', async (tenantId) => {
        // Coerce to string so the room key matches controller emits that use
        // String(tenant_id) (e.g. kitchen.controller.js, waiter.controller.js).
        socket.tenantId = String(tenantId);
        socket.join(String(tenantId)); // Join the room for the restaurant
        console.log(`[socket] ${socket.id} joined tenant room "${String(tenantId)}"`);
    });

    socket.on("new_order_backend", (payload, tenantId)=>{
        console.log(payload);
        // socket.broadcast.emit("new_order", payload);
        socket.to(String(tenantId)).emit("new_order", payload);
        socket.to(String(tenantId)).emit("table_status_update", { action: "new_order", ...payload });
    })

    socket.on("new_qrorder_backend", async (payload, qrcode)=>{

        try {
            const tenantId = await getTenantIdFromQRCode(qrcode);
            socket.to(String(tenantId)).emit("new_qrorder", payload);
            socket.to(String(tenantId)).emit("table_status_update", { action: "new_qrorder", ...payload });
        } catch (error) {
            console.log(error);
        }
    })

    socket.on("order_update_backend", (payload, tenantId)=>{
        console.log(payload);
        // socket.broadcast.emit("order_update", payload);
        socket.to(String(tenantId)).emit("order_update", payload);
        socket.to(String(tenantId)).emit("table_status_update", { action: "order_update", ...payload });
    })

    socket.on("table_status_backend", (payload, tenantId)=>{
        console.log("table_status_backend:", payload);
        socket.to(String(tenantId)).emit("table_status_update", payload);
    });

    // Waiter / floor relays
    socket.on("table_call_backend", (payload, tenantId)=>{
        socket.to(String(tenantId)).emit("table_call", payload);
    })

    socket.on("request_update_backend", (payload, tenantId)=>{
        socket.to(String(tenantId)).emit("request_update", payload);
    })

    socket.on("ready_for_pickup_backend", (payload, tenantId)=>{
        socket.to(String(tenantId)).emit("ready_for_pickup", payload);
    })

    // Dual Screen Sync handlers
    socket.on("join_pos_backend", ({ roomId }) => {
        if (!roomId) return;
        socket.ownedRoomId = roomId;
        roomOwners.set(roomId, socket.tenantId);
        socket.join(roomId);
        console.log(`[dual-screen] POS opened room ${roomId} for tenant ${socket.tenantId}`);
    });

    socket.on("join_display_backend", ({ roomId }, callback) => {
        const ownerTenantId = roomOwners.get(roomId);
        if (!ownerTenantId || ownerTenantId !== socket.tenantId) {
            if (typeof callback === "function") {
                return callback({ ok: false, error: "Not authorized for this display." });
            }
            return;
        }
        socket.join(roomId);
        console.log(`[dual-screen] Display joined room ${roomId} for tenant ${socket.tenantId}`);
        if (typeof callback === "function") {
            callback({ ok: true });
        }
    });

    socket.on("cart_update_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("cart_update", payload);
        }
    });

    socket.on("cart_clear_backend", ({ roomId }) => {
        if (roomId) {
            socket.to(roomId).emit("cart_clear");
        }
    });

    socket.on("cart_request_backend", ({ roomId }) => {
        if (roomId) {
            socket.to(roomId).emit("cart_request");
        }
    });

    socket.on("variant_modal_open_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("variant_modal_open", payload);
        }
    });

    socket.on("variant_modal_update_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("variant_modal_update", payload);
        }
    });

    socket.on("variant_modal_close_backend", ({ roomId }) => {
        if (roomId) {
            socket.to(roomId).emit("variant_modal_close");
        }
    });

    socket.on("pos_filter_update_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("pos_filter_update", payload);
        }
    });

    socket.on("item_hover_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("item_hover", payload);
        }
    });

    socket.on("menu_scroll_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("menu_scroll", payload);
        }
    });

    socket.on("cart_scroll_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("cart_scroll", payload);
        }
    });

    socket.on("order_meta_update_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("order_meta_update", payload);
        }
    });

    socket.on("customer_modal_open_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("customer_modal_open", payload);
        }
    });

    socket.on("customer_modal_update_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("customer_modal_update", payload);
        }
    });

    socket.on("customer_modal_close_backend", ({ roomId }) => {
        if (roomId) {
            socket.to(roomId).emit("customer_modal_close");
        }
    });

    socket.on("payment_modal_open_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("payment_modal_open", payload);
        }
    });

    socket.on("payment_modal_update_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("payment_modal_update", payload);
        }
    });

    socket.on("payment_modal_close_backend", ({ roomId }) => {
        if (roomId) {
            socket.to(roomId).emit("payment_modal_close");
        }
    });

    socket.on("order_success_backend", ({ roomId, ...payload }) => {
        if (roomId) {
            socket.to(roomId).emit("order_success", payload);
        }
    });

    socket.on("close_room_backend", ({ roomId }) => {
        if (roomId) {
            roomOwners.delete(roomId);
            socket.to(roomId).emit("room_closed");
        }
    });

    socket.on("disconnect", () => {
        if (socket.ownedRoomId) {
            roomOwners.delete(socket.ownedRoomId);
            console.log(`[dual-screen] Cleaned up room ${socket.ownedRoomId}`);
        }
    });
});

httpServer.listen(PORT);

// Background jobs. Started after the server is listening so a scheduler fault
// can never prevent the API from coming up.
startDayEndReconciliationScheduler();

// app.listen(PORT, ()=>{
//     console.log(`Server Started on PORT: ${PORT}`);
// });