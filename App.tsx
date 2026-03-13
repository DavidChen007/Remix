import React, { useState, useEffect, useCallback } from 'react';
import ProcessView from './components/ProcessView';
import OrgView from './components/OrgView';
import StrategyView from './components/StrategyView';
import BusinessDefinitionView from './components/BusinessDefinitionView';
import WeeklyView from './components/WeeklyView';
import UserView from './components/UserView';
import RoleQueryView from './components/RoleQueryView';
import TaskCenterView from './components/TaskCenterView';
import WorkbenchView from './components/WorkbenchView';
import ExecutionView from './components/ExecutionView';
import ReviewView from './components/ReviewView';
import OkrReviewDashboard from './components/OkrReviewDashboard';
import MenuPermissionView from './components/MenuPermissionView';
import { AppState, ProcessDefinition, Department, CompanyStrategy, Enterprise, ProcessHistory, User, WeeklyPAD, SystemRole } from './types';
import { getEnterprises, saveEnterprise, getWorkspace, saveWorkspace } from './data';
import { hasPermission } from './utils/permissions';
import { MENU_GROUPS } from './constants';
import { 
  GitGraph, Users, Target, Building2, Lock, Plus, Calendar, Globe,
  LogOut, ChevronRight, Save, ShieldCheck, UserCog, Building, UserCircle, ClipboardCheck, CheckCircle, WifiOff, RefreshCw, Settings, X, Key, Info, SearchCode, UserSearch, Loader2 as Spinner, AlertCircle, LayoutList, LayoutDashboard, LayoutGrid, Menu
} from 'lucide-react';

