const {
  getBusinessGroupsDB,
  getBusinessGroupsCountDB,
  getBusinessGroupByIdDB,
  getBusinessGroupByNameDB,
  createBusinessGroupDB,
  updateBusinessGroupDB,
  deleteBusinessGroupDB,
  getBusinessesByGroupIdDB,
  getUnlinkedBusinessesDB,
  getTenantGroupInfoDB,
  linkBusinessToGroupDB,
  unlinkBusinessFromGroupDB,
  getBusinessGroupOwnersDB,
  getUserByUsernameDB,
  createBusinessGroupOwnerDB,
  updateBusinessGroupOwnerPermissionDB,
  updateBusinessGroupOwnerStatusDB,
  deleteBusinessGroupOwnerDB,
} = require("../services/business_group.service");
const { GROUP_PERMISSION_LEVELS } = require("../config/user.config");
const { getAdminUserDB } = require("../services/superadmin.service");
const bcrypt = require("bcrypt");
const { CONFIG } = require("../config");

/**
 * Business Groups (Phase 1) — Super Admin only.
 *
 * Every route in this controller is mounted behind isLoggedIn + isAuthenticated
 * + isSuperAdmin (see routes/business_group.routes.js). No tenant-scoped user
 * can reach any handler here, and no handler reads req.user.tenant_id — groups
 * are a platform-level concern.
 */

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;

/**
 * Parses a route/body identifier into a positive integer.
 * Returns null for anything that is not one, so callers can reject it with 400
 * instead of passing "abc" or "-1" down to the query layer.
 */
const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
};

/**
 * Validates and normalises a create/update group payload.
 * Returns { errorKey } on failure, or { name, description } on success with the
 * name trimmed and an empty description normalised to NULL.
 */
const validateGroupPayload = (body) => {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rawDescription =
    typeof body?.description === "string" ? body.description.trim() : "";

  if (!name) {
    return { errorKey: "business_group_name_required" };
  }

  if (name.length > NAME_MAX_LENGTH) {
    return { errorKey: "business_group_name_too_long" };
  }

  if (rawDescription.length > DESCRIPTION_MAX_LENGTH) {
    return { errorKey: "business_group_description_too_long" };
  }

  return {
    name,
    description: rawDescription || null,
  };
};

/**
 * GET /superadmin/business-groups
 * Query: page, perPage, search
 * Paginated list of groups, each with its member count.
 */
