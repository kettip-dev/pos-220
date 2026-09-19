import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useMenuItems() {
  const APIURL = `/menu-items`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useMenuItem(id) {
  const APIURL = `/menu-items/${id}`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function getMenuItem(id) {
  const APIURL = `/menu-items/${id}`;
  try {
    const response = await ApiClient.get(APIURL);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function addMenuItem(title, description, price, netPrice, categoryId, taxId, kitchen_station_id = null) {
  try {
    const response = await ApiClient.post("/menu-items/add", {
      title,
      description,
      price,
      netPrice,
      categoryId,
      taxId,
      kitchen_station_id: kitchen_station_id ? Number(kitchen_station_id) : null,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateMenuItem(id, title, description, price, netPrice, categoryId, taxId, kitchen_station_id = null) {
  try {
    const response = await ApiClient.post(`/menu-items/update/${id}`, {
      title,
      description,
      price,
      netPrice,
      categoryId,
      taxId,
      kitchen_station_id: kitchen_station_id ? Number(kitchen_station_id) : null,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function uploadMenuItemPhoto(id, form) {
  try {
    const response = await ApiClient.post(`/menu-items/update/${id}/upload-photo`, form);
    return response;
  } catch (error) {
    throw error;
  }
}
export async function removeMenuItemPhoto(id) {
  try {
    const response = await ApiClient.post(`/menu-items/update/${id}/remove-photo`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getMenuItemImageSuggestions(id, query) {
  try {
    const response = await ApiClient.get(`/menu-items/${id}/image-suggestions`, {
      params: query ? { query } : undefined,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function selectMenuItemImageSuggestion(id, imageUrl) {
  try {
    const response = await ApiClient.post(`/menu-items/update/${id}/select-image-suggestion`, {
      imageUrl,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteMenuItem(id) {
  try {
    const response = await ApiClient.delete(`/menu-items/delete/${id}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function addMenuItemVariant(itemId, title, price) {
  try {
    const response = await ApiClient.post(`/menu-items/variants/${itemId}/add`, {
      title,
      price
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateMenuItemVariant(itemId, variantId, title, price) {
  try {
    const response = await ApiClient.post(`/menu-items/variants/${itemId}/update/${variantId}`, {
      title,
      price
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteMenuItemVariant(itemId, variantId) {
  try {
    const response = await ApiClient.delete(`/menu-items/variants/${itemId}/delete/${variantId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

export async function addMenuItemAddon(itemId, title, price) {
  try {
    const response = await ApiClient.post(`/menu-items/addons/${itemId}/add`, {
      title,
      price
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateMenuItemAddon(itemId, addonId, title, price) {
  try {
    const response = await ApiClient.post(`/menu-items/addons/${itemId}/update/${addonId}`, {
      title,
      price
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteMenuItemAddon(itemId, addonId) {
  try {
    const response = await ApiClient.delete(`/menu-items/addons/${itemId}/delete/${addonId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

export async function changeMenuItemVisibility(id, isEnabled) {
  try {
    const response = await ApiClient.patch(`/menu-items/change-visibility/${id}`, {
      isEnabled
    });
    return response;
  } catch (error) {
    throw error;
  }
};


export async function addMenuItemRecipeItem({menuItemId, variantId, addonId, ingredientId, quantity}) {
  try {
    const response = await ApiClient.post(`/menu-items/recipe/${menuItemId}/add`, {
      menuItemId, variantId, addonId,ingredientId, quantity
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateMenuItemRecipeItem({id: recipeItemId, menuItemId, variantId, addonId, ingredientId, quantity}) {
  try {
    const response = await ApiClient.put(`/menu-items/recipe/${menuItemId}/update/${recipeItemId}`, {
      menuItemId, variantId, addonId,ingredientId, quantity
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteRecipeItem(id, recipeItemId, recipeItemVariantId, recipeItemAddonId) {
  try {
    let url = `/menu-items/recipe/${id}/delete/${recipeItemId}`;
    const params = new URLSearchParams();

    if (recipeItemVariantId) params.append("variant", recipeItemVariantId);
    if (recipeItemAddonId) params.append("addon", recipeItemAddonId);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await ApiClient.delete(url);
    return response;
  } catch (error) {
    throw error;
  }
}

/* ============ Import & Export ============ */

export async function downloadImportTemplate() {
  try {
    const response = await ApiClient.get("/menu-items/import/template", {
      responseType: "blob",
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function exportMenuItems() {
  try {
    const response = await ApiClient.get("/menu-items/export", {
      responseType: "blob",
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function bulkImportMenuItems(items) {
  try {
    const response = await ApiClient.post("/menu-items/import", { items });
    return response;
  } catch (error) {
    throw error;
  }
}

