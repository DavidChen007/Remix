
import React, { useMemo, useState } from 'react';
import { Department, ProcessNode, ProcessDefinition, User, MenuPermission } from '../types';
import { 
  Plus, Trash2, Building2, ChevronRight, X, Briefcase, ChevronDown, 
  ExternalLink, Search, User as UserIcon, Check, Minus, Save, WifiOff, CheckCircle, Info, Shield, Users, AlertCircle, Lock
} from 'lucide-react';

interface OrgViewProps {
  processes: ProcessDefinition[];
  departments: Department[];
  setDepartments: (depts: Department[]) => void;
  navigateToProcess: (procId: string) => void;
  handleSave: () => void;
  isSaving: boolean;
  showSaveSuccess: boolean;
  backendError: boolean;
  users: User[];
  permissions: MenuPermission;
}

const OrgView: React.FC<OrgViewProps> = ({ 
  processes = [], departments = [], setDepartments, navigateToProcess,
  handleSave, isSaving, showSaveSuccess, backendError, users, permissions
}) => {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [newSubDeptName, setNewSubDeptName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  
  // Separate state for Root Department Modal
  const [showAddRootModal, setShowAddRootModal] = useState(false);
  const [newRootDeptName, setNewRootDeptName] = useState('');

  const [pendingDeleteRole, setPendingDeleteRole] = useState<{deptId: string, roleName: string} | null>(null);
  const [pendingDeleteDept, setPendingDeleteDept] = useState<{id: string, name: string} | null>(null);
  const [assigningRole, setAssigningRole] = useState<{deptId: string, roleName: string} | null>(null);

  // ... (existing code)

  const performDeleteRole = () => {
    if (!pendingDeleteRole) return;
    setDepartments(updateDeptRecursive(departments, pendingDeleteRole.deptId, dep => ({ ...dep, roles: dep.roles.filter(role => role !== pendingDeleteRole.roleName) })));
    setPendingDeleteRole(null);
  };

  // ... (existing code)

  // In renderDeptCard:
  // <button onClick={(e) => { e.stopPropagation(); setPendingDeleteRole({deptId: d.id, roleName: r}); }} className="ml-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Minus size={10}/></button>

  // ... (existing code)



  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  const globalRoles = useMemo(() => {
    const roles = new Set<string>();
    const collect = (depts: Department[]) => {
      depts.forEach(d => {
        d.roles.forEach(r => roles.add(r));
        if (d.subDepartments) collect(d.subDepartments);
      });
    };
    collect(departments);
    return Array.from(roles).sort();
  }, [departments]);

  const updateDeptRecursive = (depts: Department[], id: string, updater: (d: Department) => Department): Department[] => {
    return depts.map(d => {
      if (d.id === id) return updater(d);
      if (d.subDepartments) return { ...d, subDepartments: updateDeptRecursive(d.subDepartments, id, updater) };
      return d;
    });
  };

  const deleteDeptFromTree = (depts: Department[], targetId: string): Department[] => {
    return depts
      .filter(d => d.id !== targetId) // Filter current level
      .map(d => ({
        ...d,
        subDepartments: d.subDepartments ? deleteDeptFromTree(d.subDepartments, targetId) : []
      }));
  };

  const addRootDepartment = () => {
    if (!newRootDeptName.trim()) return;
    const newDept: Department = { id: `dept-${Date.now()}`, name: newRootDeptName, roles: [], subDepartments: [], attributes: '', managerName: '', responsibilities: '' };
    setDepartments([...departments, newDept]); // App.tsx handles auto-save for this prop
    setNewRootDeptName('');
    setShowAddRootModal(false);
  };

  const addSubDepartment = (parentId: string) => {
    if (!newSubDeptName.trim()) return;
    const newDept: Department = { id: `dept-${Date.now()}`, name: newSubDeptName, roles: [], subDepartments: [], attributes: '', managerName: '', responsibilities: '' };
    setDepartments(updateDeptRecursive(departments, parentId, d => ({ ...d, subDepartments: [...(d.subDepartments || []), newDept] }))); // App.tsx handles auto-save
    setNewSubDeptName('');
    setAddingToId(null);
  };

  const addRoleToDept = (deptId: string, roleName: string) => {
    if (!roleName.trim()) return;
    setDepartments(updateDeptRecursive(departments, deptId, d => ({ ...d, roles: Array.from(new Set([...d.roles, roleName])) })));
    setNewRoleName('');
  };

  const toggleRoleMember = (deptId: string, roleName: string, userId: string) => {
    setDepartments(updateDeptRecursive(departments, deptId, d => {
      const currentMembers = d.roleMembers?.[roleName] || [];
      const newMembers = currentMembers.includes(userId)
        ? currentMembers.filter(id => id !== userId)
        : [...currentMembers, userId];
      return { 
        ...d, 
        roleMembers: { 
          ...(d.roleMembers || {}), 
          [roleName]: newMembers 
        } 
      };
    }));
  };

  const updateDeptField = (deptId: string, field: keyof Department, val: string) => {
    setDepartments(updateDeptRecursive(departments, deptId, d => ({ ...d, [field]: val })));
  };

  const performDeleteDept = () => {
    if (!pendingDeleteDept) return;
    // Use the recursive delete function instead of simple filter
    setDepartments(deleteDeptFromTree(departments, pendingDeleteDept.id));
    setPendingDeleteDept(null);
  };

  const renderDeptCard = (d: Department, depth = 0, isLast = false) => {
    // Basic filter match check
    if (searchQuery && !d.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        // If has sub departments, we might still want to render if child matches, 
        // but for simplicity let's filter top-level. 
        // Real tree search often needs recursive checking.
        // For now, if current doesn't match and we are at root, we skip.
        // But since this is recursive, we will just render everything and rely on the UI to highlight or user to expand.
    }

    return (
      <div key={d.id} className="relative w-full">
        {/* Tree Connector Lines for Children */}
        {depth > 0 && (
          <div className="absolute -left-8 top-12 w-8 h-px bg-slate-300"></div>
        )}
        
        <div className={`bg-white p-6 rounded-[2rem] border-2 shadow-sm hover:shadow-lg transition-all relative ${depth > 0 ? 'border-slate-100' : 'border-brand-100'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h4 className="font-black text-xl tracking-tight text-slate-800 flex items-center gap-2">
                <Building2 className={depth === 0 ? "text-brand-600" : "text-slate-400"} size={18}/>
                {d.name}
              </h4>
              <div className="flex items-center gap-3 mt-1">
                <button onClick={() => setSelectedDeptId(selectedDeptId === d.id ? null : d.id)} className="text-[9px] font-black text-brand-600 uppercase hover:underline">岗位治理 ({d.roles.length})</button>
                <button onClick={() => setEditingAttrId(editingAttrId === d.id ? null : d.id)} className="text-[9px] font-black text-slate-400 uppercase hover:underline">负责人与职责</button>
              </div>
            </div>
            <div className="flex gap-1">
                  {permissions.create && (
                    <button onClick={() => setAddingToId(addingToId === d.id ? null : d.id)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl" title="添加子部门"><Plus size={16}/></button>
                  )}
                  {permissions.update && (
                    <button onClick={() => setPendingDeleteDept({id: d.id, name: d.name})} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>
                  )}
            </div>
          </div>

          {editingAttrId === d.id && (
            <div className="mb-4 space-y-4 animate-in slide-in-from-top-2">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserIcon size={10}/> 部门负责人</label>
                 <input 
                  className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none border-slate-200 focus:border-brand-500 disabled:opacity-50" 
                  placeholder="负责人姓名..." 
                  value={d.managerName || ''} 
                  disabled={!permissions.update}
                  onChange={e => updateDeptField(d.id, 'managerName', e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Shield size={10}/> 核心权力与职责</label>
                 <textarea 
                  className="w-full p-3 bg-slate-900 text-slate-100 border-none rounded-2xl text-xs font-bold outline-none h-32 shadow-inner disabled:opacity-50" 
                  placeholder="详细描述该部门拥有的业务权力、资源分配权及核心交付职责..." 
                  value={d.responsibilities || ''} 
                  disabled={!permissions.update}
                  onChange={e => updateDeptField(d.id, 'responsibilities', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Info size={10}/> 职能属性描述</label>
                 <textarea 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none h-24 disabled:opacity-50" 
                  placeholder="部门属性、职能边界..." 
                  value={d.attributes || ''} 
                  disabled={!permissions.update}
                  onChange={e => updateDeptField(d.id, 'attributes', e.target.value)}
                />
              </div>
            </div>
          )}

          {addingToId === d.id && (
            <div className="mb-4 flex gap-2 animate-in slide-in-from-top-2">
              <input autoFocus className="flex-1 p-2 bg-slate-50 border rounded-xl text-xs font-bold outline-none border-brand-200" placeholder="子部门名称..." value={newSubDeptName} onChange={e => setNewSubDeptName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubDepartment(d.id)} />
              <button onClick={() => addSubDepartment(d.id)} className="bg-brand-600 text-white p-2 rounded-xl"><Check size={16}/></button>
              <button onClick={() => setAddingToId(null)} className="bg-slate-200 text-slate-600 p-2 rounded-xl"><X size={16}/></button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-2">
            {d.roles.map(r => {
              const memberCount = d.roleMembers?.[r]?.length || 0;
              return (
                <div key={r} onClick={() => setAssigningRole({deptId: d.id, roleName: r})} className="px-3 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-2 bg-slate-50 hover:border-brand-300 transition-all group cursor-pointer">
                  <Briefcase size={10} className="text-brand-500"/>
                  {r}
                  <span className="bg-brand-500 text-white px-1.5 py-0.5 rounded-full text-[8px] font-black">{memberCount}</span>
                  {permissions.update && (
                    <button onClick={(e) => { e.stopPropagation(); setPendingDeleteRole({deptId: d.id, roleName: r}); }} className="ml-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Minus size={10}/></button>
                  )}
                </div>
              );
            })}
          </div>

          {selectedDeptId === d.id && (
            <div className="mt-4 p-5 bg-slate-50 rounded-[2rem] animate-in fade-in border border-dashed border-slate-200">
              <div className="mb-4">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">复用系统现有岗位</label>
                 <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                    {globalRoles.filter(gr => !d.roles.includes(gr)).map(gr => (
                      <button key={gr} disabled={!permissions.update} onClick={() => addRoleToDept(d.id, gr)} className="px-2 py-1 bg-white border border-slate-100 rounded-lg text-[9px] font-bold hover:border-brand-500 transition-colors disabled:opacity-50">{gr}</button>
                    ))}
                 </div>
              </div>
              <div className="flex gap-2">
                <input className="flex-1 p-3 bg-white border rounded-xl text-xs font-bold outline-none focus:border-brand-500 shadow-inner disabled:opacity-50" placeholder="新增岗位名称..." value={newRoleName} disabled={!permissions.update} onChange={e=>setNewRoleName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRoleToDept(d.id, newRoleName)}/>
                <button onClick={() => addRoleToDept(d.id, newRoleName)} disabled={!permissions.update} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase disabled:opacity-50">添加新岗位</button>
              </div>
            </div>
          )}
        </div>
        
        {/* Render Children */}
        {d.subDepartments && d.subDepartments.length > 0 && (
          <div className="ml-8 pl-8 border-l-2 border-slate-200 mt-8 space-y-8 relative">
             {d.subDepartments.map((sub, idx) => renderDeptCard(sub, depth + 1, idx === d.subDepartments.length - 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6 overflow-hidden p-4 md:p-6 bg-slate-50 relative">
      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div><h2 className="text-xl font-black text-slate-800">组织资产架构</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Departments, Roles & Responsibilities</p></div>
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center w-full md:w-auto">
           <div className="relative w-full md:w-auto"><input className="pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-brand-500 w-full md:w-64 shadow-inner" placeholder="搜索部门..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/><Search size={14} className="absolute left-4 top-3.5 text-slate-300"/></div>
           <div className="flex gap-2 w-full md:w-auto">
             <button onClick={() => setShowAddRootModal(true)} className="flex-1 md:flex-none justify-center bg-brand-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-brand-700 transition-all flex items-center gap-2 shadow-lg shadow-brand-100"><Plus size={16}/> 创建根部门</button>
             <button onClick={handleSave} disabled={isSaving || backendError} className={`flex-1 md:flex-none justify-center px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${showSaveSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} ${backendError ? 'opacity-50 cursor-not-allowed' : ''}`}>
               {showSaveSuccess ? <CheckCircle size={14}/> : (backendError ? <WifiOff size={14}/> : <Save size={14} />)} 存档架构
             </button>
           </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 md:pr-4 custom-scrollbar pb-24">
        <div className="flex flex-col gap-8 items-start pl-2 md:pl-4">
          {departments.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).map((d, index, arr) => renderDeptCard(d, 0, index === arr.length - 1))}
        </div>
      </div>

      {showAddRootModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black">创建根部门</h3>
                <button onClick={() => setShowAddRootModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
             </div>
             <p className="text-xs text-slate-400 font-bold mb-6">创建一个新的顶级部门节点。创建后将自动保存。</p>
             <input autoFocus className="w-full p-4 bg-slate-50 border rounded-2xl mb-6 text-sm font-bold outline-none focus:border-brand-500" placeholder="部门名称..." value={newRootDeptName} onChange={e => setNewRootDeptName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRootDepartment()} />
             <button onClick={addRootDepartment} className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-700 transition-all">
                立即创建
             </button>
          </div>
        </div>
      )}

      {assigningRole && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center"><Users size={24}/></div>
                  <div>
                    <h3 className="text-xl font-black">{assigningRole.roleName}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">分配岗位成员 (岗位人选)</p>
                  </div>
                </div>
                <button onClick={() => setAssigningRole(null)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
             </div>
             
             <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {users.length === 0 ? (
                  <p className="text-center py-10 text-slate-300 text-xs italic">请先在“用户管理”中创建系统用户</p>
                ) : users.map(u => {
                  // Recursive helper to find department
                  const findDept = (depts: Department[], id: string): Department | undefined => {
                    for (const d of depts) {
                      if (d.id === id) return d;
                      if (d.subDepartments) {
                        const found = findDept(d.subDepartments, id);
                        if (found) return found;
                      }
                    }
                    return undefined;
                  };
                  const dept = findDept(departments, assigningRole.deptId);
                  const isAssigned = dept?.roleMembers?.[assigningRole.roleName]?.includes(u.id);
                  return (
                    <button 
                      key={u.id} 
                      onClick={() => toggleRoleMember(assigningRole.deptId, assigningRole.roleName, u.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${isAssigned ? 'bg-brand-50 border-brand-200' : 'bg-white hover:bg-slate-50 border-slate-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${isAssigned ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {u.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <p className={`text-xs font-black ${isAssigned ? 'text-brand-900' : 'text-slate-600'}`}>{u.name}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{u.username}</p>
                        </div>
                      </div>
                      {isAssigned ? <Check size={16} className="text-brand-600"/> : <Plus size={16} className="text-slate-300"/>}
                    </button>
                  );
                })}
             </div>

             <button onClick={() => setAssigningRole(null)} className="w-full mt-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-600 transition-all">
                完成分配 (需存档生效)
             </button>
          </div>
        </div>
      )}

      {pendingDeleteRole && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl text-center animate-in zoom-in-95">
             <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={32}/></div>
             <h3 className="text-xl font-black mb-2 text-slate-800">移除岗位 [{pendingDeleteRole.roleName}]？</h3>
             <p className="text-xs text-slate-400 font-bold mb-8">移除后该岗位的成员分配也将失效。</p>
             <div className="flex gap-3">
                <button onClick={() => setPendingDeleteRole(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase">取消</button>
                <button onClick={performDeleteRole} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-red-200">确认移除</button>
             </div>
          </div>
        </div>
      )}

      {pendingDeleteDept && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl text-center animate-in zoom-in-95">
             <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={32}/></div>
             <h3 className="text-xl font-black mb-2 text-slate-800">删除部门 [{pendingDeleteDept.name}]？</h3>
             <p className="text-xs text-slate-400 font-bold mb-8">此操作将移除该部门及其下属所有组织单元，不可恢复。</p>
             <div className="flex gap-3">
                <button onClick={() => setPendingDeleteDept(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase">取消</button>
                <button onClick={performDeleteDept} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-red-200">确认删除</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgView;