exports.getBusinessGroups = async (req, res) => {
  try {
    const { page, perPage, search } = req.query;

    const [result, total] = await Promise.all([
      getBusinessGroupsDB(page, perPage, search),
      getBusinessGroupsCountDB(search),
    ]);

    return res.status(200).json({
      success: true,
      groups: result.groups,
      currentPage: result.currentPage,
      perPage: result.perPage,
      total,
      totalPages: Math.ceil(total / result.perPage) || 1,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * GET /superadmin/business-groups/:id
 * Returns the group, every linked business, and the business count.
 */
exports.getBusinessGroupDetails = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    const businesses = await getBusinessesByGroupIdDB(groupId);

    return res.status(200).json({
      success: true,
      group,
      businesses,
      businessesCount: businesses.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * POST /superadmin/business-groups
 * Body: { name, description }
 */
exports.createBusinessGroup = async (req, res) => {
  try {
    const { errorKey, name, description } = validateGroupPayload(req.body);

    if (errorKey) {
      return res.status(400).json({
        success: false,
        message: req.__(errorKey),
      });
    }

    const existingGroup = await getBusinessGroupByNameDB(name);

    if (existingGroup) {
      return res.status(409).json({
        success: false,
        message: req.__("business_group_name_already_exists"),
      });
    }

    // req.user.username is the superadmins.email of the acting Super Admin.
    const group = await createBusinessGroupDB(
      name,
      description,
      req.user?.username || null,
    );

    return res.status(200).json({
      success: true,
      message: req.__("business_group_created_successfully"),
      group,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * PUT /superadmin/business-groups/:id
 * Body: { name, description }
 */
exports.updateBusinessGroup = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const { errorKey, name, description } = validateGroupPayload(req.body);

    if (errorKey) {
      return res.status(400).json({
        success: false,
        message: req.__(errorKey),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    // Exclude self so a group can be saved without renaming it.
    const duplicateGroup = await getBusinessGroupByNameDB(name, groupId);

    if (duplicateGroup) {
      return res.status(409).json({
        success: false,
        message: req.__("business_group_name_already_exists"),
      });
    }

    await updateBusinessGroupDB(groupId, name, description);

    return res.status(200).json({
      success: true,
      message: req.__("business_group_updated_successfully"),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * DELETE /superadmin/business-groups/:id
 * Unlinks every member business, then deletes the group. Businesses survive.
 */
exports.deleteBusinessGroup = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    const { unlinkedBusinesses, deletedOwners } = await deleteBusinessGroupDB(groupId);

    return res.status(200).json({
      success: true,
      message: req.__("business_group_deleted_successfully"),
      unlinkedBusinesses,
      deletedOwners,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * GET /superadmin/business-groups/:id/available-businesses
 * Query: search
 * Businesses with no group yet — the only valid options for the Link dialog.
 */
exports.getAvailableBusinesses = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    const businesses = await getUnlinkedBusinessesDB(req.query.search);

    return res.status(200).json({
      success: true,
      businesses,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * POST /superadmin/business-groups/:id/businesses
 * Body: { tenantId }
 *
 * Rejects: unknown group, unknown tenant, tenant already in this group
 * (duplicate link), tenant already in another group.
 */
exports.linkBusiness = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const tenantId = parseId(req.body?.tenantId);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_tenant"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    const tenant = await getTenantGroupInfoDB(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: req.__("tenant_not_found"),
      });
    }

    if (tenant.business_group_id === groupId) {
      return res.status(409).json({
        success: false,
        message: req.__("business_already_linked_to_this_group"),
      });
    }

    if (tenant.business_group_id !== null) {
      return res.status(409).json({
        success: false,
        message: req.__("business_already_linked_to_another_group"),
      });
    }

    // Guarded UPDATE: only succeeds while the business is still unlinked, so a
    // concurrent request cannot move it out of another group.
    const isLinked = await linkBusinessToGroupDB(groupId, tenantId);

    if (!isLinked) {
      return res.status(409).json({
        success: false,
        message: req.__("business_already_linked_to_another_group"),
      });
    }

    return res.status(200).json({
      success: true,
      message: req.__("business_linked_successfully"),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * DELETE /superadmin/business-groups/:id/businesses/:tenantId
 * Removes the membership only — the business itself is never touched.
 */
exports.unlinkBusiness = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const tenantId = parseId(req.params.tenantId);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_tenant"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    const tenant = await getTenantGroupInfoDB(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: req.__("tenant_not_found"),
      });
    }

    // Scoped to this group, so one group can never unlink another's member.
    const isUnlinked = await unlinkBusinessFromGroupDB(groupId, tenantId);

    if (!isUnlinked) {
      return res.status(400).json({
        success: false,
        message: req.__("business_not_linked_to_this_group"),
      });
    }

    return res.status(200).json({
      success: true,
      message: req.__("business_unlinked_successfully"),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/* ==========================================================================
 * Business Group Owners (Phase 2) — Super Admin only
 * ========================================================================== */

/**
 * Validates a permission level from a request body.
 * Returns null when the value is not one of the two supported levels, so an
 * unknown level can never be persisted (and can never widen access).
 */
const OWNER_NAME_PART_MAX_LENGTH = 40;
const OWNER_PASSWORD_MIN_LENGTH = 8;
const OWNER_PHONE_MAX_LENGTH = 20;

/**
 * Validates a Business Group Owner account status.
 * Anything other than the two known values is rejected rather than defaulted, so
 * a typo cannot silently activate an account.
 */
const parseOwnerStatus = (value) => {
  // Absent means "use the default" — new accounts are active.
  if (value === undefined || value === null || value === "") {
    return "active";
  }

  const status = typeof value === "string" ? value.trim().toLowerCase() : "";

  return status === "active" || status === "inactive" ? status : null;
};

/**
 * Validates and normalises the create-owner payload.
 *
 * `username` is not accepted from the client: the email IS the login identifier
 * everywhere in this platform, so it is derived from `email` and lower-cased so
 * two owners cannot be created that differ only by case.
 *
 * Returns { errorKey } on failure, or the normalised fields plus the combined
 * `name` that gets stored (users has a single name column, not first/last).
 */
const validateOwnerPayload = (body) => {
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const rawEmail = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!firstName) {
    return { errorKey: "first_name_required" };
  }

  if (firstName.length > OWNER_NAME_PART_MAX_LENGTH || lastName.length > OWNER_NAME_PART_MAX_LENGTH) {
    return { errorKey: "name_too_long" };
  }

  if (!rawEmail) {
    return { errorKey: "please_provide_email" };
  }

  // Same shape check the rest of the platform applies to a login email.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return { errorKey: "please_provide_valid_email" };
  }

  if (phone.length > OWNER_PHONE_MAX_LENGTH) {
    return { errorKey: "invalid_phone" };
  }

  if (!password) {
    return { errorKey: "please_provide_password" };
  }

  if (password.length < OWNER_PASSWORD_MIN_LENGTH) {
    return { errorKey: "password_too_short" };
  }

  const email = rawEmail.toLowerCase();

  return {
    firstName,
    lastName,
    email,
    phone: phone || null,
    password,
    name: [firstName, lastName].filter(Boolean).join(" "),
  };
};

const parsePermissionLevel = (value) => {
  const level = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (
    level === GROUP_PERMISSION_LEVELS.READ ||
    level === GROUP_PERMISSION_LEVELS.WRITE
  ) {
    return level;
  }

  return null;
};

/**
 * GET /superadmin/business-groups/:id/owners
 * Owners of the group, plus the candidate users the Assign dialog can offer.
 */
exports.getBusinessGroupOwners = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    const owners = await getBusinessGroupOwnersDB(groupId);

    return res.status(200).json({
      success: true,
      owners,
      ownersCount: owners.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * POST /superadmin/business-groups/:id/owners
 * Body: { firstName, lastName, email, phone, password, permissionLevel, status }
 *
 * Creates a DEDICATED Business Group Owner account.
 *
 * This never converts an existing Business Admin or Staff account: those manage
 * a single business, an owner manages many, and mixing the two produces
 * conflicting permissions. The email must therefore be unused.
 *
 * The account shape is fixed by the architecture, not by the request:
 * role='group_owner', tenant_id=NULL, business_group_id=<this group>.
 */
exports.createBusinessGroupOwner = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const { errorKey, firstName, lastName, email, phone, password, name } =
      validateOwnerPayload(req.body);

    if (errorKey) {
      return res.status(400).json({
        success: false,
        message: req.__(errorKey),
      });
    }

    const permissionLevel = parsePermissionLevel(req.body?.permissionLevel);

    if (!permissionLevel) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_permission_level"),
      });
    }

    const status = parseOwnerStatus(req.body?.status);

    if (!status) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_status"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    // The email is the login identifier, so it must be unique across every
    // account on the platform — business users and Super Admins included.
    const superAdmin = await getAdminUserDB(email);

    if (superAdmin) {
      return res.status(409).json({
        success: false,
        message: req.__("user_already_exist_try_different_email"),
      });
    }

    const existingUser = await getUserByUsernameDB(email);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: req.__("user_already_exist_try_different_email"),
      });
    }

    // Same hashing as every other account in the platform.
    const encryptedPassword = await bcrypt.hash(password, CONFIG.PASSWORD_SALT);

    const owner = await createBusinessGroupOwnerDB(
      email,
      encryptedPassword,
      name,
      phone,
      email,
      groupId,
      permissionLevel,
      status,
    );

    return res.status(200).json({
      success: true,
      message: req.__("group_owner_created_successfully"),
      owner: {
        username: owner.username,
        firstName,
        lastName,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        permissionLevel,
        status,
      },
    });
  } catch (error) {
    console.error(error);

    // Unique key on users.username — a parallel request won the race.
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: req.__("user_already_exist_try_different_email"),
      });
    }

    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * PATCH /superadmin/business-groups/:id/owners/:username/status
 * Body: { status: "active" | "inactive" }
 *
 * Deactivating blocks the account at login and ends any live session.
 */
exports.updateBusinessGroupOwnerStatus = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const username =
      typeof req.params?.username === "string" ? req.params.username.trim() : "";

    if (!username) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"),
      });
    }

    const status = parseOwnerStatus(req.body?.status);

    if (!status) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_status"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    const isUpdated = await updateBusinessGroupOwnerStatusDB(
      username,
      groupId,
      status,
    );

    if (!isUpdated) {
      return res.status(404).json({
        success: false,
        message: req.__("group_owner_not_found_in_this_group"),
      });
    }

    return res.status(200).json({
      success: true,
      message: req.__("group_owner_status_updated_successfully"),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * PUT /superadmin/business-groups/:id/owners/:username
 * Body: { permissionLevel }
 *
 * NOTE: the spec calls this segment :userId. The users table has no surrogate
 * id — `username` IS its primary key — so the username is the identifier here.
 */
exports.updateBusinessGroupOwnerPermission = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const username =
      typeof req.params?.username === "string" ? req.params.username.trim() : "";

    if (!username) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"),
      });
    }

    const permissionLevel = parsePermissionLevel(req.body?.permissionLevel);

    if (!permissionLevel) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_permission_level"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    // Scoped to this group, so one group can never change another's owner.
    const isUpdated = await updateBusinessGroupOwnerPermissionDB(
      username,
      groupId,
      permissionLevel,
    );

    if (!isUpdated) {
      return res.status(404).json({
        success: false,
        message: req.__("group_owner_not_found_in_this_group"),
      });
    }

    return res.status(200).json({
      success: true,
      message: req.__("group_owner_permission_updated_successfully"),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * DELETE /superadmin/business-groups/:id/owners/:username
 *
 * Deletes the owner account. Owner accounts are DEDICATED — they are never a
 * repurposed Business Admin or Staff account — so removing the owner removes the
 * account. No business user can be affected: the delete is scoped to
 * role='group_owner' within this group.
 */
exports.removeBusinessGroupOwner = async (req, res) => {
  try {
    const groupId = parseId(req.params.id);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_business_group"),
      });
    }

    const username =
      typeof req.params?.username === "string" ? req.params.username.trim() : "";

    if (!username) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    const isRemoved = await deleteBusinessGroupOwnerDB(username, groupId);

    if (!isRemoved) {
      return res.status(404).json({
        success: false,
        message: req.__("group_owner_not_found_in_this_group"),
      });
    }

    return res.status(200).json({
      success: true,
      message: req.__("group_owner_removed_successfully"),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/* ==========================================================================
 * Business Group Owner CAPABILITY (dual role) — assign an EXISTING user
 * ========================================================================== */

const {
  getAssignableGroupOwnerCandidatesDB,
  assignGroupOwnerCapabilityDB,
  removeGroupOwnerCapabilityDB,
} = require("../services/business_group.service");

/**
 * GET /superadmin/business-groups/:id/owners/candidates?search=
 *
 * Business Admins eligible to be granted group-owner capability. Super Admins
 * are absent by construction — they live in the `superadmins` table and have no
 * `users` row — and anyone already in a group is filtered out.
 */
exports.getGroupOwnerCandidates = async (req, res) => {
  try {
    const search = req.query.search?.trim() || null;
    const candidates = await getAssignableGroupOwnerCandidatesDB(search);

    return res.status(200).json({
      success: true,
      candidates: candidates.map((c) => ({
        username: c.username,
        name: c.name,
        email: c.email || c.username,
        phone: c.phone,
        role: c.role,
        status: c.status,
        tenantId: c.tenant_id,
        businessName: c.business_name,
        businessIsActive: c.business_is_active,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * POST /superadmin/business-groups/:id/owners/assign
 * Body: { username, permissionLevel }
 *
 * Grants group-owner capability to an existing Business Admin. No user is
 * created, no password touched, no role changed — the user keeps administering
 * their own business and additionally owns the group.
 */
exports.assignExistingUserAsGroupOwner = async (req, res) => {
  try {
    const groupId = req.params.id;
    const username = req.body?.username?.trim();
    const permissionLevel = req.body?.permissionLevel;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"),
      });
    }

    if (![GROUP_PERMISSION_LEVELS.READ, GROUP_PERMISSION_LEVELS.WRITE].includes(permissionLevel)) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_permission_level"),
      });
    }

    const group = await getBusinessGroupByIdDB(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: req.__("business_group_not_found"),
      });
    }

    const result = await assignGroupOwnerCapabilityDB(username, groupId, permissionLevel);

    if (!result.ok) {
      const messages = {
        not_found: req.__("user_not_found"),
        inactive: req.__("account_inactive"),
        already_in_this_group: req.__("user_already_group_owner"),
        already_in_another_group: req.__("user_already_in_another_group"),
        not_a_business_admin: req.__("only_business_admin_can_be_assigned"),
      };
      return res.status(409).json({
        success: false,
        reason: result.reason,
        message: messages[result.reason] || req.__("operation_not_allowed"),
      });
    }

    return res.status(200).json({
      success: true,
      message: req.__("group_owner_assigned_successfully"),
      owner: { username: result.username, tenantId: result.tenantId, role: result.role },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

/**
 * DELETE /superadmin/business-groups/:id/owners/:username/capability
 *
 * Revokes group-owner capability. The user carries on as the Business Admin of
 * their own business — nothing else about the account changes.
 */
exports.removeGroupOwnerCapability = async (req, res) => {
  try {
    const { id: groupId, username } = req.params;

    const removed = await removeGroupOwnerCapabilityDB(username, groupId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: req.__("group_owner_not_found_in_this_group"),
      });
    }

    return res.status(200).json({
      success: true,
      message: req.__("group_owner_capability_removed_successfully"),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};
