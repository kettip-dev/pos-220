import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";
import { updateUserDetailsInLocalStorage } from "../helpers/UserDetails";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useProfile() {
  const APIURL = "/profile";
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    profile: data?.data,
    isLoading,
    error,
    mutate,
    APIURL,
  };
}

export async function updateProfile({ name, designation, phone, email }) {
  const response = await ApiClient.post("/profile/update", {
    name,
    designation,
    phone,
    email,
  });

  if (response.data?.user) {
    updateUserDetailsInLocalStorage(response.data.user);
  }

  return response;
}

export async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await ApiClient.post("/profile/upload-photo", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  if (response.data?.user) {
    updateUserDetailsInLocalStorage(response.data.user);
  }

  return response;
}

export async function removeProfilePhoto() {
  const response = await ApiClient.delete("/profile/photo");

  if (response.data?.user) {
    updateUserDetailsInLocalStorage(response.data.user);
  }

  return response;
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  const response = await ApiClient.post("/profile/change-password", {
    currentPassword,
    newPassword,
    confirmPassword,
  });

  return response;
}
