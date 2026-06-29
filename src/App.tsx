import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, Circle, Clock, Plus, Trash2, Edit2, LogOut, Search, 
  Calendar, AlertCircle, RefreshCw, FolderPlus, ListTodo, User, CheckSquare, ChevronRight, X, ChevronDown, Check,
  Sun, Moon, Archive, UserCircle
} from 'lucide-react';
import { authApi, projectsApi, tasksApi, loadUserData, getStoredToken, setStoredToken } from './api';
import { LoginPage, RegisterPage } from './components/AuthPages';
import { Project, Task, Subtask, User as AppUser } from './types';

// Palette of elegant colors for projects
const COLOR_PALETTE = [
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-500', text: 'text-indigo-600', dot: 'bg-indigo-500', ring: 'ring-indigo-200' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500', text: 'text-emerald-600', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  { id: 'sky', name: 'Sky Blue', bg: 'bg-sky-500', text: 'text-sky-600', dot: 'bg-sky-500', ring: 'ring-sky-200' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-500', text: 'text-amber-600', dot: 'bg-amber-500', ring: 'ring-amber-200' },
  { id: 'rose', name: 'Rose Red', bg: 'bg-rose-500', text: 'text-rose-600', dot: 'bg-rose-500', ring: 'ring-rose-200' },
  { id: 'slate', name: 'Charcoal', bg: 'bg-slate-500', text: 'text-slate-600', dot: 'bg-slate-500', ring: 'ring-slate-200' },
];

function ThemeToggle({ isDarkMode, setIsDarkMode }: { isDarkMode: boolean; setIsDarkMode: (v: boolean) => void }) {
  return (
    <button
      onClick={() => setIsDarkMode(!isDarkMode)}
      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
        isDarkMode
          ? 'bg-white/5 border-white/10 text-amber-400 hover:bg-white/10'
          : 'bg-white border-slate-200 text-indigo-500 hover:bg-slate-50 shadow-sm'
      }`}
    >
      {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

type AuthView = 'login' | 'register';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('tasksync_theme');
    return saved !== null ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('tasksync_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  
  // Real-time Firestore sync states
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Active filters and views
  const [activeProjectId, setActiveProjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'archived'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'createdAt'>('createdAt');

  // UI modal states
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('indigo');

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    projectId: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
    subtasks: [] as Subtask[]
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Track expanded tasks for viewing subtasks/descriptions
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  const refreshData = async () => {
    if (!user) return;
    setIsSyncing(true);
    setDbError(null);
    try {
      const data = await loadUserData();
      setProjects(data.projects);
      setTasks(data.tasks);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to load your workspace.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAuthSuccess = async (loggedInUser: AppUser) => {
    setUser(loggedInUser);
    setAuthView('login');
    setIsSyncing(true);
    setDbError(null);
    try {
      const data = await loadUserData();
      setProjects(data.projects);
      setTasks(data.tasks);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to load your workspace.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local session even if server call fails
    }
    setStoredToken(null);
    setUser(null);
    setProjects([]);
    setTasks([]);
    setIsProfileOpen(false);
  };

  // Restore session on startup (remember last logged-in user)
  useEffect(() => {
    const restoreSession = async () => {
      if (!getStoredToken()) {
        setAuthLoading(false);
        return;
      }
      try {
        const { user: sessionUser } = await authApi.me();
        setUser(sessionUser);
        const data = await loadUserData();
        setProjects(data.projects);
        setTasks(data.tasks);
      } catch {
        setStoredToken(null);
      } finally {
        setAuthLoading(false);
      }
    };
    restoreSession();
  }, []);

  // Set default project in task form when projects load
  useEffect(() => {
    if (projects.length > 0 && !taskForm.projectId) {
      setTaskForm(prev => ({ ...prev, projectId: projects[0].id }));
    }
  }, [projects]);

  // Toggle expanded state of a task
  const toggleExpandTask = (id: string) => {
    setExpandedTaskIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newProjectName.trim()) return;

    setIsSyncing(true);
    try {
      await projectsApi.create(newProjectName.trim(), newProjectColor);
      setNewProjectName('');
      setIsNewProjectOpen(false);
      await refreshData();
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to create list.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !window.confirm('Are you sure you want to delete this list? All tasks in this list will also be deleted.')) return;

    setIsSyncing(true);
    try {
      await projectsApi.delete(projectId);
      if (activeProjectId === projectId) {
        setActiveProjectId('all');
      }
      await refreshData();
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to delete list.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Open Task Modal for Creating
  const openCreateTaskModal = () => {
    setEditingTask(null);
    setTaskForm({
      title: '',
      description: '',
      projectId: activeProjectId !== 'all' ? activeProjectId : (projects[0]?.id || ''),
      priority: 'medium',
      dueDate: '',
      subtasks: []
    });
    setNewSubtaskTitle('');
    setIsTaskModalOpen(true);
  };

  // Open Task Modal for Editing
  const openEditTaskModal = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      priority: task.priority,
      dueDate: task.dueDate,
      subtasks: [...task.subtasks]
    });
    setNewSubtaskTitle('');
    setIsTaskModalOpen(true);
  };

  // Add inline subtask to the form state
  const handleAddFormSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: Subtask = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: newSubtaskTitle.trim(),
      completed: false
    };
    setTaskForm(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, newSub]
    }));
    setNewSubtaskTitle('');
  };

  // Remove inline subtask from form state
  const handleRemoveFormSubtask = (id: string) => {
    setTaskForm(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(sub => sub.id !== id)
    }));
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !taskForm.title.trim() || !taskForm.projectId) return;

    setIsSyncing(true);
    try {
      if (editingTask) {
        await tasksApi.update(editingTask.id, {
          projectId: taskForm.projectId,
          title: taskForm.title.trim(),
          description: taskForm.description,
          status: editingTask.status,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate,
          subtasks: taskForm.subtasks,
        });
      } else {
        await tasksApi.create({
          projectId: taskForm.projectId,
          title: taskForm.title.trim(),
          description: taskForm.description,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate,
          subtasks: taskForm.subtasks,
        });
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
      await refreshData();
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleTaskStatus = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    setIsSyncing(true);
    try {
      await tasksApi.update(task.id, { ...task, status: newStatus });
      await refreshData();
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to update task.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleSubtask = async (task: Task, subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const updatedSubtasks = task.subtasks.map(sub =>
      sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
    );

    setIsSyncing(true);
    try {
      await tasksApi.update(task.id, { ...task, subtasks: updatedSubtasks });
      await refreshData();
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to update subtask.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !window.confirm('Are you sure you want to delete this task?')) return;

    setIsSyncing(true);
    try {
      await tasksApi.delete(taskId);
      await refreshData();
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to delete task.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleArchiveTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    setIsSyncing(true);
    try {
      await tasksApi.update(task.id, { ...task, status: 'archived' });
      await refreshData();
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to archive task.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter & Sort Logic
  const filteredTasks = tasks
    .filter(task => {
      // 1. Project filtering
      if (activeProjectId !== 'all' && task.projectId !== activeProjectId) return false;
      
      // 2. Status filtering
      if (statusFilter === 'all' && task.status === 'archived') return false;
      if (statusFilter === 'pending' && task.status !== 'pending') return false;
      if (statusFilter === 'completed' && task.status !== 'completed') return false;
      if (statusFilter === 'archived' && task.status !== 'archived') return false;

      // 3. Priority filtering
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

      // 4. Search matching title or description
      if (searchQuery.trim()) {
        const queryClean = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(queryClean);
        const matchesDesc = task.description.toLowerCase().includes(queryClean);
        return matchesTitle || matchesDesc;
      }

      return true;
    })
    .sort((a, b) => {
      // 5. Sorting
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (sortBy === 'priority') {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      // Default / createdAt
      const aTime = new Date(a.createdAt).getTime() || 0;
      const bTime = new Date(b.createdAt).getTime() || 0;
      return bTime - aTime;
    });

  // Calculate stats for Active Project / Category
  const activeProject = projects.find(p => p.id === activeProjectId);
  const totalTasksCount = filteredTasks.length;
  const completedTasksCount = filteredTasks.filter(t => t.status === 'completed').length;
  const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Onboarding/Loading UI
  if (authLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 relative overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        {/* Theme Toggle Button */}
        <div className="absolute top-5 right-5 z-20">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              isDarkMode 
                ? 'bg-white/5 border-white/10 text-amber-400 hover:bg-white/10' 
                : 'bg-white border-slate-200 text-indigo-500 hover:bg-slate-50 shadow-sm'
            }`}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Ambient background meshes */}
        <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${isDarkMode ? 'opacity-30' : 'opacity-40'}`}>
          <div className={`absolute top-[-20%] left-[-20%] w-[500px] h-[500px] rounded-full filter blur-[100px] transition-colors duration-500 ${isDarkMode ? 'bg-indigo-600' : 'bg-indigo-200'}`} />
          <div className={`absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] rounded-full filter blur-[100px] transition-colors duration-500 ${isDarkMode ? 'bg-fuchsia-600' : 'bg-fuchsia-200'}`} />
        </div>
        
        <div className="relative z-10 flex flex-col items-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            className={`p-3 rounded-2xl border backdrop-blur-md shadow-xl transition-colors duration-300 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200/80'}`}
          >
            <RefreshCw className={`w-6 h-6 animate-pulse ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
          </motion.div>
          <p className={`mt-4 text-sm font-medium font-mono tracking-wider animate-pulse transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authView === 'register') {
      return (
        <>
          <div className="absolute top-5 right-5 z-50">
            <ThemeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
          </div>
          <RegisterPage
            isDarkMode={isDarkMode}
            onRegister={handleAuthSuccess}
            onSwitchToLogin={() => setAuthView('login')}
          />
        </>
      );
    }
    return (
      <>
        <div className="absolute top-5 right-5 z-50">
          <ThemeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
        </div>
        <LoginPage
          isDarkMode={isDarkMode}
          onLogin={handleAuthSuccess}
          onSwitchToRegister={() => setAuthView('register')}
        />
      </>
    );
  }

  return (
    <div className={`min-h-screen overflow-hidden relative flex flex-col md:flex-row font-sans transition-colors duration-300 ${isDarkMode ? 'text-white bg-slate-950' : 'text-slate-800 bg-slate-50'}`}>
      {/* Mesh Gradient Background Layers */}
      <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${isDarkMode ? 'opacity-40' : 'opacity-40'}`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full filter blur-[120px] transition-colors duration-500 ${isDarkMode ? 'bg-indigo-600' : 'bg-indigo-200'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full filter blur-[120px] transition-colors duration-500 ${isDarkMode ? 'bg-fuchsia-600' : 'bg-fuchsia-200'}`} />
        <div className={`absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full filter blur-[100px] transition-colors duration-500 ${isDarkMode ? 'bg-blue-500' : 'bg-sky-200'}`} />
      </div>
      
      {/* LEFT SIDEBAR: Brand, Projects, and Logout */}
      <aside className={`w-full md:w-64 backdrop-blur-md border-b md:border-b-0 md:border-r flex flex-col flex-shrink-0 z-10 transition-all duration-300 ${
        isDarkMode 
          ? 'bg-white/5 border-white/10' 
          : 'bg-slate-900/[0.03] border-slate-200/80'
      }`}>
        
        {/* Brand Header */}
        <div className={`p-5 border-b flex items-center justify-between transition-colors duration-300 ${isDarkMode ? 'border-white/10' : 'border-slate-200/80'}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <span className={`font-bold tracking-tight transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>TaskSync</span>
              <span className={`text-[10px] font-mono block -mt-1 font-semibold transition-colors duration-300 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>REALTIME</span>
            </div>
          </div>

          {/* Sync Status & Theme Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-amber-400 hover:bg-white/10 hover:text-amber-300' 
                  : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200/80 shadow-sm'
              }`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {isSyncing ? (
              <RefreshCw className={`w-3.5 h-3.5 animate-spin ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
            ) : (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}>
                <span className="relative flex h-1 w-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                </span>
                Active
              </div>
            )}
          </div>
        </div>

        {/* User Account Bar */}
        <div className={`p-4 mx-3 my-2 backdrop-blur-md rounded-2xl border transition-all duration-300 ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-white/80 border-slate-200/60 shadow-sm'
        }`}>
          <p className={`text-xs mb-2 transition-colors duration-300 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Welcome, <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user.fullName}</span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
              <div className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold flex-shrink-0 ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden min-w-0">
                <p className={`text-xs font-bold truncate leading-tight transition-colors duration-300 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>@{user.username}</p>
                {user.email && (
                  <p className={`text-[10px] font-mono truncate leading-none transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{user.email}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setIsProfileOpen(true)}
                className={`p-1.5 rounded-xl border border-transparent transition-all cursor-pointer ${
                  isDarkMode
                    ? 'hover:bg-white/10 text-white/60 hover:text-indigo-300 hover:border-white/10'
                    : 'hover:bg-slate-100 text-slate-500 hover:text-indigo-600 hover:border-slate-200'
                }`}
                title="Profile"
              >
                <UserCircle className="w-4 h-4" />
              </button>
              <button 
                onClick={handleLogout} 
                className={`p-1.5 rounded-xl border border-transparent transition-all cursor-pointer ${
                  isDarkMode 
                    ? 'hover:bg-white/10 text-white/60 hover:text-rose-400 hover:border-white/10' 
                    : 'hover:bg-slate-100 text-slate-500 hover:text-rose-600 hover:border-slate-200'
                }`}
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          
          {/* Main Navigation list */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveProjectId('all')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium transition-all border ${
                activeProjectId === 'all' 
                  ? isDarkMode 
                    ? 'bg-white/15 border-white/25 text-white font-semibold' 
                    : 'bg-indigo-600 border-indigo-500/10 text-white font-semibold shadow-md shadow-indigo-600/15'
                  : isDarkMode 
                    ? 'text-white/60 border-transparent hover:bg-white/5 hover:text-white' 
                    : 'text-slate-600 border-transparent hover:bg-slate-200/40 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare className="w-4.5 h-4.5 opacity-75" />
                <span>All Tasks</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono border transition-all duration-300 ${
                activeProjectId === 'all' 
                  ? isDarkMode ? 'bg-white/10 border-white/10 text-white' : 'bg-white/25 border-white/10 text-white' 
                  : isDarkMode ? 'bg-white/5 border-transparent text-white/50' : 'bg-slate-200 border-transparent text-slate-500'
              }`}>{tasks.filter(t => t.status !== 'archived').length}</span>
            </button>
          </div>

          {/* Projects/Categories Section */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <span className={`text-xs font-bold uppercase tracking-widest transition-colors duration-300 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>My Lists</span>
              <button 
                onClick={() => setIsNewProjectOpen(true)}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${isDarkMode ? 'hover:bg-white/10 text-white/50 hover:text-white' : 'hover:bg-slate-200/50 text-slate-500 hover:text-slate-800'}`}
                title="Create New List"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              {projects.map(proj => {
                const projColor = COLOR_PALETTE.find(c => c.id === proj.color) || COLOR_PALETTE[0];
                const count = tasks.filter(t => t.projectId === proj.id).length;
                const isActive = activeProjectId === proj.id;

                return (
                  <button
                    key={proj.id}
                    onClick={() => setActiveProjectId(proj.id)}
                    className={`group w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-medium transition-all border ${
                      isActive 
                        ? isDarkMode
                          ? 'bg-white/10 border-white/15 text-white font-semibold' 
                          : 'bg-slate-200 border-slate-300/40 text-slate-900 font-semibold shadow-sm'
                        : isDarkMode
                          ? 'text-white/60 border-transparent hover:bg-white/5 hover:text-white'
                          : 'text-slate-600 border-transparent hover:bg-slate-200/40 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className={`w-2.5 h-2.5 rounded-full ${projColor.dot} flex-shrink-0 ring-4 ring-transparent group-hover:ring-white/10 transition-all`} />
                      <span className="truncate">{proj.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isActive 
                          ? isDarkMode ? 'bg-white/10 border-white/10 text-white' : 'bg-slate-300/40 border-slate-300 text-slate-800 font-medium' 
                          : isDarkMode ? 'bg-white/5 border-transparent text-white/50' : 'bg-slate-200 border-transparent text-slate-500'
                      }`}>{count}</span>
                      {proj.name !== 'Inbox' && (
                        <button
                          onClick={(e) => handleDeleteProject(proj.id, e)}
                          className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all ${
                            isDarkMode ? 'text-white/30 hover:text-rose-400 hover:bg-white/5' : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200/60'
                          }`}
                          title="Delete List"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priorities & Quick Filters */}
          <div>
            <span className={`text-xs font-bold uppercase tracking-widest px-3 block mb-2 transition-colors duration-300 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Priority Filters</span>
            <div className="grid grid-cols-2 gap-2 px-1">
              {['all', 'high', 'medium', 'low'].map(prio => (
                <button
                  key={prio}
                  onClick={() => setPriorityFilter(prio as any)}
                  className={`px-2 py-2 rounded-xl text-xs font-medium capitalize text-center border transition-all cursor-pointer ${
                    priorityFilter === prio
                      ? isDarkMode
                        ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200 font-semibold shadow-lg shadow-indigo-500/5'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold shadow-sm'
                      : isDarkMode
                        ? 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50 hover:text-slate-950 shadow-sm'
                  }`}
                >
                  {prio}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Database Warning */}
        {dbError && (
          <div className="p-3.5 m-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2 text-rose-300">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] font-medium leading-relaxed">{dbError}</p>
          </div>
        )}

      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10 overflow-hidden">
        
        {/* TOP HUB BAR: Title, Search, Filter Buttons */}
        <header className={`backdrop-blur-md border-b p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-white/80 border-slate-200/60 shadow-sm'
        }`}>
          <div>
            <h2 className={`text-2xl font-bold tracking-tight flex items-center gap-2.5 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {activeProjectId === 'all' ? 'All Workspace Tasks' : activeProject?.name || 'My Tasks'}
              {activeProject && (
                <span className={`w-3 h-3 rounded-full ${COLOR_PALETTE.find(c => c.id === activeProject.color)?.dot} ring-4 ${isDarkMode ? 'ring-white/10' : 'ring-slate-100'}`} />
              )}
            </h2>
            <p className={`text-xs mt-0.5 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
              {totalTasksCount} tasks found • {completionPercentage}% completed
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative max-w-xs w-full sm:w-60">
              <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search action items..."
                className={`w-full pl-10 pr-8 py-2.5 rounded-2xl text-xs transition-all ${
                  isDarkMode 
                    ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:bg-white/10 focus:ring-indigo-500/20 focus:border-white/25' 
                    : 'bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-slate-50/50 focus:ring-indigo-500/10 focus:border-indigo-300 shadow-sm'
                }`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-white/40' : 'text-slate-500 hover:text-slate-800'}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Create Button */}
            <button
              onClick={openCreateTaskModal}
              className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-indigo-600/20 border border-indigo-500/50 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Add Task</span>
            </button>
          </div>
        </header>

        {/* PROGRESS METRICS CARD */}
        <div className="px-6 pt-6">
          <div className={`backdrop-blur-md border rounded-[2rem] p-5 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200/80 shadow-slate-200/40'
          }`}>
            <div className="w-full md:w-auto">
              <span className={`text-[10px] font-bold font-mono uppercase tracking-wider block mb-1 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>List Summary</span>
              <h3 className={`text-sm font-semibold transition-colors duration-300 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                You have completed <span className="text-indigo-500 font-bold">{completedTasksCount}</span> out of <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalTasksCount}</span> filter-matching items.
              </h3>
            </div>
            
            <div className="w-full md:w-64 flex items-center gap-3">
              <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full"
                />
              </div>
              <span className="text-xs font-bold font-mono text-indigo-500 w-10 text-right">{completionPercentage}%</span>
            </div>
          </div>
        </div>

        {/* SECONDARY FILTER & SORT TOOLBAR */}
        <div className="px-6 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Status Tabs */}
          <div className={`flex p-1 rounded-2xl border transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/5 border-white/10' 
              : 'bg-slate-100 border-slate-200/50'
          }`}>
            {(['all', 'pending', 'completed', 'archived'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer border ${
                  statusFilter === tab
                    ? 'bg-indigo-600 border-indigo-500/40 text-white shadow-lg shadow-indigo-600/20'
                    : isDarkMode
                      ? 'text-white/50 border-transparent hover:bg-white/5 hover:text-white'
                      : 'text-slate-600 border-transparent hover:bg-white/50 hover:text-slate-900'
                }`}
              >
                {tab === 'pending' ? 'Active' : tab}
              </button>
            ))}
          </div>

          {/* Sort Menu */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`border rounded-2xl px-4 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors cursor-pointer ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <option value="createdAt" className="text-slate-900 bg-white" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Created Date</option>
              <option value="dueDate" className="text-slate-900 bg-white" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Due Date</option>
              <option value="priority" className="text-slate-900 bg-white" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Priority Weight</option>
            </select>
          </div>

        </div>

        {/* TASKS LIST CONTAINER */}
        <div className="flex-1 p-6 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className={`h-64 flex flex-col items-center justify-center p-8 text-center backdrop-blur-md rounded-2xl border border-dashed transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/5 border-white/10' 
                : 'bg-white border-slate-200/80 shadow-sm'
            }`}>
              <CheckCircle2 className={`w-10 h-10 mb-3 transition-colors duration-300 ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`} />
              <h4 className={`text-sm font-semibold transition-colors duration-300 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>No active items in view</h4>
              <p className={`text-xs max-w-xs mt-1 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                Create a task to kickstart your real-time synchronization, or adjust your filtration settings above.
              </p>
              <button
                onClick={openCreateTaskModal}
                className={`mt-4 px-5 py-2.5 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                  isDarkMode 
                    ? 'bg-white hover:bg-slate-100 text-slate-950' 
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Create New Task</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {filteredTasks.map(task => {
                  const projectOfTask = projects.find(p => p.id === task.projectId);
                  const isExpanded = !!expandedTaskIds[task.id];
                  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                  const completedSubs = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
                  const isOverdue = task.dueDate && task.status === 'pending' && new Date(task.dueDate) < new Date(new Date().setHours(0,0,0,0));

                  return (
                    <motion.div
                      key={task.id}
                      layoutId={`task-card-${task.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => toggleExpandTask(task.id)}
                      className={`backdrop-blur-md border rounded-2xl p-4 transition-all cursor-pointer ${
                        task.status === 'completed' 
                          ? isDarkMode
                            ? 'bg-white/5 border-white/5 opacity-55' 
                            : 'bg-slate-100/50 border-slate-200/50 opacity-60'
                          : isOverdue 
                            ? isDarkMode
                              ? 'border-rose-500/20 bg-rose-500/5' 
                              : 'border-rose-200 bg-rose-50/40'
                            : isDarkMode
                              ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                              : 'bg-white border-slate-200 hover:bg-slate-50/50 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Status Checkbox */}
                        <button
                          onClick={(e) => handleToggleTaskStatus(task, e)}
                          className={`mt-0.5 p-1 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                            isDarkMode 
                              ? 'hover:bg-white/10 text-white/40 hover:text-indigo-400' 
                              : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'
                          }`}
                        >
                          {task.status === 'completed' ? (
                            <CheckCircle2 className={`w-5.5 h-5.5 ${isDarkMode ? 'text-indigo-400 fill-indigo-400/10' : 'text-indigo-600 fill-indigo-50/50'}`} />
                          ) : (
                            <Circle className={`w-5.5 h-5.5 ${isDarkMode ? 'text-white/30 hover:text-white/50' : 'text-slate-300 hover:text-slate-500'}`} />
                          )}
                        </button>

                        {/* Task Title & Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            {/* Project Color & Name Tag */}
                            <div className="flex items-center gap-1.5">
                              {projectOfTask && (
                                <span className={`w-2 h-2 rounded-full ${COLOR_PALETTE.find(c => c.id === projectOfTask.color)?.dot || 'bg-slate-300'} ring-2 ${isDarkMode ? 'ring-white/10' : 'ring-slate-100'}`} />
                              )}
                              <span className={`text-[10px] font-bold font-mono uppercase tracking-wider transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                {projectOfTask?.name || 'Inbox'}
                              </span>
                            </div>

                            {/* Task Badges */}
                            <div className="flex items-center gap-1.5">
                              {/* Due Date Indicator */}
                              {task.dueDate && (
                                <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                  isOverdue 
                                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20' 
                                    : isDarkMode 
                                      ? 'bg-white/5 text-white/60 border border-white/5' 
                                      : 'bg-slate-100 text-slate-600 border border-slate-200/50'
                                }`}>
                                  <Clock className="w-3 h-3" />
                                  <span>{task.dueDate}</span>
                                  {isOverdue && <span className="text-[9px] font-bold uppercase tracking-wider">(Overdue)</span>}
                                </div>
                              )}

                              {/* Priority Tag */}
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                task.priority === 'high' 
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/20' 
                                  : task.priority === 'medium'
                                    ? isDarkMode 
                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                    : isDarkMode
                                      ? 'bg-white/5 text-white/50 border-white/5'
                                      : 'bg-slate-100 text-slate-500 border-slate-200/50'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                          </div>

                          {/* Main Title */}
                          <h3 className={`text-sm font-semibold leading-snug break-words transition-colors duration-300 ${
                            task.status === 'completed' 
                              ? isDarkMode 
                                ? 'line-through text-slate-400 decoration-slate-400' 
                                : 'line-through text-slate-400 decoration-slate-350'
                              : isDarkMode 
                                ? 'text-white' 
                                : 'text-slate-800'
                          }`}>
                            {task.title}
                          </h3>

                          {/* Quick Stats: Subtasks Progress */}
                          {hasSubtasks && (
                            <div className={`flex items-center gap-2 mt-2 px-2.5 py-1 rounded-xl w-fit border transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-white/5 border-white/5' 
                                : 'bg-slate-50 border-slate-200/60'
                            }`}>
                              <CheckSquare className={`w-3.5 h-3.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                              <span className={`text-[11px] font-mono transition-colors duration-300 ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>
                                Checklist: {completedSubs}/{task.subtasks.length} items ({Math.round((completedSubs / task.subtasks.length) * 100)}%)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Operations */}
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          {task.status !== 'archived' && (
                            <button
                              onClick={(e) => handleArchiveTask(task, e)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isDarkMode
                                  ? 'hover:bg-white/10 text-white/40 hover:text-amber-300'
                                  : 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'
                              }`}
                              title="Archive task"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => openEditTaskModal(task, e)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isDarkMode 
                                ? 'hover:bg-white/10 text-white/40 hover:text-white' 
                                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-800'
                            }`}
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTask(task.id, e)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isDarkMode 
                                ? 'hover:bg-rose-500/10 text-white/40 hover:text-rose-400' 
                                : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                            }`}
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* EXPANDABLE AREA: Subtasks and Description */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`overflow-hidden mt-4 pt-4 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}
                          >
                            {/* Description Box */}
                            {task.description.trim() ? (
                              <div className="mb-4">
                                <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Detailed Description</h4>
                                <p className={`text-xs leading-relaxed p-3 rounded-xl border transition-colors duration-300 ${
                                  isDarkMode 
                                    ? 'text-slate-300 bg-white/5 border-white/5' 
                                    : 'text-slate-600 bg-slate-50 border-slate-200/60'
                                }`}>
                                  {task.description}
                                </p>
                              </div>
                            ) : null}

                            {/* Subtask list */}
                            {hasSubtasks ? (
                              <div>
                                <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-2 font-mono ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Nested Checklist</h4>
                                <div className={`space-y-1.5 p-2.5 rounded-xl border transition-colors duration-300 ${
                                  isDarkMode 
                                    ? 'bg-white/5 border-white/5' 
                                    : 'bg-slate-50 border-slate-200/60'
                                }`}>
                                  {task.subtasks.map(sub => (
                                    <button
                                      key={sub.id}
                                      onClick={(e) => handleToggleSubtask(task, sub.id, e)}
                                      className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-xl transition-all text-left ${
                                        isDarkMode 
                                          ? 'hover:bg-white/10' 
                                          : 'hover:bg-slate-200/40'
                                      }`}
                                    >
                                      {sub.completed ? (
                                        <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                                      ) : (
                                        <Circle className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-white/30' : 'text-slate-300'}`} />
                                      )}
                                      <span className={`text-xs ${
                                        sub.completed 
                                          ? isDarkMode 
                                            ? 'line-through text-white/40 decoration-white/30' 
                                            : 'line-through text-slate-400 decoration-slate-300'
                                          : isDarkMode 
                                            ? 'text-slate-200 font-medium' 
                                            : 'text-slate-700 font-medium'
                                      }`}>
                                        {sub.title}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              !task.description.trim() && (
                                <p className={`text-[11px] italic transition-colors duration-300 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>No checklist items or description provided.</p>
                              )
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

      </main>

      {/* CREATE PROJECT LIST MODAL */}
      <AnimatePresence>
        {isNewProjectOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`backdrop-blur-xl rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative border transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-white/10' 
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base font-bold flex items-center gap-2 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <FolderPlus className="w-5 h-5 text-indigo-500" />
                  <span>Create Custom List</span>
                </h3>
                <button onClick={() => setIsNewProjectOpen(false)} className={`p-1 rounded-lg transition-colors cursor-pointer ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>List Name</label>
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., Grocery Shopping"
                    maxLength={100}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs transition-all ${
                      isDarkMode 
                        ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-white/25 focus:bg-white/10' 
                        : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 focus:bg-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase font-mono block mb-2 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Category Color</label>
                  <div className="grid grid-cols-6 gap-2">
                    {COLOR_PALETTE.map(color => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setNewProjectColor(color.id)}
                        className={`aspect-square rounded-full flex items-center justify-center relative ${color.bg} ${
                          newProjectColor === color.id ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-lg scale-105' : 'hover:scale-105'
                        } transition-transform`}
                        title={color.name}
                      >
                        {newProjectColor === color.id && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsNewProjectOpen(false)}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${isDarkMode ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer border border-indigo-500/30"
                  >
                    Create List
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE / EDIT TASK MODAL */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`backdrop-blur-xl rounded-[2rem] w-full max-w-lg p-6 shadow-2xl my-8 relative max-h-[90vh] overflow-y-auto border transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-white/10' 
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className={`text-base font-bold flex items-center gap-2 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <ListTodo className="w-5.5 h-5.5 text-indigo-500" />
                  <span>{editingTask ? 'Edit Action Item' : 'Add New Task'}</span>
                </h3>
                <button onClick={() => setIsTaskModalOpen(false)} className={`p-1 rounded-lg transition-colors cursor-pointer ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTask} className="space-y-4">
                
                {/* 1. Task Title */}
                <div>
                  <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Task Title *</label>
                  <input
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="What needs to be done?"
                    maxLength={200}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs transition-all ${
                      isDarkMode 
                        ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-white/25 focus:bg-white/10' 
                        : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 focus:bg-white'
                    }`}
                  />
                </div>

                {/* 2. Task Description */}
                <div>
                  <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Description (Optional)</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Details, steps, notes, or explanations..."
                    maxLength={2000}
                    rows={2.5}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs transition-all resize-none ${
                      isDarkMode 
                        ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-white/25 focus:bg-white/10' 
                        : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 focus:bg-white'
                    }`}
                  />
                </div>

                {/* 3. Dropdowns Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Select Project/List */}
                  <div>
                    <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Assign to List *</label>
                    <select
                      value={taskForm.projectId}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, projectId: e.target.value }))}
                      required
                      className={`w-full rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer ${
                        isDarkMode 
                          ? 'bg-white/5 border border-white/10 text-white/80' 
                          : 'bg-slate-50 border border-slate-200 text-slate-700'
                      }`}
                    >
                      {projects.map(proj => (
                        <option key={proj.id} value={proj.id} className="text-slate-900 bg-white" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>{proj.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Priority Selector */}
                  <div>
                    <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Priority Level *</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['low', 'medium', 'high'].map(prio => (
                        <button
                          key={prio}
                          type="button"
                          onClick={() => setTaskForm(prev => ({ ...prev, priority: prio as any }))}
                          className={`py-2 px-1 rounded-xl text-xs font-semibold capitalize border transition-all cursor-pointer ${
                            taskForm.priority === prio
                              ? prio === 'high'
                                ? 'bg-rose-500/20 border-rose-500/30 text-rose-300 font-bold'
                                : prio === 'medium'
                                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-600 font-bold'
                                  : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-600 font-bold'
                              : isDarkMode 
                                ? 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white' 
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                          }`}
                        >
                          {prio}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Due Date Selector */}
                <div>
                  <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Due Date</label>
                  <div className="relative">
                    <Calendar className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                      style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                        isDarkMode 
                          ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-white/25 focus:bg-white/10' 
                          : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 focus:bg-white'
                      }`}
                    />
                  </div>
                </div>

                {/* 5. Subtasks Builder */}
                <div>
                  <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 transition-colors duration-300 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Checklist Items</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFormSubtask(); } }}
                      placeholder="e.g., Gather documentation, email team..."
                      className={`flex-1 px-3 py-2 rounded-xl text-xs transition-all ${
                        isDarkMode 
                          ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-white/25' 
                          : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleAddFormSubtask}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isDarkMode 
                          ? 'bg-white/15 hover:bg-white/25 border-white/10 text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                      }`}
                    >
                      <Plus className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  {/* Added subtasks list */}
                  {taskForm.subtasks.length > 0 && (
                    <div className={`mt-2.5 space-y-1.5 p-3 rounded-xl max-h-36 overflow-y-auto border transition-colors duration-300 ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/5' 
                        : 'bg-slate-50 border-slate-200/60'
                    }`}>
                      {taskForm.subtasks.map(sub => (
                        <div key={sub.id} className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/5' 
                            : 'bg-white border-slate-200/50'
                        }`}>
                          <span className={`font-medium truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{sub.title}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFormSubtask(sub.id)}
                            className={`transition-colors p-0.5 cursor-pointer ${isDarkMode ? 'text-white/40 hover:text-rose-400' : 'text-slate-400 hover:text-rose-600'}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. Form Submit Controls */}
                <div className={`pt-3 border-t flex justify-end gap-2.5 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                      isDarkMode 
                        ? 'text-white/60 hover:text-white hover:bg-white/5' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer border border-indigo-500/30"
                  >
                    {editingTask ? 'Save Changes' : 'Create Task'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROFILE MODAL */}
      <AnimatePresence>
        {isProfileOpen && user && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`backdrop-blur-xl rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative border transition-all duration-300 ${
                isDarkMode ? 'bg-slate-900/90 border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <UserCircle className="w-5 h-5 text-indigo-500" />
                  <span>Your Profile</span>
                </h3>
                <button onClick={() => setIsProfileOpen(false)} className={`p-1 rounded-lg cursor-pointer ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <span className={`text-[10px] font-bold uppercase font-mono block mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Full Name</span>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user.fullName}</p>
                </div>
                <div>
                  <span className={`text-[10px] font-bold uppercase font-mono block mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Username</span>
                  <p className={`text-sm font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>@{user.username}</p>
                </div>
                {user.email && (
                  <div>
                    <span className={`text-[10px] font-bold uppercase font-mono block mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Email</span>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{user.email}</p>
                  </div>
                )}
                <div>
                  <span className={`text-[10px] font-bold uppercase font-mono block mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Member Since</span>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full mt-5 py-2.5 text-xs font-semibold bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
