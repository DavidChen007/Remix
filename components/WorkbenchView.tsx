import React, { useMemo, useState } from 'react';
import { AppState, PADEntry, OKR, WeeklyPAD, TaskLog } from '../types';
import { Calendar, CheckCircle, Clock, Target, ArrowRight, LayoutDashboard, ListTodo, Briefcase, Flag, AlertCircle } from 'lucide-react';
import TaskModal from './TaskModal';

interface WorkbenchViewProps {
  state: AppState;
  currentUser: { id: string, name: string, departmentId?: string };
  setWeeklyPADs: (pads: WeeklyPAD[]) => void;
  setIsDirty: (dirty: boolean) => void;
}

const WorkbenchView: React.FC<WorkbenchViewProps> = ({ state, currentUser, setWeeklyPADs, setIsDirty }) => {
  const today = new Date();
  const currentWeek = getWeekNumber(today);
  const currentYear = today.getFullYear();
  const weekId = `${currentYear}-W${currentWeek.toString().padStart(2, '0')}`;
  const nextWeekId = `${currentYear}-W${(currentWeek + 1).toString().padStart(2, '0')}`;

  const [taskModal, setTaskModal] = useState<{ isOpen: boolean, weekId: string | null, data: Partial<PADEntry> }>({ isOpen: false, weekId: null, data: {} });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Helper to get tasks from all PADs
  const allMyTasks = useMemo(() => {
    const tasks: PADEntry[] = [];
    const seen = new Set<string>();
    state.weeklyPADs.forEach(pad => {
      // Filter by owner or participant
      if (pad.ownerId === currentUser.id || pad.entries.some(e => e.participantIds?.includes(currentUser.id))) {
        pad.entries.forEach(e => {
          if (e.ownerId === currentUser.id || e.participantIds?.includes(currentUser.id)) {
            if (!seen.has(e.id)) {
              seen.add(e.id);
              tasks.push(e);
            }
          }
        });
      }
    });
    return tasks;
  }, [state.weeklyPADs, currentUser.id]);

  const todayTasks = useMemo(() => {
    return allMyTasks.filter(t => {
      if (!t.startDate || !t.dueDate) return false;
      const start = new Date(t.startDate);
      const due = new Date(t.dueDate);
      return today >= start && today <= due;
    });
  }, [allMyTasks, today]);

  // Pre-calculate task-to-week mapping to avoid O(N^2) in filters
  const taskWeekMap = useMemo(() => {
    const map = new Map<string, string>();
    state.weeklyPADs.forEach(p => {
      p.entries.forEach(e => {
        map.set(e.id, p.weekId);
      });
    });
    return map;
  }, [state.weeklyPADs]);

  const thisWeekTasks = useMemo(() => {
    return allMyTasks.filter(t => taskWeekMap.get(t.id) === weekId);
  }, [allMyTasks, weekId, taskWeekMap]);

  const nextWeekTasks = useMemo(() => {
    return allMyTasks.filter(t => taskWeekMap.get(t.id) === nextWeekId);
  }, [allMyTasks, nextWeekId, taskWeekMap]);

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
    state.departments.forEach(d => {
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
  }, [state.strategy.companyOKRs, state.departments, taskModal.weekId]);

  const handleTaskClick = (task: PADEntry) => {
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

    // Find the weekId for this task
    const pad = state.weeklyPADs.find(p => p.entries.some(e => e.id === task.id));
    setTaskModal({
      isOpen: true,
      weekId: pad?.weekId || weekId, // Default to current week if not found (shouldn't happen)
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

    // Prepare entries to add (handle multi-line title for new tasks)
    const entriesToAdd: PADEntry[] = [];
    // If id doesn't exist or we are creating a new task, we check for multi-line
    // Wait, taskModal.data.id might be set for new tasks too?
    // In WorkbenchView, when creating a new task, taskModal.data.id is not set or set to a temp value.
    // Let's assume if it's not updating an existing task, we split.
    // Actually, we can check if the task exists in any pad. If not, it's new.
    
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
        // Replace the existing task with the first entry (if it was split, which shouldn't happen for existing tasks)
        newEntries[entryIndex] = entriesToAdd[0];
        pad.entries = newEntries;
      } else {
        pad.entries = [...pad.entries, ...entriesToAdd];
      }
      pads[padIndex] = pad;
    }
    
    setWeeklyPADs(pads);
    setIsDirty(true);
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
    <div className="h-full flex flex-col gap-4 md:gap-6 overflow-hidden p-4 md:p-6 bg-slate-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <LayoutDashboard size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tighter text-slate-800">工作台</h2>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">My Workbench</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-slate-500 bg-white px-4 py-2 rounded-2xl border shadow-sm">
          <Calendar size={14} className="md:w-4 md:h-4" />
          <span>{today.toLocaleDateString()}</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] md:text-xs text-slate-600">第 {currentWeek} 周</span>
        </div>
      </div>

      {/* Quadrants - Adjusted to 3 columns since My Goals is removed */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 overflow-y-auto md:overflow-hidden pb-10 md:pb-0">
        
        {/* Today's Work */}
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 border shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-all min-h-[300px] md:min-h-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"/>
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2"><CheckCircle className="text-emerald-500" size={18}/> 今日工作</h3>
            <span className="text-[10px] md:text-xs font-bold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full">{todayTasks.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {todayTasks.length > 0 ? todayTasks.map(t => (
              <TaskCard key={t.id} task={t} onClick={() => handleTaskClick(t)} />
            )) : <EmptyState label="今日暂无待办任务" />}
          </div>
        </div>

        {/* This Week's Work */}
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 border shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-all min-h-[300px] md:min-h-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"/>
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2"><Briefcase className="text-indigo-500" size={18}/> 本周工作</h3>
            <span className="text-[10px] md:text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{thisWeekTasks.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {thisWeekTasks.length > 0 ? thisWeekTasks.map(t => (
              <TaskCard key={t.id} task={t} onClick={() => handleTaskClick(t)} />
            )) : <EmptyState label="本周工作计划为空" />}
          </div>
        </div>

        {/* Next Week's Work */}
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 border shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-all min-h-[300px] md:min-h-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"/>
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2"><Calendar className="text-amber-500" size={18}/> 下周工作</h3>
            <span className="text-[10px] md:text-xs font-bold bg-amber-50 text-amber-600 px-3 py-1 rounded-full">{nextWeekTasks.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {nextWeekTasks.length > 0 ? nextWeekTasks.map(t => (
              <TaskCard key={t.id} task={t} onClick={() => handleTaskClick(t)} />
            )) : <EmptyState label="下周暂无计划" />}
          </div>
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

      <TaskModal
        isOpen={taskModal.isOpen}
        onClose={() => setTaskModal({ ...taskModal, isOpen: false })}
        data={taskModal.data}
        setData={(newData) => setTaskModal({ ...taskModal, data: newData })}
        onSave={saveTask}
        users={state.users}
        groupedAvailableKRs={groupedAvailableKRs}
        isEditing={true}
      />
    </div>
  );
};