const App: React.FC = () => {
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTabState] = useState<'workbench' | 'process' | 'okr' | 'execution' | 'weekly' | 'review' | 'okr-review' | 'task-center' | 'org' | 'user' | 'roles' | 'menu-permissions'>('workbench');
  const [reviewParams, setReviewParams] = useState<{tab: 'weekly'|'monthly', deptId: string, period?: string} | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const setActiveTab = (tab: typeof activeTab) => {
    if (isDirty) {
      setPendingTab(tab);
      setShowUnsavedModal(true);
    } else {
      setActiveTabState(tab);
      setIsSidebarCollapsed(true); // Auto-collapse on navigation
    }
  };

  const navigateToReview = (tab: 'weekly' | 'monthly', deptId: string, period?: string) => {
    setReviewParams({ tab, deptId, period });
    setActiveTab('review');
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  
  const [authenticatedEnt, setAuthenticatedEnt] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showRegSuccess, setShowRegSuccess] = useState<Enterprise | null>(null);
  const [backendError, setBackendError] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  
  const [entId, setEntId] = useState('');
  const [entDisplayName, setEntDisplayName] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);

  // User Profile Settings State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [pendingProcessId, setPendingProcessId] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const [state, setState] = useState<AppState>({
    processes: [],
    departments: [],
    strategy: { mission: '', vision: '', customerIssues: '', employeeIssues: '', companyOKRs: {} },
    users: [],
    weeklyPADs: []
  });

  const checkConnectivity = useCallback(async () => {
    setIsConnecting(true);
    try {
      const data = await getEnterprises();
      setEnterprises(data);
      setBackendError(false);
    } catch (e) {
      setBackendError(true);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    checkConnectivity();
    // Check for existing session
    const session = localStorage.getItem('stratflow_session');
    if (session) {
      try {
        const { entId: savedEntId, username: savedUsername } = JSON.parse(session);
        if (savedEntId && savedUsername) {
          loadWorkspace(savedEntId).then(workspace => {
            if (workspace) {
              const user = workspace.users.find(u => u.username === savedUsername);
              if (user) {
                setAuthenticatedEnt(savedEntId);
                setCurrentUser(user);
              }
            }
          });
        }
      } catch (e) {
        console.error("Session restore failed", e);
        localStorage.removeItem('stratflow_session');
      }
    }
  }, [checkConnectivity]);

  const loadWorkspace = useCallback(async (enterpriseId: string) => {
    try {
      const savedData = await getWorkspace(enterpriseId);
      if (savedData) {
        const merged = {
          ...savedData,
          processes: savedData.processes || [],
          departments: savedData.departments || [],
          strategy: {
            mission: savedData.strategy?.mission || '',
            vision: savedData.strategy?.vision || '',
            customerIssues: savedData.strategy?.customerIssues || '',
            employeeIssues: savedData.strategy?.employeeIssues || '',
            companyOKRs: savedData.strategy?.companyOKRs || {}
          },
          weeklyPADs: savedData.weeklyPADs || [],
          users: (savedData.users && savedData.users.length > 0) ? savedData.users : [
            { id: 'admin', username: 'admin', password: '888888', name: '系统管理员', role: 'Admin' } as User
          ]
        };
        setState(merged);
        return merged;
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);

  const stateRef = React.useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleSave = useCallback(async () => {
    if (!authenticatedEnt) return;
    setIsSaving(true);
    try {
      await saveWorkspace(authenticatedEnt, stateRef.current);
      setIsSaving(false);
      setIsDirty(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } catch (error) {
      setIsSaving(false);
      setBackendError(true);
    }
  }, [authenticatedEnt]);

  const handleSaveWrapper = async () => {
    await handleSave();
    setIsDirty(false);
  };

  // Wrapper for state updates that require immediate save (Auto-Save)
  const saveStateDirectly = async (newState: AppState) => {
    if (!authenticatedEnt) return;
    setIsSaving(true);
    try {
      await saveWorkspace(authenticatedEnt, newState);
      setIsSaving(false);
      setIsDirty(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } catch (error) {
      setIsSaving(false);
      setBackendError(true);
    }
  };

  // Removed debounced auto-save to reduce database consumption as requested
  // useEffect(() => {
  //   if (!isDirty || !authenticatedEnt) return;
  //   const timer = setTimeout(() => {
  //     handleSave();
  //     setIsDirty(false);
  //   }, 3000); // Auto-save after 3s of inactivity
  //   return () => clearTimeout(timer);
  // }, [isDirty, authenticatedEnt, handleSave]);

  const handleSetDepartments = (newDepts: Department[]) => {
    const newState = { ...state, departments: newDepts };
    setState(newState);
    setIsDirty(true);
  };

  const handleSetUsers = (newUsers: User[]) => {
    const newState = { ...state, users: newUsers };
    setState(newState);
    setIsDirty(true);
    
    // Sync current user if they were updated
    if (currentUser) {
      const updatedSelf = newUsers.find(u => u.id === currentUser.id);
      if (updatedSelf) {
        setCurrentUser(updatedSelf);
      }
    }
  };

  const handleSetSystemRoles = (newRoles: SystemRole[]) => {
    const newState = { ...state, systemRoles: newRoles };
    setState(newState);
    setIsDirty(true);
  };

  const setProcessData = (id: string, nodes: any[], links: any[]) => {
    setState(prev => ({
      ...prev,
      processes: prev.processes.map(p => p.id === id ? { ...p, nodes, links, updatedAt: Date.now() } : p)
    }));
  };

  const updateProcessProps = (id: string, props: Partial<ProcessDefinition>) => {
    setState(prev => ({
      ...prev,
      processes: prev.processes.map(p => p.id === id ? { ...p, ...props, updatedAt: Date.now() } : p)
    }));
  };

  const addProcess = (category: any, level: 1 | 2, name: string) => {
    const newProcess: ProcessDefinition = {
      id: `proc-${Date.now()}`, name, category, level, version: 'Draft', isActive: false, type: category === '辅助体系' ? 'auxiliary' : 'main',
      owner: '', coOwner: '', objective: '', nodes: [], links: [], history: [], updatedAt: Date.now()
    };
    setState(prev => ({ ...prev, processes: [...prev.processes, newProcess] }));
    setCurrentProcessId(newProcess.id);
    setActiveTab('process');
  };

  const deleteProcess = (id: string) => {
    setState(prev => ({ ...prev, processes: prev.processes.filter(p => p.id !== id) }));
  };

  const publishProcess = (id: string, version: string) => {
    const newState = {
      ...state,
      processes: state.processes.map(p => {
        if (p.id !== id) return p;
        const newRecord: ProcessHistory = { id: `hist-${Date.now()}`, version, nodes: JSON.parse(JSON.stringify(p.nodes)), links: JSON.parse(JSON.stringify(p.links)), publishedAt: Date.now(), publishedBy: currentUser?.name || 'System' };
        return { ...p, version, isActive: true, history: [newRecord, ...p.history] };
      })
    };
    setState(newState);
    setIsDirty(true);
  };

  const rollbackProcess = (procId: string, historyId: string) => {
    setState(prev => ({
      ...prev,
      processes: prev.processes.map(p => {
        if (p.id !== procId) return p;
        const record = p.history.find(h => h.id === historyId);
        if (!record) return p;
        return { ...p, nodes: JSON.parse(JSON.stringify(record.nodes)), links: JSON.parse(JSON.stringify(record.links)), updatedAt: Date.now() };
      })
    }));
  };

  const handleSetWeeklyPADs = (newWeeklyPADs: WeeklyPAD[]) => {
    const newState = { ...state, weeklyPADs: newWeeklyPADs };
    setState(newState);
    setIsDirty(true);
  };

  const handleSetStrategy = (strategyPartial: Partial<CompanyStrategy>) => {
    const newState = { ...state, strategy: { ...state.strategy, ...strategyPartial } };
    setState(newState);
    setIsDirty(true);
  };

  const confirmTabChange = (saveFirst: boolean) => {
    if (saveFirst) {
      handleSave().then(() => {
        if (pendingTab) {
          if (pendingTab === 'process' && pendingProcessId) {
            setCurrentProcessId(pendingProcessId);
          }
          setActiveTabState(pendingTab as any);
          setIsSidebarCollapsed(true);
        }
        setShowUnsavedModal(false);
        setPendingTab(null);
        setPendingProcessId(null);
        setIsDirty(false);
      });
    } else {
      setIsDirty(false);
      if (pendingTab) {
        if (pendingTab === 'process' && pendingProcessId) {
          setCurrentProcessId(pendingProcessId);
        }
        setActiveTabState(pendingTab as any);
        setIsSidebarCollapsed(true);
      }
      setShowUnsavedModal(false);
      setPendingTab(null);
      setPendingProcessId(null);
    }
  };

  const navigateToProcess = (procId: string) => {
    if (isDirty) {
      setPendingTab('process');
      setPendingProcessId(procId);
      setShowUnsavedModal(true);
    } else {
      setCurrentProcessId(procId);
      setActiveTab('process');
    }
  };

  const handleCreateEnterprise = async () => {
    if (!entId.trim() || !entDisplayName.trim()) return;
    const exists = enterprises.find(e => e.name === entId);
    if (exists) {
      alert("企业 ID 已存在，请使用其他 ID");
      return;
    }
    
    try {
      const newEnt: Enterprise = { name: entId, displayName: entDisplayName, password: 'root' };
      await saveEnterprise(newEnt);
      const initialState: AppState = {
        processes: [], departments: [],
        strategy: { mission: '', vision: '', customerIssues: '', employeeIssues: '', companyOKRs: {} },
        users: [{ id: 'admin', username: 'admin', password: '888888', name: '系统管理员', role: 'Admin' }],
        weeklyPADs: []
      };
      await saveWorkspace(entId, initialState);
      const updatedEnts = await getEnterprises();
      setEnterprises(updatedEnts);
      setShowRegSuccess(newEnt);
    } catch (e) {
      setBackendError(true);
    }
  };

  const proceedToAppAfterReg = async () => {
    if (!showRegSuccess) return;
    const entName = showRegSuccess.name;
    const workspace = await loadWorkspace(entName);
    if (workspace) {
      setAuthenticatedEnt(entName);
      const user = workspace.users[0];
      setCurrentUser(user);
      localStorage.setItem('stratflow_session', JSON.stringify({ entId: entName, username: user.username }));
    }
    setShowRegSuccess(null);
    setIsRegistering(false);
  };

  const handleLogin = async () => {
    if (!entId.trim() || !loginUsername.trim() || !loginPassword.trim()) return;
    const workspace = await loadWorkspace(entId);
    if (workspace) {
      const user = workspace.users.find(u => u.username === loginUsername && u.password === loginPassword);
      if (user) {
        setAuthenticatedEnt(entId);
        setCurrentUser(user);
        localStorage.setItem('stratflow_session', JSON.stringify({ entId, username: user.username }));
      } else {
        alert("登录失败：用户名或密码错误");
      }
    } else {
      alert("登录失败：找不到该企业 ID");
    }
  };

  const handleLogout = () => {
    setAuthenticatedEnt(null);
    setCurrentUser(null);
    localStorage.removeItem('stratflow_session');
  };

  const handleUpdateProfile = async () => {
    if (!profileName.trim()) return;
    if (!currentUser || !authenticatedEnt) return;
    
    const updatedUsers = state.users.map(u => u.id === currentUser.id ? { 
      ...u, 
      name: profileName, 
      password: (profilePassword && profilePassword.trim() !== '') ? profilePassword : u.password 
    } : u);
    
    const newState = { ...state, users: updatedUsers };
    
    try {
      setIsSaving(true);
      await saveWorkspace(authenticatedEnt, newState);
      setState(newState);
      setCurrentUser(updatedUsers.find(u => u.id === currentUser.id)!);
      setProfileUpdateSuccess(true);
      setIsSaving(false);
      setTimeout(() => {
        setProfileUpdateSuccess(false);
        setShowProfileModal(false);
      }, 1500);
    } catch (err) {
      setIsSaving(false);
      setBackendError(true);
    }
  };

  const getPermissions = (menuId: string) => {
    if (!currentUser) return { view: false, create: false, update: false };
    return {
      view: hasPermission(currentUser, state.systemRoles || [], menuId, 'view'),
      create: hasPermission(currentUser, state.systemRoles || [], menuId, 'create'),
      update: hasPermission(currentUser, state.systemRoles || [], menuId, 'update'),
    };
  };

  const openProfileSettings = () => {
    setProfileName(currentUser?.name || '');
    setProfilePassword(currentUser?.password || '');
    setShowProfileModal(true);
  };

  if (!authenticatedEnt || !currentUser) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-6 relative">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-10">
          {showRegSuccess ? (
            <div className="text-center animate-in zoom-in-95 duration-500">
               <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                 <CheckCircle size={40}/>
               </div>
               <h2 className="text-2xl font-black text-slate-800">空间初始化成功</h2>
               <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                 企业 <b>{showRegSuccess.displayName}</b> 已就绪。<br/>
                 <span className="text-[10px] text-slate-400 uppercase font-black block mt-2">默认管理员凭据</span>
                 账号: <code className="bg-slate-100 px-1 rounded text-brand-600 font-bold">admin</code> / 
                 密码: <code className="bg-slate-100 px-1 rounded text-brand-600 font-bold">888888</code>
               </p>
               <button 
                 onClick={proceedToAppAfterReg} 
                 className="w-full mt-8 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-600 transition-all active:scale-95"
               >
                 立即进入工作台
               </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-50 rounded-3xl mb-4"><ShieldCheck className="h-10 w-10 text-brand-600" /></div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tighter text-center">AI星组织 工作台</h1>
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
                <button 
                  onClick={() => setIsRegistering(false)} 
                  className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all ${!isRegistering ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}
                >
                  进入空间
                </button>
                <button 
                  onClick={() => setIsRegistering(true)} 
                  className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all ${isRegistering ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}
                >
                  注册企业
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl focus-within:border-brand-500 transition-all">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">企业 ID (由 4-12 位字母/数字组成)</label>
                  <input 
                    type="text" 
                    placeholder="例如: alibaba"
                    className="w-full bg-transparent text-sm font-bold outline-none text-slate-700" 
                    value={entId} 
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={e => setEntId(e.target.value)} 
                    onBlur={e => setEntId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  />
                </div>

                {isRegistering ? (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl focus-within:border-brand-500 transition-all animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">企业显示全称</label>
                    <input 
                      type="text" 
                      placeholder="例如: 阿里巴巴集团"
                      className="w-full bg-transparent text-sm font-bold outline-none text-slate-700" 
                      value={entDisplayName} 
                      onChange={e => setEntDisplayName(e.target.value)} 
                    />
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl focus-within:border-brand-500 transition-all">
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">登录账号</label>
                      <input 
                        type="text" 
                        className="w-full bg-transparent text-sm font-bold outline-none text-slate-700" 
                        value={loginUsername} 
                        onChange={e => setLoginUsername(e.target.value)} 
                      />
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl focus-within:border-brand-500 transition-all">
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">登录密码</label>
                      <input 
                        type="password"  
                        className="w-full bg-transparent text-sm font-bold outline-none text-slate-700" 
                        value={loginPassword} 
                        onChange={e => setLoginPassword(e.target.value)} 
                      />
                    </div>
                  </>
                )}

                <button 
                  onClick={isRegistering ? handleCreateEnterprise : handleLogin} 
                  className={`w-full text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-[0.98] ${isRegistering ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-900 hover:bg-brand-600'}`}
                >
                  {isRegistering ? '立即创建空间' : '验证身份并进入'}
                </button>

                {backendError && (
                  <div className="bg-red-50 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
                     <AlertCircle className="text-red-500 shrink-0" size={16}/>
                     <p className="text-[10px] text-red-500 font-bold leading-tight">Supabase 数据库连接失败，请检查环境变量配置 (VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY) 或网络连接。</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const saveProps = { handleSave, isSaving, showSaveSuccess, backendError };

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {!isSidebarCollapsed && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      <aside className={`w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 fixed md:relative z-50 h-full transition-transform duration-300 ${isSidebarCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h1 className="text-white font-black text-xl tracking-tighter flex gap-2"><ShieldCheck className="text-brand-500" /> AI星组织</h1>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsSidebarCollapsed(true)}>
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
          <div>
            <SidebarItem active={activeTab === 'workbench'} onClick={() => setActiveTab('workbench')} icon={<LayoutDashboard />} label="工作台" />
          </div>

          {MENU_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => hasPermission(currentUser, state.systemRoles || [], item.id, 'view'));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.id} className="space-y-1">
                <div className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">{group.label}</div>
                {visibleItems.map(item => {
                  let icon;
                  let onClick = () => setActiveTab(item.id as any);
                  if (item.id === 'process') { icon = <GitGraph />; onClick = () => { setActiveTab('process'); setCurrentProcessId(null); }; }
                  else if (item.id === 'org') icon = <Building2 />;
                  else if (item.id === 'roles') icon = <UserSearch />;
                  else if (item.id === 'business-definition') icon = <Globe />;
                  else if (item.id === 'okr') icon = <Target />;
                  else if (item.id === 'execution') icon = <LayoutGrid />;
                  else if (item.id === 'weekly') icon = <Calendar />;
                  else if (item.id === 'task-center') icon = <LayoutList />;
                  else if (item.id === 'okr-review') icon = <ClipboardCheck />;
                  else if (item.id === 'user') icon = <UserCog />;
                  else if (item.id === 'menu-permissions') icon = <ShieldCheck />;

                  return (
                    <SidebarItem 
                      key={item.id} 
                      active={activeTab === item.id || (item.id === 'okr-review' && activeTab === 'review')} 
                      onClick={onClick} 
                      icon={icon} 
                      label={item.label} 
                    />
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={openProfileSettings}
            className="w-full flex items-center gap-3 px-2 mb-4 hover:bg-white/5 p-2 rounded-xl transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center text-white font-black text-xs group-hover:scale-110 transition-transform">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-xs font-black text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">{currentUser.role}</p>
            </div>
            <Settings size={14} className="text-slate-600 group-hover:text-white" />
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 p-2 text-xs text-slate-500 hover:text-white transition-colors"><LogOut size={14} /> 退出空间</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative w-full">
        {/* Mobile Header */}
        <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-black text-lg">
            <ShieldCheck className="text-brand-500" /> AI星组织
          </div>
          <button onClick={() => setIsSidebarCollapsed(false)} className="p-2 -mr-2">
            <Menu size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-4 md:p-6">
          {activeTab === 'process' && (
            <ProcessView {...saveProps} permissions={getPermissions('process')} processes={state.processes} departments={state.departments} currentProcessId={currentProcessId} setCurrentProcessId={setCurrentProcessId} setProcessData={setProcessData} updateProcessProps={updateProcessProps} addProcess={addProcess} deleteProcess={deleteProcess} publishProcess={publishProcess} rollbackProcess={rollbackProcess} />
          )}
          {activeTab === 'workbench' && <WorkbenchView state={state} currentUser={currentUser} setWeeklyPADs={handleSetWeeklyPADs} setIsDirty={setIsDirty} />}
          {activeTab === 'roles' && <RoleQueryView processes={state.processes} departments={state.departments} users={state.users} />}
          {activeTab === 'org' && <OrgView {...saveProps} permissions={getPermissions('org')} processes={state.processes} departments={state.departments} setDepartments={handleSetDepartments} navigateToProcess={navigateToProcess} users={state.users} />}
          {activeTab === 'business-definition' && <BusinessDefinitionView state={state} setBusinesses={(businesses) => { setState(prev => ({ ...prev, businesses })); setIsDirty(true); }} setStrategy={handleSetStrategy} setIsDirty={setIsDirty} handleSave={handleSave} isSaving={isSaving} showSaveSuccess={showSaveSuccess} backendError={backendError} permissions={getPermissions('business-definition')} />}
          {activeTab === 'okr' && <StrategyView {...saveProps} permissions={getPermissions('okr')} state={state} currentUser={currentUser} setStrategy={handleSetStrategy} setDepartments={handleSetDepartments} setWeeklyPADs={handleSetWeeklyPADs} setIsDirty={setIsDirty} />}
          {activeTab === 'execution' && <ExecutionView state={state} currentUser={currentUser} setWeeklyPADs={handleSetWeeklyPADs} setIsDirty={setIsDirty} handleSave={handleSave} isSaving={isSaving} showSaveSuccess={showSaveSuccess} backendError={backendError} />}
          {activeTab === 'weekly' && <WeeklyView {...saveProps} permissions={getPermissions('weekly')} state={state} setWeeklyPADs={handleSetWeeklyPADs} setDepartments={handleSetDepartments} setUsers={handleSetUsers} currentUser={currentUser} setIsDirty={setIsDirty} />}
          {activeTab === 'task-center' && <TaskCenterView state={state} currentUser={currentUser} users={state.users} departments={state.departments} setWeeklyPADs={handleSetWeeklyPADs} setIsDirty={setIsDirty} />}
          {activeTab === 'okr-review' && <OkrReviewDashboard state={state} currentUser={currentUser} navigateToReview={navigateToReview} />}
          {activeTab === 'review' && <ReviewView {...saveProps} permissions={getPermissions('okr-review')} state={state} setDepartments={handleSetDepartments} setIsDirty={setIsDirty} initialTab={reviewParams?.tab} initialDeptId={reviewParams?.deptId} initialPeriod={reviewParams?.period} onBack={() => setActiveTab('okr-review')} currentUser={currentUser} />}
          {activeTab === 'user' && <UserView {...saveProps} permissions={getPermissions('user')} state={state} setUsers={handleSetUsers} currentUser={currentUser} setCurrentUser={setCurrentUser} />}
          {activeTab === 'menu-permissions' && <MenuPermissionView {...saveProps} permissions={getPermissions('menu-permissions')} state={state} setSystemRoles={handleSetSystemRoles} setUsers={handleSetUsers} currentUser={currentUser} setIsDirty={setIsDirty} />}
        </div>
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black flex items-center gap-2"><UserCircle className="text-brand-600"/> 个人账号设置</h3>
                <button onClick={() => setShowProfileModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X/></button>
             </div>
             <div className="space-y-6">
                {profileUpdateSuccess ? (
                  <div className="py-10 text-center animate-in zoom-in-95">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={32}/></div>
                    <p className="text-lg font-black text-slate-800">更新成功</p>
                    <p className="text-xs text-slate-400 font-bold uppercase mt-1">Information Synchronized</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">展示姓名</label>
                       <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" value={profileName} onChange={e => setProfileName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">新登录密码 (留空则不修改)</label>
                       <div className="relative">
                         <input type="password"  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-brand-500" value={profilePassword} onChange={e => setProfilePassword(e.target.value)} placeholder="输入新密码..." />
                         <Key className="absolute right-4 top-4 text-slate-300" size={18}/>
                       </div>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl text-[10px] font-bold text-amber-600 flex gap-2">
                      <Info size={14} className="shrink-0"/> 修改信息后系统将自动尝试同步到云端存档。
                    </div>
                    <button onClick={handleUpdateProfile} disabled={isSaving} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-600 transition-all flex items-center justify-center gap-2">
                      {isSaving ? <Spinner className="animate-spin" size={16}/> : <Save size={16}/>} 确认修改并保存
                    </button>
                  </>
                )}
             </div>
          </div>
        </div>
      )}
      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-800">未保存的更改</h3>
              <p className="text-slate-500 mt-2 text-sm font-medium">您有尚未保存的更改，离开此页面可能会导致数据丢失。是否在离开前保存？</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => confirmTabChange(true)}
                className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2"
              >
                <Save size={16} /> 保存并离开
              </button>
              <button 
                onClick={() => confirmTabChange(false)}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
              >
                不保存直接离开
              </button>
              <button 
                onClick={() => { setShowUnsavedModal(false); setPendingTab(null); setPendingProcessId(null); }}
                className="w-full py-4 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SidebarItem = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}>
    {icon && React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 18 }) : null} <span className="font-bold text-sm">{label}</span>
  </button>
);

const Check = ({ className, size }: { className?: string, size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

export default App;