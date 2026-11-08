import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export const ADDON_LIBRARY_URL = "/addon-library";

/** Shared add-on list for the tenant (with used-by items and recipe lines). */
export function useAddonLibrary() {
  const { data, error, isLoading, mutate } = useSWR(ADDON_LIBRARY_URL, fetcher);
  return { data, error, isLoading, mutate, APIURL: ADDON_LIBRARY_URL };
}

export const createLibraryAddon = (title, price, translations = undefined) =>
  ApiClient.post(ADDON_LIBRARY_URL, { title, price, translations });

export const updateLibraryAddon = (id, title, price, translations = undefined) =>
  ApiClient.put(`${ADDON_LIBRARY_URL}/${id}`, { title, price, translations });

export const setLibraryAddonEnabled = (id, isEnabled) =>
  ApiClient.patch(`${ADDON_LIBRARY_URL}/${id}/availability`, { isEnabled });

export const deleteLibraryAddon = (id) =>
  ApiClient.delete(`${ADDON_LIBRARY_URL}/${id}`);

export const saveLibraryAddonIngredient = (id, inventoryItemId, quantity) =>
  ApiClient.post(`${ADDON_LIBRARY_URL}/${id}/recipe`, { inventoryItemId, quantity });

export const removeLibraryAddonIngredient = (id, recipeId) =>
  ApiClient.delete(`${ADDON_LIBRARY_URL}/${id}/recipe/${recipeId}`);

export const attachLibraryAddonToItem = (itemId, libraryAddonId) =>
  ApiClient.post(`${ADDON_LIBRARY_URL}/items/${itemId}/attach`, { libraryAddonId });

/** price = number to override for this item, or null to reset to the shared price. */
export const setItemAddonPrice = (itemId, addonId, price) =>
  ApiClient.patch(`${ADDON_LIBRARY_URL}/items/${itemId}/price/${addonId}`, { price });
