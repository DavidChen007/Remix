import React, { useState, useMemo } from 'react';
import { AppState, Department, User, WeeklyPAD, PADEntry, OKR, TaskLog } from '../types';
import PeriodAlignmentView from './PeriodAlignmentView';
import TaskModal from './TaskModal';
import { Building2, ChevronDown, ChevronRight, LayoutGrid, Plus, X, Calendar, User as UserIcon, Clock, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getVisibleDepartments } from '../utils/permissions';

interface ExecutionViewProps {
  state: AppState;
  currentUser: User;
  setWeeklyPADs: (pads: WeeklyPAD[]) => void;
  setIsDirty: (dirty: boolean) => void;
  handleSave: () => void;
  isSaving: boolean;
  showSaveSuccess: boolean;
  backendError: boolean;
}

const ExecutionView: React.FC<ExecutionViewProps> = ({
  state,
  currentUser,
  setWeeklyPADs,
  setIsDirty,
  handleSave,
  isSaving,
  showSaveSuccess,
  backendError
}) => {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(currentUser.departmentId || null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Q1'); // Default to Q1, could be dynamic
  const [taskModal, setTaskModal] = useState<{ isOpen: boolean, weekId: string | null, data: Partial<PADEntry> }>({ isOpen: false, weekId: null, data: {} });

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const visibleDepartments = useMemo(() => getVisibleDepartments(currentUser, state.departments), [currentUser, state.departments]);

  const flatDepts = useMemo(() => {
    const list: Department[] = [];
    const collect = (depts: Department[]) => {
      depts.forEach(d => {
        list.push(d);
        if (d.subDepartments) collect(d.subDepartments);
      });
    };
    collect(visibleDepartments);
    return list;
  }, [visibleDepartments]);

  const groupedAvailableKRs = useMemo(() => {
    if (!taskModal.weekId) return [];
    const year = parseInt(taskModal.weekId.split('-')[0]);
    const groups: { label: string, options: { id: string, name: string }[] }[] = [];
    
    // Company OKRs
    const companyOkrs = state.strategy.companyOKRs[year] || [];
    const companyOptions: { id: string, name: string }[] = [];
    companyOkrs.forEach(o => {
      o.keyResults.forEach((kr, idx) => {
        companyOptions.push({ id: `${o.id}-kr-${idx}`, name: kr });
      });
    });
    if (companyOptions.length > 0) {
      groups.push({ label: '公司战略指标', options: companyOptions });
    }

    // Department OKRs
    flatDepts.forEach(d => {
      const deptOkrs = d.okrs?.[year] || {};
      const deptOptions: { id: string, name: string }[] = [];
      Object.entries(deptOkrs).forEach(([period, okrs]: [string, OKR[]]) => {
        okrs.forEach(o => {
          o.keyResults.forEach((kr, idx) => {
            deptOptions.push({ id: `${o.id}-kr-${idx}`, name: `${kr} (${period})` });
          });
        });
      });
      if (deptOptions.length > 0) {
        groups.push({ label: `${d.name} 指标`, options: deptOptions });
      }
    });

    return groups;
  }, [state.strategy.companyOKRs, flatDepts, taskModal.weekId]);

  const renderDeptTree = (depts: Department[], depth = 0) => {
    const handleDeptClick = (id: string) => {
      setSelectedDeptId(id);
      setIsSidebarOpen(false);
    };

    return depts.map(d => (
      <div key={d.id} className="mb-1">
        <div 
          onClick={() => handleDeptClick(d.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${selectedDeptId === d.id ? 'bg-brand-50 text-brand-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          <Building2 size={14} className={selectedDeptId === d.id ? 'text-brand-600' : 'text-slate-400'}/>
          <span className="text-xs truncate">{d.name}</span>
        </div>
        {d.subDepartments && renderDeptTree(d.subDepartments, depth + 1)}
      </div>
    ));
  };

  const handleAddTask = (weekId: string, alignedKrId: string) => {
    setTaskModal({
      isOpen: true,
      weekId,
      data: {
        id: `task-${Date.now()}`,
        title: '',
        status: 'draft',
        priority: 'medium',
        ownerId: currentUser.id,
        visibility: 'public',
        alignedKrId: alignedKrId,
        startDate: Date.now(),
        dueDate: Date.now() + 86400000,
        tags: [],
        participantIds: [],
        approverIds: []
      }
    });
  };

  const handleTaskClick = (weekId: string, task: PADEntry) => {
    const isOwner = task.ownerId === currentUser.id;
    const isParticipant = task.participantIds?.includes(currentUser.id);
    const isApprover = task.approverIds?.includes(currentUser.id);
    const owner = state.users.find(u => u.id === task.ownerId);

    let hasPermission = true;
    if (!isOwner && !isParticipant && !isApprover) {
      if (task.visibility === 'private') {
        hasPermission = false;
      } else if (task.visibility === 'department' && owner?.departmentId !== currentUser.departmentId && !currentUser.padPermissions?.includes(owner?.departmentId || '')) {
        hasPermission = false;
      } else if (task.visibility === 'members') {
        hasPermission = false;
      }
    }

    if (!hasPermission) {
      showNotification(`无任务查看权限，如果需要查看任务，请联系任务创建人【${owner?.name || ''}】`, 'info');
      return;
    }

    setTaskModal({
      isOpen: true,
      weekId,
      data: task
    });
  };

  const saveTask = (status: string = 'draft', keepOpen: boolean = false) => {
    if (!taskModal.weekId) return;

    const newTask = { ...taskModal.data, status } as PADEntry;
    const targetOwnerId = newTask.ownerId || currentUser.id;

    const isNewTask = !state.weeklyPADs.some(p => p.entries.some(e => e.id === newTask.id));

    if (!isNewTask) {
      let oldTask: PADEntry | undefined;
      state.weeklyPADs.forEach(p => {
        const found = p.entries.find(e => e.id === newTask.id);
        if (found) oldTask = found;
      });

      if (oldTask) {
        const loggableStatuses = ['submitted', 'in-progress', 'paused', 'terminated', 'completed'];
        if (loggableStatuses.includes(oldTask.status)) {
          const changes = [];
          if (oldTask.title !== newTask.title) changes.push('标题');
          if (oldTask.status !== newTask.status) changes.push(`状态(${oldTask.status}->${newTask.status})`);
          if (oldTask.priority !== newTask.priority) changes.push('优先级');
          if (oldTask.startDate !== newTask.startDate || oldTask.dueDate !== newTask.dueDate) changes.push('时间');
          if (oldTask.ownerId !== newTask.ownerId) changes.push('负责人');
          if (oldTask.visibility !== newTask.visibility) changes.push('可见性');
          
          if (changes.length > 0) {
            const log: TaskLog = {
              id: `log-${Date.now()}`,
              timestamp: Date.now(),
              userId: currentUser.id,
              action: '修改任务',
              details: `修改了: ${changes.join(', ')}`
            };
            newTask.logs = [...(oldTask.logs || []), log];
          } else {
            newTask.logs = oldTask.logs || [];
          }
        } else {
          newTask.logs = oldTask.logs || [];
        }
      }
    }

    let pads = [...state.weeklyPADs];
    
    // Remove from existing pads to handle week/owner changes
    pads = pads.map(p => ({
      ...p,
      entries: p.entries.filter(e => e.id !== newTask.id)
    })).filter(p => p.entries.length > 0);

    const entriesToAdd: PADEntry[] = [];
    
    if (isNewTask && newTask.title.includes('\n')) {
      const titles = newTask.title.split('\n').filter(t => t.trim());
      titles.forEach((t, i) => {
         entriesToAdd.push({ ...newTask, id: `task-${Date.now()}-${i}`, title: t.trim() });
      });
    } else {
      entriesToAdd.push(newTask);
    }

    let padIndex = pads.findIndex(p => p.weekId === taskModal.weekId && p.ownerId === targetOwnerId && p.type === 'user');
    
    if (padIndex === -1) {
      const newPad: WeeklyPAD = {
        id: `pad-${Date.now()}`,
        weekId: taskModal.weekId,
        ownerId: targetOwnerId,
        type: 'user',
        entries: entriesToAdd
      };
      pads.push(newPad);
    } else {
      const pad = { ...pads[padIndex] };
      // Check if updating existing task
      const entryIndex = pad.entries.findIndex(e => e.id === newTask.id);
      if (entryIndex >= 0) {
        const newEntries = [...pad.entries];
        newEntries[entryIndex] = entriesToAdd[0];
        pad.entries = newEntries;
      } else {
        pad.entries = [...pad.entries, ...entriesToAdd];
      }
      pads[padIndex] = pad;
    }
    
    setWeeklyPADs(pads);
    setIsDirty(true);

    // Show success message with location and week info
    const ownerName = state.users.find(u => u.id === targetOwnerId)?.name || '个人';
    const weekNum = taskModal.weekId?.split('-W')[1] || '';
    const actionText = status === 'submitted' ? '提交' : '保存';
    showNotification(`第 ${weekNum} 周任务已成功${actionText}至 [${ownerName}] 的个人计划中`);

    if (keepOpen) {
      setTaskModal({ 
        isOpen: true, 
        weekId: taskModal.weekId, 
        data: { 
          id: `task-${Date.now()}`,
          title: '', 
          status: 'draft',
          priority: 'medium',
          ownerId: currentUser.id,
          visibility: 'public',
          alignedKrId: taskModal.data.alignedKrId,
          startDate: Date.now(),
          dueDate: Date.now() + 86400000,
          tags: [],
          participantIds: [],
          approverIds: []
        } 
      });
    } else {
      setTaskModal({ isOpen: false, weekId: null, data: {} });
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 md:gap-6 overflow-hidden relative">
      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden flex justify-between items-center bg-white p-4 rounded-2xl border shadow-sm shrink-0">
        <div className="flex items-center gap-2 font-black text-slate-800">
          <Building2 size={20} className="text-brand-600"/>
          <span>{selectedDeptId ? flatDepts.find(d => d.id === selectedDeptId)?.name : '选择部门'}</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 bg-slate-100 text-slate-600 rounded-xl"
        >
          <ChevronDown className={`transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`}/>
        </button>
      </div>

      {/* Left Sidebar: Org Tree */}
      <div className={`
        absolute md:relative z-10 md:z-0
        w-full md:w-64 bg-white border rounded-2xl md:rounded-[2.5rem] p-4 md:p-6 flex flex-col shadow-xl md:shadow-sm shrink-0
        transition-all duration-300 origin-top
        ${isSidebarOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 md:scale-y-100 md:opacity-100'}
        top-[72px] md:top-0 left-0
      `}>
        <div className="mb-4 md:mb-6">
          <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-3 md:mb-4">
            组织架构
          </h3>
          <div className="space-y-1 overflow-y-auto custom-scrollbar max-h-[40vh] md:max-h-[calc(100vh-200px)]">
            {renderDeptTree(visibleDepartments)}
          </div>
        </div>
      </div>

      {/* Right Content: Period Alignment View */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white border rounded-2xl md:rounded-[2.5rem] shadow-sm relative">
        <div className="p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="flex items-center gap-3 md:gap-4">
                <div className="p-2 md:p-3 bg-brand-50 text-brand-600 rounded-xl md:rounded-2xl"><LayoutGrid size={20} className="md:w-6 md:h-6"/></div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-800">OKR 执行</h3>
                  <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">OKR Execution</p>
                </div>
             </div>
             <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
                <button 
                  onClick={handleSave}
                  disabled={isSaving || backendError}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase transition-all ${showSaveSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} ${backendError ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={14}/> : showSaveSuccess ? <CheckCircle size={14}/> : <Save size={14}/>}
                  {showSaveSuccess ? '已保存' : '保存'}
                </button>
                <select 
                  className="flex-1 md:flex-none bg-slate-50 border rounded-xl px-2 md:px-3 py-2 text-[10px] md:text-xs font-bold outline-none text-slate-600"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                >
                  {[new Date().getFullYear(), new Date().getFullYear() + 1].map(y => <option key={y} value={y}>{y} 年</option>)}
                </select>
                <select 
                  className="flex-1 md:flex-none bg-slate-50 border rounded-xl px-2 md:px-3 py-2 text-[10px] md:text-xs font-bold outline-none text-slate-600"
                  value={selectedPeriod}
                  onChange={e => setSelectedPeriod(e.target.value)}
                >
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
             </div>
        </div>

        <div className="flex-1 overflow-hidden p-2 md:p-6">
          {selectedDeptId ? (
            <PeriodAlignmentView
              state={state}
              selectedYear={selectedYear}
              selectedPeriod={selectedPeriod}
              selectedDeptId={selectedDeptId}
              onAddTask={handleAddTask}
              onTaskClick={handleTaskClick}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <Building2 size={48} className="opacity-20"/>
              <p className="font-bold">请选择一个部门以查看执行情况</p>
            </div>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700">
            {notification.type === 'success' ? (
              <CheckCircle size={18} className="text-emerald-400" />
            ) : (
              <AlertCircle size={18} className="text-amber-400" />
            )}
            <span className="text-sm font-bold">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={taskModal.isOpen}
        onClose={() => setTaskModal({ ...taskModal, isOpen: false })}
        data={taskModal.data}
        setData={(newData) => setTaskModal({ ...taskModal, data: newData })}
        onSave={saveTask}
        users={state.users}
        groupedAvailableKRs={groupedAvailableKRs}
        isEditing={!!taskModal.data.id && !taskModal.data.id.startsWith('task-')} // Simple check, or rely on logic
      />
    </div>
  );
};

export default ExecutionView;
