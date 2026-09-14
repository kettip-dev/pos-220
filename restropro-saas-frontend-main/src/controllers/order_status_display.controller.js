import axios from "axios";
import { API } from "../config/config";

export async function getOrderStatusDisplayData(qrcode) {
  axios.defaults.withCredentials = true;
  try {
    const response = await axios.get(`${API}/order-status-display/${qrcode}`);
    return response;
  } catch (error) {
    throw error;
  }
}
