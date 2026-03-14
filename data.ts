
import { AppState, Enterprise, User, Department, ProcessDefinition, CompanyStrategy, BusinessDefinition, WeeklyPAD, SystemRole } from "./types";
import { supabase } from "./supabase";

/**
 * StratFlow AI 数据持久化层 (Data Access Layer) - Supabase Relational Version
 */

const isSupabaseConfigured = () => {
  // 优先检查运行时配置 (window.__APP_CONFIG__)，再检查编译时环境变量
  const runtimeUrl = (window as any).__APP_CONFIG__?.SUPABASE_URL;
  const runtimeKey = (window as any).__APP_CONFIG__?.SUPABASE_ANON_KEY;
  const buildTimeUrl = import.meta.env.VITE_SUPABASE_URL;
  const buildTimeKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return (runtimeUrl || buildTimeUrl) && (runtimeKey || buildTimeKey);
};

const handleSupabaseError = (error: any) => {
  if (error?.message === 'Failed to fetch' || error instanceof TypeError) {
    throw new Error("网络连接失败或 Supabase URL 配置错误。请检查 VITE_SUPABASE_URL 是否正确，以及网络是否畅通。");
  }
  throw new Error(error?.message || "未知数据库错误");
};

/**
 * 注册/更新企业账号
 */
export const saveEnterprise = async (ent: Enterprise): Promise<void> => {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  try {
    const { error } = await supabase.from('enterprises').upsert({ 
      name: ent.name, 
      displayName: ent.displayName, 
      password: ent.password 
    });
    if (error) handleSupabaseError(error);
  } catch (e) {
    handleSupabaseError(e);
  }
};

/**
 * 获取所有注册企业列表
 */
export const getEnterprises = async (): Promise<Enterprise[]> => {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  try {
    const { data, error } = await supabase.from('enterprises').select('*');
    if (error) handleSupabaseError(error);
    return data as Enterprise[];
  } catch (e) {
    handleSupabaseError(e);
    return [];
  }
};

/**
 * 持久化保存整个工作空间的状态 (拆分到各个关系表)
 */
export const saveWorkspace = async (entName: string, state: AppState): Promise<void> => {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");

  try {
    // 1. Users
    if (state.users) {
      const usersData = state.users.map(u => ({
        id: u.id, ent_name: entName, username: u.username, password: u.password,
        name: u.name, role: u.role, department_id: u.departmentId || null,
        pad_permissions: u.padPermissions || null, reviews: u.reviews || null,
        system_role_ids: u.systemRoleIds || null, custom_permissions: u.customPermissions || null
      }));
      // Delete removed users
      const existingUsers = await supabase.from('users').select('id').eq('ent_name', entName);
      if (existingUsers.data) {
        const currentIds = new Set(usersData.map(u => u.id));
        const toDelete = existingUsers.data.filter(u => !currentIds.has(u.id)).map(u => u.id);
        if (toDelete.length > 0) await supabase.from('users').delete().in('id', toDelete);
      }
      if (usersData.length > 0) {
        const { error } = await supabase.from('users').upsert(usersData);
        if (error) throw error;
      }
    }

    // 2. Departments
    if (state.departments) {
      const deptsData = state.departments.map(d => ({
        id: d.id, ent_name: entName, name: d.name, manager_name: d.managerName || null,
        responsibilities: d.responsibilities || null, roles: d.roles || [],
        role_members: d.roleMembers || null, attributes: d.attributes || null,
        sub_departments: d.subDepartments || null, okrs: d.okrs || null, reviews: d.reviews || null
      }));
      const existingDepts = await supabase.from('departments').select('id').eq('ent_name', entName);
      if (existingDepts.data) {
        const currentIds = new Set(deptsData.map(d => d.id));
        const toDelete = existingDepts.data.filter(d => !currentIds.has(d.id)).map(d => d.id);
        if (toDelete.length > 0) await supabase.from('departments').delete().in('id', toDelete);
      }
      if (deptsData.length > 0) {
        const { error } = await supabase.from('departments').upsert(deptsData);
        if (error) throw error;
      }
    }

    // 3. Processes
    if (state.processes) {
      const procsData = state.processes.map(p => ({
        id: p.id, ent_name: entName, name: p.name, category: p.category, level: p.level,
        version: p.version, is_active: p.isActive, type: p.type, owner: p.owner,
        co_owner: p.coOwner, objective: p.objective, nodes: p.nodes || [],
        links: p.links || [], history: p.history || [], updated_at: p.updatedAt
      }));
      const existingProcs = await supabase.from('processes').select('id').eq('ent_name', entName);
      if (existingProcs.data) {
        const currentIds = new Set(procsData.map(p => p.id));
        const toDelete = existingProcs.data.filter(p => !currentIds.has(p.id)).map(p => p.id);
        if (toDelete.length > 0) await supabase.from('processes').delete().in('id', toDelete);
      }
      if (procsData.length > 0) {
        const { error } = await supabase.from('processes').upsert(procsData);
        if (error) throw error;
      }
    }

    // 4. Strategy
    if (state.strategy) {
      const { error } = await supabase.from('strategy').upsert({
        ent_name: entName, mission: state.strategy.mission || '', vision: state.strategy.vision || '',
        customer_issues: state.strategy.customerIssues || '', employee_issues: state.strategy.employeeIssues || '',
        company_okrs: state.strategy.companyOKRs || {}
      });
      if (error) throw error;
    }

    // 5. Businesses
    if (state.businesses) {
      const bizData = state.businesses.map(b => ({
        id: b.id, ent_name: entName, name: b.name, business_format: b.businessFormat || '',
        customer_persona: b.customerPersona || '', customer_needs: b.customerNeeds || '',
        surface_product_power: b.surfaceProductPower || '', core_product_power: b.coreProductPower || ''
      }));
      const existingBiz = await supabase.from('businesses').select('id').eq('ent_name', entName);
      if (existingBiz.data) {
        const currentIds = new Set(bizData.map(b => b.id));
        const toDelete = existingBiz.data.filter(b => !currentIds.has(b.id)).map(b => b.id);
        if (toDelete.length > 0) await supabase.from('businesses').delete().in('id', toDelete);
      }
      if (bizData.length > 0) {
        const { error } = await supabase.from('businesses').upsert(bizData);
        if (error) throw error;
      }
    }

    // 6. Weekly PADs
    if (state.weeklyPADs) {
      const padsData = state.weeklyPADs.map(w => ({
        id: w.id, ent_name: entName, week_id: w.weekId, owner_id: w.ownerId,
        type: w.type, entries: w.entries || []
      }));
      const existingPads = await supabase.from('weekly_pads').select('id').eq('ent_name', entName);
      if (existingPads.data) {
        const currentIds = new Set(padsData.map(p => p.id));
        const toDelete = existingPads.data.filter(p => !currentIds.has(p.id)).map(p => p.id);
        if (toDelete.length > 0) await supabase.from('weekly_pads').delete().in('id', toDelete);
      }
      if (padsData.length > 0) {
        const { error } = await supabase.from('weekly_pads').upsert(padsData);
        if (error) throw error;
      }
    }

    // 7. System Roles
    if (state.systemRoles) {
      const rolesData = state.systemRoles.map(r => ({
        id: r.id, ent_name: entName, name: r.name, description: r.description || '',
        permissions: r.permissions || {}
      }));
      const existingRoles = await supabase.from('system_roles').select('id').eq('ent_name', entName);
      if (existingRoles.data) {
        const currentIds = new Set(rolesData.map(r => r.id));
        const toDelete = existingRoles.data.filter(r => !currentIds.has(r.id)).map(r => r.id);
        if (toDelete.length > 0) await supabase.from('system_roles').delete().in('id', toDelete);
      }
      if (rolesData.length > 0) {
        const { error } = await supabase.from('system_roles').upsert(rolesData);
        if (error) throw error;
      }
    }

  } catch (e) {
    handleSupabaseError(e);
  }
};

