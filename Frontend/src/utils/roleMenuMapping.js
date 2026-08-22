export const ROLE_MENU_MAPPING_STORAGE_KEY = 'roleMenuMapping.v1'

export const slugifyLabel = (label) =>
  String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export const buildMenuId = (parentLabel, label) => {
  if (!parentLabel) return slugifyLabel(label)
  return slugifyLabel(`${parentLabel}-${label}`)
}

export function loadRoleMenuMapping() {
  try {
    const raw = localStorage.getItem(ROLE_MENU_MAPPING_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveRoleMenuMapping(mapping) {
  localStorage.setItem(ROLE_MENU_MAPPING_STORAGE_KEY, JSON.stringify(mapping || {}))
}

function findRoleKeyCaseInsensitive(mapping, roleName) {
  const target = String(roleName || '').trim().toLowerCase()
  if (!target) return null

  const keys = Object.keys(mapping || {})
  const exact = keys.find((k) => String(k).trim().toLowerCase() === target)
  return exact || null
}

export function getAllowedMenuIdsForRole(roleName) {
  const mapping = loadRoleMenuMapping()
  const direct = mapping?.[roleName]
  if (Array.isArray(direct)) return direct

  const key = findRoleKeyCaseInsensitive(mapping, roleName)
  const value = key ? mapping?.[key] : undefined
  return Array.isArray(value) ? value : null
}

export function setAllowedMenuIdsForRole(roleName, menuIds) {
  const mapping = loadRoleMenuMapping()
  mapping[roleName] = Array.isArray(menuIds) ? menuIds : []
  saveRoleMenuMapping(mapping)
  return mapping
}