const TaskCard: React.FC<{ task: PADEntry, onClick: () => void }> = ({ task, onClick }) => (
  <div onClick={onClick} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all cursor-pointer group">
    <div className="flex justify-between items-start mb-2">
      <h4 className="font-bold text-sm text-slate-700 line-clamp-2">{task.title}</h4>
      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
        task.priority === 'high' ? 'bg-red-50 text-red-600' : 
        task.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 
        'bg-slate-200 text-slate-500'
      }`}>{task.priority}</span>
    </div>
    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
      <span className="flex items-center gap-1"><Clock size={10}/> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '无截止日期'}</span>
      <span className={`flex items-center gap-1 ${task.status === 'completed' ? 'text-emerald-500' : ''}`}>
        {task.status === 'completed' ? <CheckCircle size={10}/> : <Flag size={10}/>}
        {task.status === 'draft' ? '草稿' : 
         task.status === 'submitted' ? '已提交' : 
         task.status === 'in-progress' ? '处理中' : 
         task.status === 'paused' ? '暂停' : 
         task.status === 'terminated' ? '终止' : 
         task.status === 'completed' ? '已完成' : task.status}
      </span>
    </div>
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
    <ListTodo size={32} className="opacity-20"/>
    <span className="text-xs font-bold">{label}</span>
  </div>
);

function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

export default WorkbenchView;
