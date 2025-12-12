
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Video, DoorClosed, Menu, Bell, X, Power, FileSpreadsheet, Trash2, Check, AlertCircle, CheckCircle2, Shield, Loader2, LogOut, Users, PlusSquare, Calendar, MessageSquare, Settings, Camera as CameraIcon, Save, Briefcase, Mail, User as UserIcon, Image as ImageIcon, Sun, Moon } from 'lucide-react';
import { AppData, Camera, AccessPoint, Status, User, PublicDocument, Note, Meeting, CalendarEvent, ProcessedWorker } from './types';
import { DEFAULT_CAMERAS_CSV, DEFAULT_ACCESS_CSV } from './constants';
import { authService } from './services/auth';
import Dashboard from './components/Dashboard';
import CameraList from './components/CameraList';
import AccessControlList from './components/AccessControlList';
import Importer from './components/Importer';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import Registration from './components/Registration';
import OnboardingTour from './components/OnboardingTour';
import Organizer from './components/Organizer';
import Chat from './components/Chat';
import ThirdPartyStatus from './components/ThirdPartyStatus';

interface Notification {
  id: string;
  message: string;
  type: 'alert' | 'success' | 'info';
  timestamp: string;
  read: boolean;
}

const App: React.FC = () => {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'cameras' | 'access' | 'organizer' | 'chat' | 'data' | 'users' | 'registration' | 'third-party'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showTour, setShowTour] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Profile Edit State (Global)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editProfile, setEditProfile] = useState({
      name: '',
      jobTitle: '',
      bio: '',
      photoURL: '',
      bannerURL: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Data State (Source of Truth)
  const [data, setData] = useState<AppData>({
    cameras: [],
    accessPoints: [],
    documents: [],
    notes: [],
    meetings: [],
    events: [],
    lastSync: '-'
  });

  // Third Party Workers State (Lifted Up)
  const [thirdPartyWorkers, setThirdPartyWorkers] = useState<ProcessedWorker[]>([]);

  // Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // --- THEME EFFECT ---
  useEffect(() => {
      const savedTheme = localStorage.getItem('controlvision_theme');
      if (savedTheme === 'light') {
          setTheme('light');
          document.documentElement.classList.remove('dark');
      } else {
          setTheme('dark');
          document.documentElement.classList.add('dark');
      }
  }, []);

  const toggleTheme = () => {
      const newTheme = theme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      localStorage.setItem('controlvision_theme', newTheme);
      if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  };

  // --- AUTH & INIT EFFECTS ---
  
  // 1. Check Login (Firebase Async)
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthChanges((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      // Update local edit form when user data updates
      if (currentUser) {
          setEditProfile({
              name: currentUser.name,
              jobTitle: currentUser.jobTitle || '',
              bio: currentUser.bio || '',
              photoURL: currentUser.photoURL || '',
              bannerURL: currentUser.bannerURL || ''
          });

          // Check for first-time login tour logic
          const tourKey = `controlvision_tour_seen_${currentUser.uid}`;
          const hasSeenTour = localStorage.getItem(tourKey);
          if (!hasSeenTour) {
              setShowTour(true);
          } else {
              setShowTour(false);
          }
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Load Data from LocalStorage
  useEffect(() => {
    const savedData = localStorage.getItem('controlvision_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Ensure new arrays exists for older saved data
        setData({
            ...parsed,
            documents: parsed.documents || [],
            notes: parsed.notes || [],
            meetings: parsed.meetings || [],
            events: parsed.events || []
        });
      } catch (e) {
        console.error("Failed to load data", e);
      }
    }
  }, []);

  // 3. Save Data to LocalStorage on Change
  useEffect(() => {
    if (data.cameras.length > 0 || data.accessPoints.length > 0 || data.documents.length > 0 || data.notes.length > 0 || data.meetings.length > 0 || data.events.length > 0) {
        localStorage.setItem('controlvision_data', JSON.stringify(data));
    }
  }, [data]);

  // 3.1 Check Expirations & Meetings on Load
  useEffect(() => {
    const today = new Date();
    
    // Check Documents
    if (data.documents.length > 0) {
        data.documents.forEach(doc => {
            const expDate = new Date(doc.expirationDate);
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                const msg = `ALERTA: Documento "${doc.name}" venceu em ${expDate.toLocaleDateString('pt-BR')}!`;
                setNotifications(prev => {
                    if (prev.some(n => n.message === msg)) return prev;
                    return [{
                        id: Date.now().toString() + Math.random(),
                        message: msg,
                        type: 'alert',
                        timestamp: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
                        read: false
                    }, ...prev];
                });
            } else if (diffDays <= 30) {
                const msg = `AVISO: Documento "${doc.name}" vence em ${diffDays} dias.`;
                setNotifications(prev => {
                    if (prev.some(n => n.message === msg)) return prev;
                    return [{
                        id: Date.now().toString() + Math.random(),
                        message: msg,
                        type: 'info',
                        timestamp: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
                        read: false
                    }, ...prev];
                });
            }
        });
    }

    // Check Meetings Today
    const todayStr = today.toISOString().split('T')[0];
    const todaysMeetings = data.meetings.filter(m => m.date === todayStr);
    if (todaysMeetings.length > 0) {
        const msg = `Você tem ${todaysMeetings.length} reunião(ões) agendada(s) para hoje.`;
        setNotifications(prev => {
             if (prev.some(n => n.message === msg)) return prev;
             return [{
                 id: Date.now().toString() + Math.random(),
                 message: msg,
                 type: 'info',
                 timestamp: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
                 read: false
             }, ...prev];
        });
    }

  }, [data.documents, data.meetings]);

  // 4. Route Guard (Redirect non-admins)
  useEffect(() => {
      if (!authLoading && user && user.role !== 'admin') {
          if (activeTab === 'data' || activeTab === 'users' || activeTab === 'registration') {
              setActiveTab('dashboard');
              addNotification("Acesso negado: Área restrita a administradores.", 'alert');
          }
      }
  }, [activeTab, user, authLoading]);


  const handleLogin = (loggedInUser: User) => {
    // Handled by subscribeToAuthChanges
  };

  const handleLogout = () => {
    authService.logout();
    setActiveTab('dashboard');
  };

  const handleTourFinish = () => {
      if (user) {
          const tourKey = `controlvision_tour_seen_${user.uid}`;
          localStorage.setItem(tourKey, 'true'); // Persist immediately
      }
      setShowTour(false);
  };

  // Check Admin Role
  const isAdmin = user?.role === 'admin';

  // Responsive Sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTabChange = (tab: typeof activeTab) => {
    if ((tab === 'data' || tab === 'users' || tab === 'registration') && !isAdmin) {
        addNotification("Acesso negado.", 'alert');
        return;
    }
    setActiveTab(tab);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // --- PROFILE HANDLERS ---
  const handleSaveProfile = async () => {
      if (!user) return;
      setProfileSaving(true);
      try {
          await authService.updateUserProfile(user.uid, editProfile);
          addNotification('Perfil atualizado com sucesso!', 'success');
          setShowProfileModal(false);
      } catch (err) {
          console.error(err);
          addNotification('Erro ao atualizar perfil.', 'alert');
      } finally {
          setProfileSaving(false);
      }
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'photoURL' | 'bannerURL') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
          alert("A imagem é muito grande. Tente uma imagem menor que 2MB.");
          return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
          if (evt.target?.result) {
              setEditProfile(prev => ({ ...prev, [field]: evt.target?.result as string }));
          }
      };
      reader.readAsDataURL(file);
    }
  };

  // --- CRUD OPERATIONS ---

  // Import (Bulk Replace)
  const handleImportData = (cameras: Camera[], accessPoints: AccessPoint[]) => {
      const now = new Date();
      const formattedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      const newData = {
          ...data, // Keep documents, notes, meetings, etc
          cameras,
          accessPoints,
          lastSync: formattedTime
      };
      
      setData(newData);
      addNotification("Dados importados com sucesso.", 'success');
  };

  // Camera CRUD
  const handleAddCamera = (cam: Camera) => {
      setData(prev => ({ ...prev, cameras: [...prev.cameras, cam] }));
      addNotification(`Câmera ${cam.name} adicionada.`, 'success');
  };
  
  const handleEditCamera = (cam: Camera) => {
      setData(prev => ({
          ...prev,
          cameras: prev.cameras.map(c => c.uuid === cam.uuid ? cam : c)
      }));
      addNotification(`Câmera ${cam.name} atualizada.`, 'info');
  };

  const handleDeleteCamera = (uuid: string) => {
      setData(prev => ({
          ...prev,
          cameras: prev.cameras.filter(c => c.uuid !== uuid)
      }));
      addNotification(`Câmera removida.`, 'alert');
  };

  // Access CRUD
  const handleAddAccess = (ap: AccessPoint) => {
      setData(prev => ({ ...prev, accessPoints: [...prev.accessPoints, ap] }));
      addNotification(`Acesso ${ap.name} adicionado.`, 'success');
  };

  const handleEditAccess = (ap: AccessPoint) => {
      setData(prev => ({
          ...prev,
          accessPoints: prev.accessPoints.map(a => a.uuid === ap.uuid ? ap : a)
      }));
      addNotification(`Acesso ${ap.name} atualizado.`, 'info');
  };

  const handleDeleteAccess = (uuid: string) => {
      setData(prev => ({
          ...prev,
          accessPoints: prev.accessPoints.filter(a => a.uuid !== uuid)
      }));
      addNotification(`Acesso removido.`, 'alert');
  };
  
  // Document CRUD
  const handleAddDocument = (doc: PublicDocument) => {
      setData(prev => ({ ...prev, documents: [...prev.documents, doc] }));
      addNotification(`Documento ${doc.name} registrado.`, 'success');
  };
  
  const handleDeleteDocument = (uuid: string) => {
      setData(prev => ({ ...prev, documents: prev.documents.filter(d => d.uuid !== uuid) }));
      addNotification(`Documento removido.`, 'info');
  };

  // --- ORGANIZER CRUD ---
  // Notes
  const handleAddNote = (note: Note) => setData(prev => ({ ...prev, notes: [note, ...prev.notes] }));
  const handleToggleNote = (id: string) => setData(prev => ({ ...prev, notes: prev.notes.map(n => n.id === id ? { ...n, completed: !n.completed } : n) }));
  const handleEditNote = (id: string, content: string) => setData(prev => ({ ...prev, notes: prev.notes.map(n => n.id === id ? { ...n, content } : n) }));
  const handleDeleteNote = (id: string) => setData(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== id) }));
  
  // Meetings
  const handleAddMeeting = (meeting: Meeting) => setData(prev => ({ ...prev, meetings: [...prev.meetings, meeting] }));
  const handleDeleteMeeting = (id: string) => setData(prev => ({ ...prev, meetings: prev.meetings.filter(m => m.id !== id) }));

  // Events
  const handleAddEvent = (event: CalendarEvent) => setData(prev => ({ ...prev, events: [...prev.events, event] }));
  const handleDeleteEvent = (id: string) => setData(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }));


  // Toggle Status (Quick Edit)
  const handleToggleAccessStatus = (uuid: string) => {
    if (!isAdmin) return;
    setData(prev => {
      const target = prev.accessPoints.find(a => a.uuid === uuid);
      const newStatus = target?.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
      
      if (target) {
        const msg = `Acesso ${target.name} mudou para ${newStatus}`;
        addNotification(msg, newStatus === 'OFFLINE' ? 'alert' : 'success');
      }

      return {
        ...prev,
        accessPoints: prev.accessPoints.map(ap => 
            ap.uuid === uuid 
            ? { ...ap, status: newStatus } 
            : ap
        )
      };
    });
  };

  const handleToggleCameraStatus = (uuid: string) => {
    if (!isAdmin) return;
    setData(prev => {
      const target = prev.cameras.find(c => c.uuid === uuid);
      const newStatus = target?.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
      
      if (target) {
        const msg = `Câmera ${target.name} mudou para ${newStatus}`;
        addNotification(msg, newStatus === 'OFFLINE' ? 'alert' : 'success');
      }

      return {
        ...prev,
        cameras: prev.cameras.map(c => 
            c.uuid === uuid 
            ? { ...c, status: newStatus } 
            : c
        )
      };
    });
  };

  const handleFullReset = () => {
    if(!window.confirm("Isso apagará todos os dados do sistema. Continuar?")) return;
    setData({ cameras: [], accessPoints: [], documents: [], notes: [], meetings: [], events: [], lastSync: '-' });
    localStorage.removeItem('controlvision_data');
    setNotifications([]);
    setActiveTab('dashboard'); 
  };

  // Notifications logic
  const addNotification = (message: string, type: 'alert' | 'success' | 'info') => {
      const newNote: Notification = {
          id: Date.now().toString(),
          message,
          type,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          read: false
      };
      setNotifications(prev => [newNote, ...prev].slice(0, 50));
  };
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const unreadCount = notifications.filter(n => !n.read).length;

  // --- RENDER 1: LOADING ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
      </div>
    );
  }

  // --- RENDER 2: LOGIN ---
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // --- RENDER 3: DASHBOARD / ACTIVATED ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans overflow-hidden transition-colors duration-300">
      
      {/* ONBOARDING TOUR */}
      {showTour && (
          <OnboardingTour role={user.role} onFinish={handleTourFinish} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        w-64 lg:translate-x-0 lg:static lg:w-64 flex flex-col
      `}>
        
        {/* BRAND HEADER */}
        <div className="flex flex-col items-center justify-center py-8 px-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 relative">
            <div 
                onClick={() => handleTabChange('dashboard')}
                className="flex flex-col items-center group transform transition-transform hover:scale-105 duration-300 cursor-pointer"
            >
                <Shield className="w-12 h-12 text-amber-500 dark:text-amber-400 mb-3 fill-amber-400/20 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
                <h1 className="text-5xl font-black text-amber-500 dark:text-amber-400 tracking-tighter leading-none drop-shadow-xl mb-4 font-sans">
                    CCOS
                </h1>
                <div className="flex items-center gap-2">
                     <div className="bg-white border border-slate-200 dark:border-0 px-2 py-0.5 rounded-[3px] h-7 flex items-center justify-center shadow-md">
                        <span className="text-[8px] font-extrabold text-red-700 leading-none text-center tracking-tighter">UNILOG<br/>EXPRESS</span>
                     </div>
                     <div className="bg-white border border-slate-200 dark:border-0 px-2 py-0.5 rounded-[3px] h-7 flex items-center justify-center shadow-md">
                        <span className="text-[8px] font-extrabold text-cyan-600 leading-none text-center tracking-tighter">4ELOS<br/>DISTRIB.</span>
                     </div>
                </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white absolute top-2 right-2">
                <X size={20} />
            </button>
        </div>
        
        {/* User Info Sidebar - CLICKABLE FOR EDIT */}
        <div 
            className="px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group relative"
            onClick={() => setShowProfileModal(true)}
            title="Clique para editar perfil"
        >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700`}>
                {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                    <span className={`text-xs font-bold ${isAdmin ? 'text-amber-500' : 'text-blue-500'}`}>{user.name.charAt(0)}</span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{user.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {user.jobTitle || (isAdmin ? 'Administrador' : 'Visualizador')}
                </p>
            </div>
            <Settings size={14} className="text-slate-400 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-white transition-colors opacity-0 group-hover:opacity-100 absolute right-2" />
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          <button 
            onClick={() => handleTabChange('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <LayoutDashboard size={20} className="shrink-0" />
            <span>Dashboard</span>
          </button>

          <button 
            onClick={() => handleTabChange('cameras')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'cameras' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Video size={20} className="shrink-0" />
            <span>Câmeras</span>
            {data.cameras.length > 0 && <span className="ml-auto text-xs bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">{data.cameras.length}</span>}
          </button>

          <button 
            onClick={() => handleTabChange('access')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'access' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <DoorClosed size={20} className="shrink-0" />
            <span>Acessos</span>
            {data.accessPoints.length > 0 && <span className="ml-auto text-xs bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">{data.accessPoints.length}</span>}
          </button>

          <button 
            onClick={() => handleTabChange('third-party')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'third-party' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Briefcase size={20} className="shrink-0" />
            <span>Status Terceirizados</span>
          </button>
          
          <button 
            onClick={() => handleTabChange('organizer')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'organizer' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Calendar size={20} className="shrink-0" />
            <span>Agenda e Notas</span>
          </button>

          <button 
            onClick={() => handleTabChange('chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'chat' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <MessageSquare size={20} className="shrink-0" />
            <span>Chat da Equipe</span>
          </button>

          {/* Moved Central de Cadastro Button Here */}
          {isAdmin && (
            <button 
              onClick={() => handleTabChange('registration')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'registration' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <PlusSquare size={20} className="shrink-0" />
              <span>Central de Cadastro</span>
            </button>
          )}

          {/* ADMIN SECTIONS */}
          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Administração</p>
                
                <button 
                  onClick={() => handleTabChange('data')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'data' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <FileSpreadsheet size={20} className="shrink-0" />
                  <span>Fonte de Dados</span>
                </button>

                <button 
                  onClick={() => handleTabChange('users')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <Users size={20} className="shrink-0" />
                  <span>Gerenciar Usuários</span>
                </button>
            </div>
          )}
        </nav>
        
        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
           <button 
               onClick={handleLogout}
               className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all text-sm"
            >
               <LogOut size={16} className="shrink-0" />
               <span>Sair</span>
           </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 w-full relative">
        
        {/* Header */}
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
             <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Menu size={24} />
             </button>
             {/* Mobile Logo Simplified */}
             <div 
                onClick={() => handleTabChange('dashboard')}
                className="flex items-center gap-2 lg:hidden cursor-pointer"
             >
                <Shield className="w-5 h-5 text-amber-500 dark:text-amber-400 fill-amber-400/20" />
                <span className="text-xl font-black text-amber-500 dark:text-amber-400 tracking-tighter">CCOS</span>
             </div>
          </div>
          
          <div className="flex items-center gap-4 relative">
             <div className="hidden sm:flex px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Atualizado: {data.lastSync}
             </div>
             
             {/* Theme Toggle */}
             <button
                onClick={toggleTheme}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                title={theme === 'dark' ? "Modo Claro" : "Modo Escuro"}
             >
                 {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>

             {/* Notification Bell */}
             <div className="relative">
                <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none"
                >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                       <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white border border-white dark:border-slate-900">
                           {unreadCount > 9 ? '9+' : unreadCount}
                       </span>
                    )}
                </button>

                {/* Dropdown Menu */}
                {showNotifications && (
                    <>
                        <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setShowNotifications(false)}
                        />
                        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notificações</span>
                                {notifications.length > 0 && (
                                    <button 
                                        onClick={markAllRead}
                                        className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                    >
                                        <Check size={12} /> Marcar lidas
                                    </button>
                                )}
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 text-xs">
                                        <Bell size={24} className="mx-auto mb-2 opacity-30" />
                                        Nenhuma notificação recente
                                    </div>
                                ) : (
                                    notifications.map((note) => (
                                        <div 
                                            key={note.id} 
                                            className={`p-3 border-b border-slate-200/50 dark:border-slate-800/50 last:border-0 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors flex gap-3 relative group
                                                ${!note.read ? 'bg-blue-50/50 dark:bg-slate-800/20' : ''}
                                            `}
                                        >
                                            <div className={`mt-1 shrink-0`}>
                                                {note.type === 'alert' ? (
                                                    <AlertCircle size={16} className="text-rose-500" />
                                                ) : (
                                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs ${!note.read ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    {note.message}
                                                </p>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-600 mt-1 block">{note.timestamp}</span>
                                            </div>
                                            <button 
                                                onClick={() => removeNotification(note.id)}
                                                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-all"
                                                title="Remover"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
             </div>
          </div>
        </header>

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6 pb-10">
            
            {activeTab === 'dashboard' && <Dashboard data={data} thirdPartyWorkers={thirdPartyWorkers} />}
            
            {activeTab === 'cameras' && (
                <CameraList 
                  cameras={data.cameras} 
                  onToggleStatus={handleToggleCameraStatus}
                  onAdd={isAdmin ? handleAddCamera : undefined}
                  onEdit={isAdmin ? handleEditCamera : undefined}
                  onDelete={isAdmin ? handleDeleteCamera : undefined}
                  readOnly={!isAdmin} 
                />
            )}
            
            {activeTab === 'access' && (
                <AccessControlList 
                    accessPoints={data.accessPoints} 
                    onToggleStatus={handleToggleAccessStatus}
                    onAdd={isAdmin ? handleAddAccess : undefined}
                    onEdit={isAdmin ? handleEditAccess : undefined}
                    onDelete={isAdmin ? handleDeleteAccess : undefined}
                    readOnly={!isAdmin}
                />
            )}
            
            {activeTab === 'third-party' && (
                <ThirdPartyStatus 
                    workers={thirdPartyWorkers}
                    setWorkers={setThirdPartyWorkers}
                />
            )}
            
            {activeTab === 'organizer' && (
                <Organizer 
                    notes={data.notes}
                    meetings={data.meetings}
                    events={data.events}
                    onAddNote={handleAddNote}
                    onToggleNote={handleToggleNote}
                    onDeleteNote={handleDeleteNote}
                    onEditNote={handleEditNote}
                    onAddMeeting={handleAddMeeting}
                    onDeleteMeeting={handleDeleteMeeting}
                    onAddEvent={handleAddEvent}
                    onDeleteEvent={handleDeleteEvent}
                />
            )}

            {activeTab === 'chat' && user && (
                <Chat currentUser={user} />
            )}

            {activeTab === 'registration' && isAdmin && (
                <Registration 
                    onAddCamera={handleAddCamera}
                    onAddAccess={handleAddAccess}
                    onAddDocument={handleAddDocument}
                    onDeleteDocument={handleDeleteDocument}
                    documents={data.documents}
                />
            )}
            
            {activeTab === 'data' && isAdmin && (
              <Importer 
                onImport={handleImportData}
                onReset={handleFullReset}
                initialCameraCsv=""
                initialAccessCsv=""
              />
            )}

            {activeTab === 'users' && isAdmin && (
                <UserManagement />
            )}

          </div>
        </div>
      </main>

      {/* GLOBAL PROFILE EDIT MODAL */}
      {showProfileModal && (
            <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex justify-end animate-fade-in">
                <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto relative">
                    <button 
                        onClick={() => setShowProfileModal(false)}
                        className="absolute top-4 right-4 z-20 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    {/* Banner Section */}
                    <div className="relative h-40 bg-gradient-to-r from-blue-900 to-slate-900">
                        {editProfile.bannerURL ? (
                            <img src={editProfile.bannerURL} alt="Banner" className="w-full h-full object-cover opacity-80" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-30">
                                <ImageIcon size={48} className="text-white" />
                            </div>
                        )}
                        <label className="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full cursor-pointer text-white transition-colors" title="Alterar Capa">
                            <CameraIcon size={16} />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleProfileImageUpload(e, 'bannerURL')} />
                        </label>
                    </div>

                    {/* Avatar Section */}
                    <div className="px-6 relative -mt-16 mb-4 flex flex-col items-center">
                         <div className="relative group">
                            {editProfile.photoURL ? (
                                <img src={editProfile.photoURL} alt="Avatar" className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-slate-900 shadow-xl" />
                            ) : (
                                <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-white dark:border-slate-900 flex items-center justify-center text-slate-400 font-bold text-4xl shadow-xl">
                                    {editProfile.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" title="Alterar Foto">
                                <CameraIcon size={24} />
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleProfileImageUpload(e, 'photoURL')} />
                            </label>
                         </div>
                    </div>

                    {/* Form Fields */}
                    <div className="px-6 pb-8 space-y-5">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-6">Editar Meu Perfil</h3>
                        
                        <div>
                            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                                <UserIcon size={14} /> Nome Completo
                            </label>
                            <input 
                                type="text" 
                                value={editProfile.name}
                                onChange={e => setEditProfile({...editProfile, name: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                                <Briefcase size={14} /> Cargo / Função (Exibido na Sidebar)
                            </label>
                            <input 
                                type="text" 
                                placeholder="Ex: Supervisor Operacional"
                                value={editProfile.jobTitle}
                                onChange={e => setEditProfile({...editProfile, jobTitle: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                         <div>
                            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                                <Mail size={14} /> Bio / Status
                            </label>
                            <textarea 
                                placeholder="Escreva algo sobre você..."
                                value={editProfile.bio}
                                onChange={e => setEditProfile({...editProfile, bio: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none h-24 resize-none"
                            />
                        </div>

                        <button 
                            onClick={handleSaveProfile}
                            disabled={profileSaving}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 mt-4"
                        >
                            {profileSaving ? 'Salvando...' : <><Save size={18} /> Salvar Alterações</>}
                        </button>
                    </div>
                </div>
            </div>
      )}

    </div>
  );
};
export default App;
