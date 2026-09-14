import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

// Current table assignments for the tenant: [{ table_id, user_id, role, user_name }]
export function useTableAssignments() {
  const APIURL = `/waiter/assignments`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return { data, error, isLoading, APIURL };
}

// Replace the full set of tables a staff member owns for a given role.
// Passing an empty tableIds list clears their assignments.
export async function setStaffTableAssignments(userId, role, tableIds) {
  const res = await ApiClient.post(`/waiter/assignments`, { userId, role, tableIds });
  return res.data;
}

// Assign or clear a single table's waiter/captain. Pass userId = null to remove.
export async function setTableAssignment(tableId, role, userId) {
  const res = await ApiClient.post(`/waiter/assignments/table`, { tableId, role, userId });
  return res.data;
}
