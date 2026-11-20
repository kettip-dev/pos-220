import ApiClient from "../helpers/ApiClient";

/** PMS settings as the browser sees them (the API key comes back masked). */
export async function getPmsSettings() {
  const response = await ApiClient.get("/pms/settings");
  return response?.data?.settings || null;
}

/** Saves the settings. A blank API key keeps the stored one. */
export async function savePmsSettings(settings) {
  const response = await ApiClient.post("/pms/settings", settings);
  return response?.data?.settings || null;
}

/** Tries the typed connection details against the PMS without saving them. */
export async function testPmsConnection(settings) {
  const response = await ApiClient.post("/pms/settings/test", settings);
  return response?.data || null;
}

/** Last 50 room charges / voids that went through the retry queue. */
export async function getPmsSyncQueue() {
  const response = await ApiClient.get("/pms/sync-queue");
  return response?.data?.queue || [];
}

/** Sends everything waiting in the queue now. */
export async function retryPmsSyncQueue() {
  const response = await ApiClient.post("/pms/sync-queue/retry");
  return response?.data || null;
}

/** Paid room-service bills whose room charge has not reached the hotel yet. */
export async function getUnpostedRoomCharges() {
  const response = await ApiClient.get("/pms/unposted-charges");
  return response?.data?.charges || [];
}

/** Posts one order's Charge to Room amount to the guest's hotel bill. */
export async function postRoomChargeForOrder(orderId) {
  const response = await ApiClient.post(`/pms/orders/${orderId}/post-charge`);
  return response?.data || null;
}

/** Rooms that currently have a checked-in guest, for the room service picker. */
export async function getCheckedInRooms() {
  const response = await ApiClient.get("/pms/checked-in-rooms");
  return response?.data?.rooms || [];
}

/** Checks one room number against the PMS (for rooms typed by hand). */
export async function verifyRoom(roomNumber) {
  const response = await ApiClient.get("/pms/verify-room", { params: { room_number: roomNumber } });
  return response?.data || null;
}

/**
 * The room-service fields the order endpoints expect, from the POS's room state.
 * Returns an empty object when no room is linked.
 */
export function roomServicePayload(room) {
  if (!room?.reservationId) return {};
  return {
    pmsReservationId: room.reservationId,
    pmsRoomNumber: room.roomNumber,
    pmsGuestName: room.guestName || null,
    roomServiceNote: room.note || null,
    guestCount: room.guestCount || null,
  };
}
