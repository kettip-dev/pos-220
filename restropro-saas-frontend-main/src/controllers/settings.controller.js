import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";
import { useEffect } from "react";
import { setImageStorageConfig } from "../helpers/ImageHelper";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useStoreSettings() {
  const APIURL = `/settings/store-setting`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);

  // Option B: Set image storage config whenever store settings are fetched
  // Do this synchronously so getImageURL during the current render gets the correct URL.
  if (data?.imageStorageConfig) {
    setImageStorageConfig(data.imageStorageConfig);
  }

  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function saveStoreSettings(storeName, address, phone, email, currency, image, isQRMenuEnabled , isQROrderEnabled, isFeedbackEnabled) {
  try {
    const response = await ApiClient.post("/settings/store-setting", {
      storeName, address, phone, email, currency, image,
      isQRMenuEnabled, isQROrderEnabled, isFeedbackEnabled
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function uploadStoreImage(formData) {
  try {
    const response = await ApiClient.post("/settings/store-setting/upload-store-image", formData);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteStoreImage(uniqueId) {
  try {
    const response = await ApiClient.post("/settings/store-setting/delete-store-image", {
      uniqueId
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getServiceCharge() {
  try {
    const response = await ApiClient.get(`/settings/store-setting/service-charge`)
    return response;
  } catch (error) {
    throw error;
  }
}


export async function updateServiceCharge(serviceCharge) {
  try {
    const response = await ApiClient.post(`/settings/store-setting/service-charge`, {
      serviceCharge
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export function usePrintSettings() {
  const APIURL = `/settings/print-setting`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function savePrintSettings(pageFormat, header, footer, showNotes, isEnablePrint, showStoreDetails, showCustomerDetails, printToken) {
  try {
    const response = await ApiClient.post("/settings/print-setting", {
      pageFormat, header, footer, showNotes, isEnablePrint, showStoreDetails, printToken, showCustomerDetails
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export function usePaymentTypes() {
  const APIURL = `/settings/payment-types`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function addNewPaymentType(title, isActive, icon) {
  try {
    const response = await ApiClient.post("/settings/payment-types/add", {
      title,
      isActive,
      icon
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function deletePaymentType(id) {
  try {
    const response = await ApiClient.delete(`/settings/payment-types/${id}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function togglePaymentType(id, isActive) {
  try {
    const response = await ApiClient.post(`/settings/payment-types/${id}/toggle`, {
      isActive
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function updatePaymentType(id, title, isActive, icon) {
  try {
    const response = await ApiClient.post(`/settings/payment-types/${id}/update`, {
      title,
      isActive,
      icon
    })
    return response;
  } catch (error) {
    throw error;
  }
};


export function useTaxes() {
  const APIURL = `/settings/taxes`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function addNewTax(title, rate, type) {
  try {
    const response = await ApiClient.post("/settings/taxes/add", {
      title,
      rate, type
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function deleteTax(id) {
  try {
    const response = await ApiClient.delete(`/settings/taxes/${id}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function updateTax(id, title, rate, type) {
  try {
    const response = await ApiClient.post(`/settings/taxes/${id}/update`, {
      title,
      rate, type
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export function useStoreTables() {
  const APIURL = `/settings/store-tables`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useStoreTablesLiveStatus() {
  const APIURL = `/settings/store-tables/live-status`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export async function saveStoreTablesLayout(floor, tables, floorSettings) {
  try {
    const response = await ApiClient.post("/settings/store-tables/layout", {
      floor,
      tables,
      floorSettings,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function uploadFloorPlanImage(floor, file) {
  try {
    const formData = new FormData();
    formData.append("floor", floor);
    formData.append("image", file);
    const response = await ApiClient.post("/settings/store-tables/floor-plan/upload", formData);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteFloorPlanImage(floor) {
  try {
    const response = await ApiClient.post("/settings/store-tables/floor-plan/delete", { floor });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteTable(id) {
  try {
    const response = await ApiClient.delete(`/settings/store-tables/${id}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function addNewStoreTable(title, floor, seatingCapacity, shape = 'round', rotation = 0, posX = null, posY = null) {
  try {
    const response = await ApiClient.post("/settings/store-tables/add", {
      title, floor, seatingCapacity, shape, rotation, posX, posY
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function updateStoreTable(id, title, floor, seatingCapacity, shape = null, rotation = null, posX = null, posY = null) {
  try {
    const response = await ApiClient.post(`/settings/store-tables/${id}/update`, {
      title, floor, seatingCapacity, shape, rotation, posX, posY
    })
    return response;
  } catch (error) {
    throw error;
  }
};


export function useCategories() {
  const APIURL = `/settings/categories`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function addCategory(title) {
  try {
    const response = await ApiClient.post("/settings/categories/add", {
      title
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function deleteCategory(id) {
  try {
    const response = await ApiClient.delete(`/settings/categories/${id}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function updateCategory(id, title) {
  try {
    const response = await ApiClient.post(`/settings/categories/${id}/update`, {
      title
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function changeCategoryVisibilty(id, isEnabled) {
  try {
    const response = await ApiClient.patch(`/settings/categories/change-visibility/${id}`, {
      isEnabled
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export function useDevices() {
  const APIURL = `/auth/devices`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function removeDevice(deviceId) {
  try {
    const response = await ApiClient.post(`/auth/remove-device`, {
      device_id: deviceId
    })
    return response;
  } catch (error) {
    throw error;
  }
};

// ── Image Storage Config ─────────────────────────────────────────────────────

