
import React, { useState, useMemo } from 'react';
import { AppState, User, Department, MenuPermission } from '../types';
import { 
  Plus, Trash2, ShieldCheck, User as UserIcon, Key, 
  Building2, EyeOff, Save, WifiOff, CheckCircle, Lock, Unlock, RotateCcw, AlertTriangle, UserMinus,
  Loader2, Upload, FileText, X, AlertCircle, Check, Shield
} from 'lucide-react';

interface UserViewProps {
  state: AppState;
  setUsers: (users: User[]) => void;
  currentUser: User;
  setCurrentUser: (u: User) => void;
  handleSave: () => void;
  isSaving: boolean;
  showSaveSuccess: boolean;
  backendError: boolean;
  permissions: MenuPermission;
}

const UserView: React.FC<UserViewProps> = ({ 
  state, setUsers, currentUser, setCurrentUser,
  handleSave, isSaving, showSaveSuccess, backendError,
  permissions
}) => {
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'User'>('User');
  const [newDeptId, setNewDeptId] = useState('');
  
  // Custom Confirmation Modals
  const [pendingDeleteUser, setPendingDeleteUser] = useState<User | null>(null);
  const [pendingResetUser, setPendingResetUser] = useState<User | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{success: number, errors: string[]} | null>(null);

  const roles = state.systemRoles || [];

  const flatDepts = useMemo(() => {
    const list: Department[] = [];
    const collect = (depts: Department[]) => {
      depts.forEach(d => {
        list.push(d);
        if (d.subDepartments) collect(d.subDepartments);
      });
    };
    collect(state.departments);
    return list;
  }, [state.departments]);

  if (!permissions.view) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center bg-white p-12 rounded-[3rem] border shadow-sm">
          <Lock size={64} className="mx-auto text-slate-200 mb-6"/>
          <h2 className="text-xl font-black text-slate-800">权限不足</h2>
          <p className="text-slate-400 text-sm mt-2">您没有访问用户管理中心的权限。</p>
        </div>
      </div>
    );
  }

  const addUser = () => {
    if (!newUsername.trim() || !newName.trim()) {
      setAlertMessage('请填写完整的用户信息 (姓名和账号为必填项)');
      setShowAlert(true);
      return;
    }
    const exists = state.users.find(u => u.username === newUsername);
    if (exists) {
      setAlertMessage('该账号已存在，请使用其他账号');
      setShowAlert(true);
      return;
    }
    const newUser: User = { 
      id: `user-${Date.now()}`, 
      username: newUsername, 
      password: '888888', 
      name: newName, 
      role: newRole,
      departmentId: newDeptId || undefined,
      padPermissions: [] 
    };
    // App.tsx handleSetUsers wrapper handles auto-save
    setUsers([...state.users, newUser]);
    setNewName(''); setNewUsername(''); setNewDeptId('');
    setAlertMessage('用户创建成功！');
    setShowAlert(true);
  };

  const togglePadPermission = (userId: string, deptId: string) => {
    setUsers(state.users.map(u => {
      if (u.id !== userId) return u;
      const currentPerms = u.padPermissions || [];
      const newPerms = currentPerms.includes(deptId) 
        ? currentPerms.filter(id => id !== deptId)
        : [...currentPerms, deptId];
      return { ...u, padPermissions: newPerms };
    }));
  };

  const performResetPassword = () => {
    if (!pendingResetUser) return;
    setUsers(state.users.map(u => u.id === pendingResetUser.id ? { ...u, password: '888888' } : u));
    setPendingResetUser(null);
  };

  const performDeleteUser = () => {
    if (!pendingDeleteUser) return;
    setUsers(state.users.filter(u => u.id !== pendingDeleteUser.id));
    setPendingDeleteUser(null);
  };

  const toggleUserRole = (userId: string) => {
    setUsers(state.users.map(u => {
      if (u.id !== userId) return u;
      const newRole = u.role === 'Admin' ? 'User' : 'Admin';
      return { ...u, role: newRole as 'Admin' | 'User' };
    }));
  };

  const handleImportUsers = () => {
    if (!importText.trim()) return;
    
    const lines = importText.split('\n').filter(l => l.trim());
    const errors: string[] = [];
    let successCount = 0;

    // Create a map for quick lookup and update of existing users
    const userMap = new Map<string, User>();
    state.users.forEach(u => userMap.set(u.username, u));

    lines.forEach(line => {
      // Split by comma, Chinese comma, or tab
      const parts = line.split(/[,，\t]+/).map(s => s.trim());
      if (parts.length < 2) return; // Skip invalid lines

      const [uid, uname, deptName] = parts;
      
      let deptId: string | undefined = undefined;
      if (deptName) {
        const dept = flatDepts.find(d => d.name === deptName);
        if (dept) {
          deptId = dept.id;
        } else {
          errors.push(`用户 [${uname}] 的部门 "${deptName}" 未找到，请在列表手动设置。`);
        }
      }

      const existing = userMap.get(uid);
      if (existing) {
        // Update existing user
        userMap.set(uid, { 
          ...existing, 
          name: uname, 
          // If a deptName was provided but invalid (deptId is undefined), we set it to undefined (unassigned) 
          // so the user notices they need to fix it. If no deptName provided, keep existing.
          departmentId: deptName ? deptId : existing.departmentId 
        });
      } else {
        // Create new user
        userMap.set(uid, {
          id: `imp-${uid}-${Date.now()}`,
          username: uid,
          name: uname,
          password: '888888', // Default password
          role: 'User',
          departmentId: deptId,
          padPermissions: []
        });
      }
      successCount++;
    });

    setUsers(Array.from(userMap.values()));
    setImportResult({ success: successCount, errors });
    
    // Clear text if no errors, otherwise keep it for reference? 
    // Actually better to clear it so they see the results clearly.
    setImportText(''); 
  };

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6 p-4 md:p-6 bg-slate-50 relative overflow-hidden">
      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-4">
        <div><h2 className="text-xl font-black text-slate-800">治理权限中心</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Global User Management</p></div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
          {permissions.create && (
            <button onClick={() => setShowImportModal(true)} className="justify-center px-4 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all">
              <Upload size={14}/> 批量导入
            </button>
          )}
          <div className="hidden md:block w-px h-6 bg-slate-200 mx-2"></div>
          {permissions.update && (
            <button 
              onClick={handleSave} 
              disabled={isSaving || backendError}
              className={`justify-center px-6 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-lg ${showSaveSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-900 text-white hover:bg-brand-600'} ${backendError ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSaving ? <Loader2 className="animate-spin" size={14}/> : showSaveSuccess ? <CheckCircle size={14}/> : (backendError ? <WifiOff size={14}/> : <Save size={14} />)} 
              {showSaveSuccess ? '保存成功' : '保存用户修改'}
            </button>
          )}
        </div>
      </div>

      {permissions.create && (
        <div className="bg-brand-50 p-4 md:p-8 rounded-[2.5rem] border border-brand-100 flex flex-col md:flex-row flex-wrap gap-4 items-stretch md:items-end animate-in fade-in slide-in-from-top-4 shrink-0 shadow-inner">
          <div className="flex-1 min-w-[140px] space-y-2"><label className="text-[10px] font-black uppercase text-brand-600 tracking-widest">姓名</label><input className="w-full px-4 py-3 bg-white border border-brand-200 rounded-2xl text-sm font-bold outline-none" placeholder="真实姓名" value={newName} onChange={e => setNewName(e.target.value)}/></div>
          <div className="flex-1 min-w-[140px] space-y-2"><label className="text-[10px] font-black uppercase text-brand-600 tracking-widest">账号</label><input className="w-full px-4 py-3 bg-white border border-brand-200 rounded-2xl text-sm font-bold outline-none" placeholder="登录用户名" value={newUsername} onChange={e => setNewUsername(e.target.value)}/></div>
          <div className="flex-1 min-w-[140px] space-y-2">
            <label className="text-[10px] font-black uppercase text-brand-600 tracking-widest">归属部门</label>
            <select className="w-full px-4 py-3 bg-white border border-brand-200 rounded-2xl text-sm font-bold outline-none" value={newDeptId} onChange={e => setNewDeptId(e.target.value)}>
              <option value="">未分配部门</option>
              {flatDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="w-full md:w-40 space-y-2"><label className="text-[10px] font-black uppercase text-brand-600 tracking-widest">系统角色</label><select className="w-full px-4 py-3 bg-white border border-brand-200 rounded-2xl text-sm font-bold outline-none" value={newRole} onChange={e => setNewRole(e.target.value as any)}><option value="User">普通成员</option><option value="Admin">管理员</option></select></div>
          <button onClick={addUser} className="w-full md:w-auto justify-center bg-brand-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all flex items-center gap-2"><Plus size={16}/> 创建用户</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-20">
        <div className="grid grid-cols-1 gap-6">
          {state.users.map(u => {
            const dept = flatDepts.find(d => d.id === u.departmentId);
            return (
              <div key={u.id} className="bg-white p-4 md:p-8 rounded-[3rem] border-2 shadow-sm border-slate-100 flex flex-col md:flex-row gap-6 md:gap-10">
                <div className="w-full md:w-80 flex flex-col gap-4 border-b md:border-b-0 md:border-r pb-6 md:pb-0 pr-0 md:pr-10">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${u.role === 'Admin' ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-slate-400'}`}>{u.role === 'Admin' ? <ShieldCheck size={28}/> : <UserIcon size={28}/>}</div>
                    <div><h4 className="font-black text-xl text-slate-800">{u.name}</h4><p className="text-[10px] font-black text-slate-400 uppercase">账号: {u.username}</p></div>
                  </div>
                  <div className="space-y-2 mt-4">
                     <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase"><Building2 size={12}/> {dept?.name || <span className="text-red-400">未分配部门 (请设置)</span>}</div>
                     {u.departmentId && !dept && <p className="text-[9px] text-red-500 font-bold bg-red-50 p-2 rounded-lg">原部门已删除或无效</p>}
                     <div className="flex gap-2">
                       <select 
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] p-1 font-bold outline-none"
                          value={u.departmentId || ''}
                          onChange={(e) => setUsers(state.users.map(us => us.id === u.id ? { ...us, departmentId: e.target.value } : us))}
                       >
                          <option value="">重新分配部门...</option>
                          {flatDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                       </select>
                     </div>
                     <button 
                       disabled={!permissions.update}
                       onClick={() => u.id !== currentUser.id && toggleUserRole(u.id)} 
                       className={`w-full mt-2 flex items-center gap-2 text-[10px] font-black uppercase px-2 py-2 rounded transition-colors ${u.role === 'Admin' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400 hover:bg-brand-50 hover:text-brand-600'} ${!permissions.update ? 'opacity-50 cursor-not-allowed' : ''}`}
                     >
                       <ShieldCheck size={12}/> 系统角色: {u.role}
                     </button>
                     
                     {/* System Roles Assignment */}
                     <div className="mt-4 space-y-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                         <Shield size={10}/> 权限角色分配
                       </label>
                       <div className="flex flex-wrap gap-1">
                         {roles.map(role => {
                           const isSelected = u.systemRoleIds?.includes(role.id);
                           return (
                             <button
                               key={role.id}
                               disabled={!permissions.update}
                               onClick={() => {
                                 const currentIds = u.systemRoleIds || [];
                                 const newIds = isSelected 
                                   ? currentIds.filter(id => id !== role.id)
                                   : [...currentIds, role.id];
                                 setUsers(state.users.map(us => us.id === u.id ? { ...us, systemRoleIds: newIds } : us));
                               }}
                               className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${isSelected ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-brand-300'} ${!permissions.update ? 'opacity-50 cursor-not-allowed' : ''}`}
                             >
                               {role.name}
                             </button>
                           );
                         })}
                         {roles.length === 0 && <span className="text-[9px] text-slate-300 italic">暂无角色</span>}
                       </div>
                     </div>
                  </div>
                  {u.id !== currentUser.id && permissions.update && (
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <button onClick={() => setPendingResetUser(u)} className="flex-1 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><RotateCcw size={14}/> 重置密码</button>
                      <button onClick={() => setPendingDeleteUser(u)} className="p-2 text-red-200 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4 flex items-center gap-2">
                    <Unlock size={14} className="text-brand-500"/> PAD 治理可见性配置 (部门可见权)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {flatDepts.map(d => {
                      const hasPerm = u.padPermissions?.includes(d.id);
                      return (
                        <button 
                          key={d.id} 
                          disabled={!permissions.update}
                          onClick={() => togglePadPermission(u.id, d.id)}
                          className={`px-4 py-3 rounded-2xl border text-left flex items-center justify-between transition-all ${hasPerm ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-inner' : 'bg-slate-50 border-transparent text-slate-400'} ${!permissions.update ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="text-[11px] font-black truncate max-w-[100px]">{d.name}</span>
                          {hasPerm ? <CheckCircle size={14} className="text-brand-500"/> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200"/>}
                        </button>
                      );
                    })}
                  </div>
                  {flatDepts.length === 0 && <p className="text-xs text-slate-300 italic">请先在组织架构中添加部门</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation: User Deletion */}
      {pendingDeleteUser && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl text-center animate-in zoom-in-95">
             <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><UserMinus size={32}/></div>
             <h3 className="text-xl font-black mb-2 text-slate-800">移除用户 [{pendingDeleteUser.name}]？</h3>
             <p className="text-xs text-slate-400 font-bold mb-8">该用户将无法再次登录，所有权限将注销。</p>
             <div className="flex gap-3">
                <button onClick={() => setPendingDeleteUser(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase">取消</button>
                <button onClick={performDeleteUser} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-xs uppercase">确认注销</button>
             </div>
          </div>
        </div>
      )}

      {/* Confirmation: Password Reset */}
      {pendingResetUser && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl text-center animate-in zoom-in-95">
             <div className="w-16 h-16 bg-slate-100 text-slate-900 rounded-full flex items-center justify-center mx-auto mb-6"><Key size={32}/></div>
             <h3 className="text-xl font-black mb-2 text-slate-800">重置用户密码？</h3>
             <p className="text-xs text-slate-400 font-bold mb-8">重置后密码将统一设为 <code className="bg-slate-100 px-1 rounded text-brand-600">888888</code></p>
             <div className="flex gap-3">
                <button onClick={() => setPendingResetUser(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase">取消</button>
                <button onClick={performResetPassword} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase">确认重置</button>
             </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black flex items-center gap-3"><FileText className="text-brand-600"/> 批量导入用户</h3>
                <button onClick={() => { setShowImportModal(false); setImportResult(null); }} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
             </div>
             
             {!importResult ? (
               <>
                 <div className="bg-slate-50 p-4 rounded-2xl mb-6 text-xs text-slate-500 font-medium leading-relaxed border border-slate-100">
                    <p className="font-black text-slate-700 mb-1">📝 导入格式说明</p>
                    每一行代表一个用户，字段之间使用逗号分隔 (支持中英文逗号)。<br/>
                    格式：<code className="bg-white border px-1 rounded text-brand-600">用户编号, 用户姓名, 部门名称</code><br/>
                    示例：<code className="bg-white border px-1 rounded text-brand-600">1001, 张三, 人力资源部</code><br/>
                    <span className="text-amber-600 mt-1 block font-bold">* 如果部门名称匹配失败，该用户将被设为无部门状态，请稍后手动修正。如果用户编号已存在，将更新该用户信息。</span>
                 </div>
                 <textarea 
                    className="flex-1 w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-brand-500 focus:bg-white resize-none shadow-inner custom-scrollbar"
                    placeholder={`1001, 张三, 财务部\n1002, 李四, 技术部`}
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                 />
                 <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setShowImportModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50">取消</button>
                    <button onClick={handleImportUsers} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-brand-700 transition-all flex items-center gap-2">
                       <Upload size={16}/> 开始解析导入
                    </button>
                 </div>
               </>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                    <Check size={40}/>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800">导入处理完成</h3>
                  <p className="text-slate-500 mt-2 font-bold">成功处理 <span className="text-emerald-600">{importResult.success}</span> 条用户数据</p>
                  
                  {importResult.errors.length > 0 && (
                    <div className="w-full mt-8 bg-red-50 border border-red-100 rounded-2xl p-6 text-left">
                       <h4 className="text-red-600 font-black text-xs uppercase flex items-center gap-2 mb-3"><AlertCircle size={14}/> 部分部门匹配失败 (请手动修正)</h4>
                       <ul className="text-[10px] font-bold text-red-500 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                         {importResult.errors.map((err, i) => <li key={i}>• {err}</li>)}
                       </ul>
                    </div>
                  )}

                  <button onClick={() => { setShowImportModal(false); setImportResult(null); }} className="mt-8 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase shadow-xl hover:scale-105 transition-all">
                    完成并关闭
                  </button>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {showAlert && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl text-center animate-in zoom-in-95">
             <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={32}/></div>
             <h3 className="text-xl font-black mb-2 text-slate-800">提示</h3>
             <p className="text-xs text-slate-400 font-bold mb-8">{alertMessage}</p>
             <button onClick={() => setShowAlert(false)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase shadow-lg">
               我知道了
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserView;
