import React, { useState, useMemo } from 'react';
import { AppState, Department, ReviewEntry, ObjectiveReview, User, PADEntry, MenuPermission } from '../types';
import { Calendar, Building2, ClipboardCheck, Save, CheckCircle, Loader2, Target, TrendingUp, MessageSquare, FileText, AlertCircle, Lock } from 'lucide-react';
import TaskModal from './TaskModal';
import { getVisibleDepartments } from '../utils/permissions';

interface ReviewViewProps {
  state: AppState;
  setDepartments: (d: Department[]) => void;
  handleSave: () => void;
  isSaving: boolean;
  showSaveSuccess: boolean;
  backendError: boolean;
  setIsDirty: (dirty: boolean) => void;
  initialTab?: 'weekly' | 'monthly';
  initialDeptId?: string;
  initialPeriod?: string;
  onBack?: () => void;
  currentUser: User;
  permissions: MenuPermission;
}

const ReviewView: React.FC<ReviewViewProps> = ({
  state,
  setDepartments,
  handleSave,
  isSaving,
  showSaveSuccess,
  backendError,
  setIsDirty,
  initialTab,
  initialDeptId,
  initialPeriod,
  onBack,
  currentUser,
  permissions
}) => {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>(initialTab || 'monthly');
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(initialDeptId || null);
  
  // Weekly State
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    if (initialTab === 'weekly' && initialPeriod) return initialPeriod;
    const now = new Date();
    const year = now.getFullYear();
    const week = Math.ceil((((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  });

  // Monthly State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialTab === 'monthly' && initialPeriod) return initialPeriod;
    const now = new Date();
    return `${now.getFullYear()}-M${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  const [reviewContent, setReviewContent] = useState('');
  const [reviewScore, setReviewScore] = useState(0);
  const [okrReviews, setOkrReviews] = useState<Record<string, ObjectiveReview>>({});

  const [taskModal, setTaskModal] = useState<{ isOpen: boolean, weekId: string | null, data: Partial<PADEntry> }>({ isOpen: false, weekId: null, data: {} });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

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
      weekId: pad?.weekId || null,
      data: task
    });
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

  // Load existing review when selection changes
  useMemo(() => {
    if (!selectedDeptId) return;
    const dept = flatDepts.find(d => d.id === selectedDeptId);
    if (!dept) return;

    const periodKey = activeTab === 'weekly' ? selectedWeek : selectedMonth;
    const reviews = dept.reviews?.[periodKey] || [];
    const latestReview = reviews.length > 0 ? reviews[reviews.length - 1] : null;

    if (latestReview) {
      setReviewContent(latestReview.content);
      setReviewScore(latestReview.score);
      setOkrReviews(latestReview.okrDetails || {});
    } else {
      setReviewContent('');
      setReviewScore(0);
      setOkrReviews({});
    }
  }, [selectedDeptId, activeTab, selectedWeek, selectedMonth, flatDepts]);

  const submitReview = () => {
    if (!selectedDeptId) return;
    
    const newEntry: ReviewEntry = {
        id: `rev-${Date.now()}`,
        date: Date.now(),
        content: reviewContent,
        score: reviewScore,
        reviewer: 'Admin', // Should be current user name ideally
        okrDetails: okrReviews
    };

    const updateDeptRecursive = (depts: Department[]): Department[] => {
      return depts.map(d => {
        if (d.id === selectedDeptId) {
          const currentReviews = d.reviews || {};
          const periodKey = activeTab === 'weekly' ? selectedWeek : selectedMonth;
          return { ...d, reviews: { ...currentReviews, [periodKey]: [newEntry] } };
        }
        if (d.subDepartments) {
          return { ...d, subDepartments: updateDeptRecursive(d.subDepartments) };
        }
        return d;
      });
    };

    const updatedDepts = updateDeptRecursive(state.departments);
    setDepartments(updatedDepts);
    setIsDirty(true);
    
    // Trigger global save to persist to backend
    setTimeout(() => {
      handleSave();
    }, 100);
  };

  const handleNumberInput = (val: string, setter: (n: number) => void) => {
    // Remove leading zeros unless the value is just "0"
    // Also prevent negative numbers
    let cleaned = val.replace(/^0+(?=\d)/, '');
    if (cleaned === '') cleaned = '0';
    const num = Math.max(0, Number(cleaned));
    setter(num);
  };

  const currentPeriodLabel = activeTab === 'weekly' ? selectedWeek : selectedMonth;

  // Get tasks for the selected department and period
  const deptTasks = useMemo(() => {
    const tasks: PADEntry[] = [];
    const seen = new Set<string>();
    state.weeklyPADs.forEach(pad => {
      pad.entries.forEach(e => {
        if (e.alignedKrId && !seen.has(e.id)) {
          seen.add(e.id);
          tasks.push(e);
        }
      });
    });
    return tasks;
  }, [state.weeklyPADs]);
  const currentOkrs = useMemo(() => {
    if (!selectedDeptId) return [];
    const dept = flatDepts.find(d => d.id === selectedDeptId);
    if (!dept) return [];
    
    const year = parseInt(currentPeriodLabel.split('-')[0]);
    // For weekly/monthly review, we usually review against Quarterly or Annual OKRs.
    // Let's assume we review against the current Quarter's OKRs.
    // Simple logic to map month/week to quarter:
    let quarter = 'Q1';
    if (activeTab === 'monthly') {
      const month = parseInt(currentPeriodLabel.split('-M')[1]);
      if (month >= 4 && month <= 6) quarter = 'Q2';
      if (month >= 7 && month <= 9) quarter = 'Q3';
      if (month >= 10) quarter = 'Q4';
    } else {
      // Week logic is complex, defaulting to Q1 for simplicity or need a helper
      // For now, let's just show Annual OKRs or all Quarterly OKRs?
      // Let's show Annual + All Quarters for context
    }

    // Return flattened list of OKRs for the year
    const okrs: any[] = [];
    if (dept.okrs?.[year]) {
      Object.entries(dept.okrs[year]).forEach(([period, list]: [string, any[]]) => {
        list.forEach(o => okrs.push({ ...o, period }));
      });
    }
    return okrs;
  }, [selectedDeptId, currentPeriodLabel, flatDepts, activeTab]);

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-3 bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-2xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
          <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl"><ClipboardCheck size={24}/></div>
          <div>
            <h3 className="text-xl font-black text-slate-800">复盘中心</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Review Center</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl">
           <button 
             onClick={() => setActiveTab('weekly')}
             className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'weekly' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
           >
             周度复盘
           </button>
           <button 
             onClick={() => setActiveTab('monthly')}
             className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'monthly' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
           >
             月度复盘
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-12">
        <div className="max-w-5xl mx-auto space-y-8 py-6">
          <div className="bg-white p-8 rounded-[3rem] border shadow-sm">
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-8">
               <div className="flex gap-3">
                  <div className="flex items-center bg-slate-50 border rounded-xl px-4 py-2 gap-2">
                    <Building2 size={14} className="text-slate-400"/>
                    <select className="bg-transparent text-xs font-bold outline-none text-slate-600" value={selectedDeptId || ''} onChange={e => setSelectedDeptId(e.target.value)}>
                      <option value="">选择复盘部门...</option>
                      {flatDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  
                  {activeTab === 'monthly' ? (
                    <div className="flex items-center bg-slate-50 border rounded-xl px-4 py-2 gap-2">
                      <Calendar size={14} className="text-slate-400"/>
                      <select 
                        className="bg-transparent text-xs font-bold outline-none text-slate-600"
                        value={selectedMonth.split('-')[0]}
                        onChange={e => setSelectedMonth(`${e.target.value}-M${selectedMonth.split('-M')[1]}`)}
                      >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}年</option>)}
                      </select>
                      <span className="text-slate-300">/</span>
                      <select 
                        className="bg-transparent text-xs font-bold outline-none text-slate-600"
                        value={parseInt(selectedMonth.split('-M')[1])}
                        onChange={e => setSelectedMonth(`${selectedMonth.split('-')[0]}-M${e.target.value.toString().padStart(2, '0')}`)}
                      >
                        {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{m}月</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center bg-slate-50 border rounded-xl px-4 py-2 gap-2">
                      <Calendar size={14} className="text-slate-400"/>
                      <input 
                        type="week"
                        className="bg-transparent text-xs font-bold outline-none text-slate-600"
                        value={selectedWeek}
                        onChange={e => setSelectedWeek(e.target.value)}
                      />
                    </div>
                  )}
               </div>
            </div>

            {selectedDeptId ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                 {/* Overall Review */}
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><Target size={16}/> 整体复盘总结</h4>
                       <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border">
                          <span className="text-[10px] font-black text-slate-400 uppercase">综合评分</span>
                          <input 
                            type="number" 
                            min="0" max="100" 
                            className="w-12 bg-transparent text-sm font-black text-brand-600 outline-none text-right"
                            value={reviewScore}
                            onChange={e => handleNumberInput(e.target.value, setReviewScore)}
                            onFocus={e => e.target.select()}
                          />
                          <span className="text-xs font-bold text-slate-300">/ 100</span>
                       </div>
                    </div>
                    <textarea 
                      className="w-full h-40 p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm font-bold text-slate-700 outline-none focus:border-brand-300 focus:bg-white transition-all resize-none leading-relaxed"
                      placeholder="输入本周期整体复盘总结..."
                      value={reviewContent}
                      onChange={e => setReviewContent(e.target.value)}
                    />
                 </div>

                 {/* OKR Specific Review */}
                 <div className="space-y-6">
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={16}/> 重点目标复盘</h4>
                    {currentOkrs.map((okr: any) => {
                      const currentReview = okrReviews[okr.id] || { progress: 0, krReviews: [], lessonsLearned: '', methodology: '', nextSteps: '' };
                      
                      return (
                      <div key={okr.id} className="bg-slate-50/50 rounded-[2.5rem] p-8 border border-slate-100">
                         <div className="flex items-center gap-3 mb-6">
                            <span className="bg-white border text-slate-500 text-[10px] font-black px-2 py-1 rounded uppercase">{okr.period}</span>
                            <h5 className="font-bold text-slate-800 flex-1">{okr.objective}</h5>
                            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border">
                               <span className="text-[10px] font-black text-slate-400 uppercase">进度</span>
                               <input 
                                 type="number" 
                                 min="0" max="100" 
                                 className="w-12 bg-transparent text-sm font-black text-brand-600 outline-none text-right"
                                 value={currentReview.progress || 0}
                                 onChange={e => handleNumberInput(e.target.value, (val) => setOkrReviews({ 
                                   ...okrReviews, 
                                   [okr.id]: { ...currentReview, progress: val } 
                                 }))}
                                 onFocus={e => e.target.select()}
                               />
                               <span className="text-xs font-bold text-slate-300">%</span>
                            </div>
                         </div>

                         {/* KR Reviews */}
                         <div className="space-y-4 mb-6">
                           {okr.keyResults.map((kr: string, idx: number) => {
                             const krReview = currentReview.krReviews?.[idx] || { comment: '', progress: 0, status: 'on-track' };
                             const krId = `${okr.id}-kr-${idx}`;
                             const alignedTasks = deptTasks.filter(t => t.alignedKrId === krId);
                             return (
                               <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100">
                                 <div className="flex justify-between items-start mb-2">
                                   <p className="text-xs font-bold text-slate-600 mb-2 flex-1 mr-4">{kr}</p>
                                   <select 
                                     className={`text-[10px] font-black uppercase px-2 py-1 rounded border outline-none ${
                                       krReview.status === 'at-risk' ? 'bg-red-50 text-red-600 border-red-100' :
                                       krReview.status === 'behind' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                       'bg-emerald-50 text-emerald-600 border-emerald-100'
                                     }`}
                                     value={krReview.status || 'on-track'}
                                     onChange={e => {
                                       const newKrReviews = [...(currentReview.krReviews || [])];
                                       while(newKrReviews.length <= idx) newKrReviews.push({ comment: '', progress: 0, status: 'on-track' });
                                       newKrReviews[idx] = { ...newKrReviews[idx], status: e.target.value as any };
                                       setOkrReviews({ ...okrReviews, [okr.id]: { ...currentReview, krReviews: newKrReviews } });
                                     }}
                                   >
                                     <option value="on-track">正常推进</option>
                                     <option value="at-risk">有风险</option>
                                     <option value="behind">滞后</option>
                                   </select>
                                 </div>
                                 <div className="flex gap-4 items-center">
                                    <div className="flex-1">
                                      <input 
                                        type="text"
                                        placeholder="输入 KR 执行情况..."
                                        className="w-full bg-slate-50 border-none rounded-lg px-3 py-2 text-xs font-medium text-slate-600 outline-none focus:ring-1 focus:ring-brand-200"
                                        value={krReview.comment || ''}
                                        onChange={e => {
                                          const newKrReviews = [...(currentReview.krReviews || [])];
                                          while(newKrReviews.length <= idx) newKrReviews.push({ comment: '', progress: 0, status: 'on-track' });
                                          newKrReviews[idx] = { ...newKrReviews[idx], comment: e.target.value };
                                          setOkrReviews({ ...okrReviews, [okr.id]: { ...currentReview, krReviews: newKrReviews } });
                                        }}
                                      />
                                    </div>
                                    <div className="w-24 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                                      <span className="text-[10px] text-slate-400">进度</span>
                                      <input 
                                        type="number"
                                        min="0" max="100"
                                        className="w-full bg-transparent text-xs font-bold text-slate-600 outline-none text-right"
                                        value={krReview.progress || 0}
                                        onChange={e => handleNumberInput(e.target.value, (val) => {
                                          const newKrReviews = [...(currentReview.krReviews || [])];
                                          while(newKrReviews.length <= idx) newKrReviews.push({ comment: '', progress: 0, status: 'on-track' });
                                          newKrReviews[idx] = { ...newKrReviews[idx], progress: val };
                                          setOkrReviews({ ...okrReviews, [okr.id]: { ...currentReview, krReviews: newKrReviews } });
                                        })}
                                        onFocus={e => e.target.select()}
                                      />
                                      <span className="text-[10px] text-slate-400">%</span>
                                    </div>
                                  </div>

                                  {alignedTasks.length > 0 && (
                                    <div className="mt-4 border-t border-slate-100 pt-4">
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3">关联任务评价</h4>
                                      <div className="space-y-3">
                                        {alignedTasks.map(task => {
                                          const owner = state.users.find(u => u.id === task.ownerId);
                                          const evaluation = krReview.taskEvaluations?.[task.id] || '';
                                          return (
                                            <div key={task.id} className="bg-slate-50 rounded-lg p-3">
                                              <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={() => handleTaskClick(task)}>
                                                  <span className="text-xs font-bold text-indigo-600 hover:underline">{task.title}</span>
                                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                                    task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                    task.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                                                    task.status === 'paused' ? 'bg-orange-100 text-orange-700' :
                                                    task.status === 'terminated' ? 'bg-red-100 text-red-700' :
                                                    'bg-slate-200 text-slate-700'
                                                  }`}>
                                                    {task.status === 'completed' ? '已完成' :
                                                     task.status === 'in-progress' ? '处理中' :
                                                     task.status === 'paused' ? '暂停' :
                                                     task.status === 'terminated' ? '终止' :
                                                     task.status === 'submitted' ? '已提交' : '草稿'}
                                                  </span>
                                                </div>
                                                <span className="text-[10px] text-slate-500">{owner?.name || '未知'}</span>
                                              </div>
                                              <input
                                                type="text"
                                                placeholder="输入对该任务的评价..."
                                                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[10px] text-slate-600 outline-none focus:border-brand-300"
                                                value={evaluation}
                                                onChange={e => {
                                                  const newKrReviews = [...(currentReview.krReviews || [])];
                                                  while(newKrReviews.length <= idx) newKrReviews.push({ comment: '', progress: 0, status: 'on-track' });
                                                  const currentTaskEvals = newKrReviews[idx].taskEvaluations || {};
                                                  newKrReviews[idx] = { 
                                                    ...newKrReviews[idx], 
                                                    taskEvaluations: { ...currentTaskEvals, [task.id]: e.target.value } 
                                                  };
                                                  setOkrReviews({ ...okrReviews, [okr.id]: { ...currentReview, krReviews: newKrReviews } });
                                                }}
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                               </div>
                             );
                           })}
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><MessageSquare size={12}/> 经验教训 (Lessons Learned)</label>
                               <textarea 
                                 className="w-full h-24 p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-brand-300 resize-none"
                                 value={currentReview.lessonsLearned || ''}
                                 onChange={e => setOkrReviews({ ...okrReviews, [okr.id]: { ...currentReview, lessonsLearned: e.target.value } })}
                               />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><FileText size={12}/> 方法论沉淀 (Methodology)</label>
                               <textarea 
                                 className="w-full h-24 p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-brand-300 resize-none"
                                 value={currentReview.methodology || ''}
                                 onChange={e => setOkrReviews({ ...okrReviews, [okr.id]: { ...currentReview, methodology: e.target.value } })}
                               />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><TrendingUp size={12}/> 下一步计划 (Next Steps)</label>
                               <textarea 
                                 className="w-full h-24 p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-brand-300 resize-none"
                                 value={currentReview.nextSteps || ''}
                                 onChange={e => setOkrReviews({ ...okrReviews, [okr.id]: { ...currentReview, nextSteps: e.target.value } })}
                               />
                            </div>
                         </div>
                      </div>
                      );
                    })}
                    {currentOkrs.length === 0 && (
                      <div className="text-center py-10 text-slate-400 italic">该部门在所选周期内暂无 OKR 数据</div>
                    )}
                 </div>

                 <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                    {showSaveSuccess && (
                      <div className="flex-1 flex items-center gap-2 text-emerald-600 font-bold text-xs animate-in fade-in slide-in-from-left-2">
                        <CheckCircle size={16}/>
                        复盘报告已提交并保存成功
                      </div>
                    )}
                    <button 
                      onClick={submitReview}
                      disabled={isSaving || !permissions.create}
                      className="px-8 py-4 bg-brand-600 text-white rounded-[2rem] font-black text-xs uppercase shadow-xl hover:bg-brand-700 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                      提交复盘报告
                    </button>
                 </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-4">
                 <Building2 size={48} className="opacity-20"/>
                 <p className="font-bold">请选择一个部门开始复盘</p>
              </div>
            )}
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

      {/* Task Modal (Read Only) */}
      <TaskModal
        isOpen={taskModal.isOpen}
        onClose={() => setTaskModal({ ...taskModal, isOpen: false })}
        data={taskModal.data}
        setData={() => {}}
        onSave={() => {}}
        users={state.users}
        groupedAvailableKRs={[]}
        isEditing={false}
      />
    </div>
  );
};

export default ReviewView;
