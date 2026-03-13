import { User, SystemRole, MenuPermission, Department } from '../types';

export const hasPermission = (
  user: User,
  systemRoles: SystemRole[],
  menuId: string,
  action: keyof MenuPermission
): boolean => {
  // Admin role has all permissions
  if (user.role === 'Admin') return true;

  // Check custom permissions first (override)
  if (user.customPermissions && user.customPermissions[menuId]) {
    return user.customPermissions[menuId][action];
  }

  // Check role permissions
  if (user.systemRoleIds && user.systemRoleIds.length > 0) {
    for (const roleId of user.systemRoleIds) {
      const role = systemRoles.find(r => r.id === roleId);
      if (role && role.permissions && role.permissions[menuId] && role.permissions[menuId][action]) {
        return true;
      }
    }
  }

  // Default to false if no permission is found
  return false;
};

export const getVisibleDepartments = (user: User, allDepartments: Department[]): Department[] => {
  if (user.role === 'Admin') return allDepartments;

  const visibleIds = new Set<string>();
  if (user.departmentId) visibleIds.add(user.departmentId);
  if (user.padPermissions) {
    user.padPermissions.forEach(id => visibleIds.add(id));
  }

  // Helper to check if a department or any of its ancestors is in visibleIds
  const isVisible = (dept: Department, path: string[] = []): boolean => {
    if (visibleIds.has(dept.id)) return true;
    for (const p of path) {
      if (visibleIds.has(p)) return true;
    }
    return false;
  };

  const filterTree = (depts: Department[], path: string[] = []): Department[] => {
    return depts.map(d => {
      const currentPath = [...path, d.id];
      const visible = isVisible(d, path);
      
      // If this department is visible, all its sub-departments are visible
      // If it's not visible, maybe some sub-department is visible, so we must traverse
      
      let filteredSubs: Department[] | undefined;
      if (d.subDepartments) {
        filteredSubs = filterTree(d.subDepartments, currentPath);
        if (filteredSubs.length === 0) filteredSubs = undefined;
      }

      if (visible || (filteredSubs && filteredSubs.length > 0)) {
        return {
          ...d,
          subDepartments: filteredSubs
        };
      }
      return null;
    }).filter(Boolean) as Department[];
  };

  return filterTree(allDepartments);
};
