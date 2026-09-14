import ApiClient from "../helpers/ApiClient";

/**
 * Business Groups (Phase 1) — Super Admin only.
 *
 * Thin wrappers over /superadmin/business-groups. ApiClient already carries the
 * session cookies, the `lang` param and the single-flight token refresh, so
 * these follow the same shape as the other superadmin controllers.
 */

export async function getBusinessGroups({ page, perPage, search }) {
  try {
    const response = await ApiClient.get(`/superadmin/business-groups`, {
      params: { page, perPage, search },
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getBusinessGroupDetails(id) {
  try {
    const response = await ApiClient.get(`/superadmin/business-groups/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function createBusinessGroup(name, description) {
  try {
    const response = await ApiClient.post(`/superadmin/business-groups`, {
      name, description
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateBusinessGroup(id, name, description) {
  try {
    const response = await ApiClient.put(`/superadmin/business-groups/${id}`, {
      name, description
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteBusinessGroup(id) {
  try {
    const response = await ApiClient.delete(`/superadmin/business-groups/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Businesses that still have no group — the only valid options for the
 * "Link Business" dropdown.
 */
export async function getAvailableBusinesses(id, search) {
  try {
    const response = await ApiClient.get(
      `/superadmin/business-groups/${id}/available-businesses`,
      { params: { search } },
    );
    return response;
  } catch (error) {
    throw error;
  }
}

export async function linkBusinessToGroup(id, tenantId) {
  try {
    const response = await ApiClient.post(
      `/superadmin/business-groups/${id}/businesses`,
      { tenantId },
    );
    return response;
  } catch (error) {
    throw error;
  }
}

export async function unlinkBusinessFromGroup(id, tenantId) {
  try {
    const response = await ApiClient.delete(
      `/superadmin/business-groups/${id}/businesses/${tenantId}`,
    );
    return response;
  } catch (error) {
    throw error;
  }
}

/* ==========================================================================
 * Business Group Owners (Phase 2) — Super Admin only
 *
 * The owner identifier is the username: `users.username` is the table's primary
 * key, there is no surrogate id column.
 * ========================================================================== */

export async function getBusinessGroupOwners(id) {
  try {
    const response = await ApiClient.get(
      `/superadmin/business-groups/${id}/owners`,
    );
    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Business Admins who can be granted Group Owner capability.
 *
 * Excludes anyone already in a group, anyone inactive, and Super Admins (who
 * have no `users` row at all). `search` matches name, email, phone or business.
 */
export async function getGroupOwnerCandidates(id, search) {
  try {
    const response = await ApiClient.get(
      `/superadmin/business-groups/${id}/owners/candidates`,
      { params: search ? { search } : {} },
    );
    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Grants Group Owner capability to an EXISTING Business Admin.
 *
 * Dual role: no user is created, no password touched and `role` stays 'admin'.
 * The user keeps full admin rights over their own business and gains group
 * owner rights across the group's other businesses.
 */
export async function assignExistingUserAsGroupOwner(id, username, permissionLevel) {
  try {
    const response = await ApiClient.post(
      `/superadmin/business-groups/${id}/owners/assign`,
      { username, permissionLevel },
    );
    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Revokes Group Owner capability. The user simply continues as the Business
 * Admin of their own business — no role restoration, no data loss.
 */
export async function removeGroupOwnerCapability(id, username) {
  try {
    const response = await ApiClient.delete(
      `/superadmin/business-groups/${id}/owners/${encodeURIComponent(username)}/capability`,
    );
    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Creates a DEDICATED Business Group Owner account — an account that exists
 * only to own the group (no home business).
 *
 * The alternative is `assignExistingUserAsGroupOwner` above, which grants the
 * same capability to an existing Business Admin without creating a user.
 */
export async function createBusinessGroupOwner(id, owner) {
  try {
    const response = await ApiClient.post(
      `/superadmin/business-groups/${id}/owners`,
      {
        firstName: owner.firstName,
        lastName: owner.lastName,
        email: owner.email,
        phone: owner.phone,
        password: owner.password,
        permissionLevel: owner.permissionLevel,
        status: owner.status,
      },
    );
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateBusinessGroupOwnerStatus(id, username, status) {
  try {
    const response = await ApiClient.patch(
      `/superadmin/business-groups/${id}/owners/${encodeURIComponent(username)}/status`,
      { status },
    );
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateBusinessGroupOwnerPermission(id, username, permissionLevel) {
  try {
    const response = await ApiClient.put(
      `/superadmin/business-groups/${id}/owners/${encodeURIComponent(username)}`,
      { permissionLevel },
    );
    return response;
  } catch (error) {
    throw error;
  }
}

export async function removeBusinessGroupOwner(id, username) {
  try {
    const response = await ApiClient.delete(
      `/superadmin/business-groups/${id}/owners/${encodeURIComponent(username)}`,
    );
    return response;
  } catch (error) {
    throw error;
  }
}