/**
 * 读取企业的工作空间数据 (从各个关系表组装)
 */
export const getWorkspace = async (entName: string): Promise<AppState | null> => {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");

  try {
    // Check if enterprise exists
    const { data: entData, error: entError } = await supabase.from('enterprises').select('name').eq('name', entName).single();
    if (entError || !entData) return null;

    // Fetch all related data concurrently
    const [
      { data: users },
      { data: departments },
      { data: processes },
      { data: strategy },
      { data: businesses },
      { data: weeklyPADs },
      { data: systemRoles }
    ] = await Promise.all([
      supabase.from('users').select('*').eq('ent_name', entName),
      supabase.from('departments').select('*').eq('ent_name', entName),
      supabase.from('processes').select('*').eq('ent_name', entName),
      supabase.from('strategy').select('*').eq('ent_name', entName).single(),
      supabase.from('businesses').select('*').eq('ent_name', entName),
      supabase.from('weekly_pads').select('*').eq('ent_name', entName),
      supabase.from('system_roles').select('*').eq('ent_name', entName)
    ]);

    const appState: AppState = {
      users: (users || []).map(u => ({
        id: u.id, username: u.username, password: u.password, name: u.name, role: u.role,
        departmentId: u.department_id, padPermissions: u.pad_permissions, reviews: u.reviews,
        systemRoleIds: u.system_role_ids, customPermissions: u.custom_permissions
      })),
      departments: (departments || []).map(d => ({
        id: d.id, name: d.name, managerName: d.manager_name, responsibilities: d.responsibilities,
        roles: d.roles, roleMembers: d.role_members, attributes: d.attributes,
        subDepartments: d.sub_departments, okrs: d.okrs, reviews: d.reviews
      })),
      processes: (processes || []).map(p => ({
        id: p.id, name: p.name, category: p.category, level: p.level, version: p.version,
        isActive: p.is_active, type: p.type, owner: p.owner, coOwner: p.co_owner,
        objective: p.objective, nodes: p.nodes, links: p.links, history: p.history, updatedAt: p.updated_at
      })),
      strategy: strategy ? {
        mission: strategy.mission, vision: strategy.vision, customerIssues: strategy.customer_issues,
        employeeIssues: strategy.employee_issues, companyOKRs: strategy.company_okrs
      } : { mission: '', vision: '', customerIssues: '', employeeIssues: '', companyOKRs: {} },
      businesses: (businesses || []).map(b => ({
        id: b.id, name: b.name, businessFormat: b.business_format, customerPersona: b.customer_persona,
        customerNeeds: b.customer_needs, surfaceProductPower: b.surface_product_power, coreProductPower: b.core_product_power
      })),
      weeklyPADs: (weeklyPADs || []).map(w => ({
        id: w.id, weekId: w.week_id, ownerId: w.owner_id, type: w.type, entries: w.entries
      })),
      systemRoles: (systemRoles || []).map(r => ({
        id: r.id, name: r.name, description: r.description, permissions: r.permissions
      }))
    };

    return appState;
  } catch (e) {
    if ((e as any)?.code === 'PGRST116') return null; // No rows for strategy
    handleSupabaseError(e);
    return null;
  }
};

