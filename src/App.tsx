import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType, testConnection } from './services/firestoreService';
import { fetchArtistStreams, ArtistAnalytics } from './services/streamService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  Music, 
  CheckSquare, 
  Calendar, 
  Database, 
  BarChart3, 
  Plus, 
  LogOut, 
  ChevronRight, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Instagram, 
  Twitter, 
  Facebook,
  MoreVertical,
  ExternalLink,
  Search,
  LayoutDashboard,
  Settings,
  Bell,
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, isAfter, isBefore } from 'date-fns';
import { AIManager } from './components/AIManager';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface Project {
  id: string;
  name: string;
  artistId: string;
  artistName: string;
  projectType: 'album' | 'mixtape' | 'ep' | 'lp' | 'single';
  releaseDate: string;
  status: 'planning' | 'recording' | 'mixing' | 'mastering' | 'released';
  distributionStatus: 'not_started' | 'submitted' | 'processing' | 'live' | 'takedown_requested';
  isrc?: string;
  upc?: string;
  label?: string;
  ownerId: string;
  createdAt: any;
}

interface Artist {
  id: string;
  name: string;
  genre?: string;
  bio?: string;
  ownerId: string;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  deadline: string;
  category?: string;
}

interface CampaignPost {
  id: string;
  projectId: string;
  platform: 'instagram' | 'twitter' | 'tiktok' | 'facebook';
  postType: 'feed' | 'story' | 'reel' | 'thread' | 'video';
  content: string;
  scheduledDate: string;
  status: 'draft' | 'scheduled' | 'posted';
}

interface Asset {
  id: string;
  projectId: string;
  name: string;
  type: 'audio' | 'image' | 'video' | 'document';
  url: string;
}

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: 'bg-zinc-100 text-zinc-950 hover:bg-zinc-200',
    secondary: 'bg-zinc-900 text-zinc-100 border border-zinc-800 hover:bg-zinc-800',
    ghost: 'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900',
    danger: 'bg-red-950/30 text-red-400 border border-red-900/50 hover:bg-red-900/40',
  };

  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn('bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm', className)} {...props}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'info' }) => {
  const variants = {
    default: 'bg-zinc-800 text-zinc-400',
    success: 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/50',
    warning: 'bg-amber-950/30 text-amber-400 border border-amber-900/50',
    info: 'bg-blue-950/30 text-blue-400 border border-blue-900/50',
  };

  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-transparent', variants[variant])}>
      {children}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [viewingArtistId, setViewingArtistId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'checklist' | 'campaign' | 'assets' | 'distribution' | 'analytics' | 'artists' | 'ai_manager'>('checklist');

  // Modal States
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Form States
  const [projectForm, setProjectForm] = useState({ 
    name: '', 
    artistId: '', 
    type: 'album' as Project['projectType'],
    isrc: '',
    upc: '',
    label: ''
  });
  const [artistForm, setArtistForm] = useState({ name: '', genre: '', bio: '' });
  const [postForm, setPostForm] = useState({ platform: 'instagram' as CampaignPost['platform'], postType: 'feed' as CampaignPost['postType'], content: '' });
  const [assetForm, setAssetForm] = useState({ name: '', type: 'audio' as Asset['type'], url: '' });
  const [taskForm, setTaskForm] = useState({ title: '', deadline: format(addDays(new Date(), 7), 'yyyy-MM-dd') });

  // Analytics State
  const [artistAnalytics, setArtistAnalytics] = useState<ArtistAnalytics | null>(null);
  const [isSyncingAnalytics, setIsSyncingAnalytics] = useState(false);

  // Sub-collection states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [posts, setPosts] = useState<CampaignPost[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
    [projects, selectedProjectId]
  );

  const viewingArtist = useMemo(() => 
    artists.find(a => a.id === viewingArtistId), 
    [artists, viewingArtistId]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) testConnection();
    });
    return unsubscribe;
  }, []);

  // Fetch Projects
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(pList);
      if (pList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(pList[0].id);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'projects'));
    return unsubscribe;
  }, [user]);

  // Fetch Artists
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artists'), where('ownerId', '==', user.uid), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setArtists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Artist)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'artists'));
    return unsubscribe;
  }, [user]);

  // Fetch Sub-collections
  useEffect(() => {
    if (!selectedProjectId) return;

    const unsubTasks = onSnapshot(collection(db, `projects/${selectedProjectId}/tasks`), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `projects/${selectedProjectId}/tasks`));

    const unsubPosts = onSnapshot(collection(db, `projects/${selectedProjectId}/campaignPosts`), (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignPost)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `projects/${selectedProjectId}/campaignPosts`));

    const unsubAssets = onSnapshot(collection(db, `projects/${selectedProjectId}/assets`), (snapshot) => {
      setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `projects/${selectedProjectId}/assets`));

    return () => {
      unsubTasks();
      unsubPosts();
      unsubAssets();
    };
  }, [selectedProjectId]);

  // Fetch Analytics when project changes
  useEffect(() => {
    if (selectedProject && activeTab === 'analytics') {
      handleSyncAnalytics();
    }
  }, [selectedProjectId, activeTab]);

  const handleSyncAnalytics = async () => {
    if (!selectedProject) return;
    setIsSyncingAnalytics(true);
    try {
      const data = await fetchArtistStreams(selectedProject.artistName);
      setArtistAnalytics(data);
    } catch (error) {
      console.error("Analytics sync failed", error);
    } finally {
      setIsSyncingAnalytics(false);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectForm.name || !projectForm.artistId) return;

    const artist = artists.find(a => a.id === projectForm.artistId);
    if (!artist) return;

    try {
      await addDoc(collection(db, 'projects'), {
        name: projectForm.name,
        artistId: projectForm.artistId,
        artistName: artist.name,
        projectType: projectForm.type,
        releaseDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        status: 'planning',
        distributionStatus: 'not_started',
        isrc: projectForm.isrc || '',
        upc: projectForm.upc || '',
        label: projectForm.label || '',
        ownerId: user.uid,
        createdAt: Timestamp.now()
      });
      setIsProjectModalOpen(false);
      setProjectForm({ name: '', artistId: '', type: 'album', isrc: '', upc: '', label: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const handleCreateArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !artistForm.name) return;

    try {
      await addDoc(collection(db, 'artists'), {
        name: artistForm.name,
        genre: artistForm.genre,
        bio: artistForm.bio,
        ownerId: user.uid
      });
      setIsArtistModalOpen(false);
      setArtistForm({ name: '', genre: '', bio: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'artists');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !taskForm.title) return;

    try {
      await addDoc(collection(db, `projects/${selectedProjectId}/tasks`), {
        projectId: selectedProjectId,
        title: taskForm.title,
        description: "",
        status: 'todo',
        deadline: taskForm.deadline
      });
      setIsTaskModalOpen(false);
      setTaskForm({ title: '', deadline: format(addDays(new Date(), 7), 'yyyy-MM-dd') });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${selectedProjectId}/tasks`);
    }
  };

  const handleAIAddTask = async (aiTask: { title: string; description: string; category: string }) => {
    if (!selectedProjectId) return;
    try {
      await addDoc(collection(db, `projects/${selectedProjectId}/tasks`), {
        projectId: selectedProjectId,
        title: aiTask.title,
        description: aiTask.description,
        status: 'todo',
        deadline: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        category: aiTask.category
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${selectedProjectId}/tasks`);
    }
  };

  const handleToggleTask = async (task: Task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await updateDoc(doc(db, `projects/${selectedProjectId}/tasks`, task.id), {
        status: nextStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${selectedProjectId}/tasks/${task.id}`);
    }
  };

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !postForm.content) return;

    try {
      await addDoc(collection(db, `projects/${selectedProjectId}/campaignPosts`), {
        projectId: selectedProjectId,
        platform: postForm.platform,
        postType: postForm.postType,
        content: postForm.content,
        scheduledDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        status: 'scheduled'
      });
      setIsPostModalOpen(false);
      setPostForm({ platform: 'instagram', postType: 'feed', content: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${selectedProjectId}/campaignPosts`);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !assetForm.name || !assetForm.url) return;

    try {
      await addDoc(collection(db, `projects/${selectedProjectId}/assets`), {
        projectId: selectedProjectId,
        name: assetForm.name,
        type: assetForm.type,
        url: assetForm.url
      });
      setIsAssetModalOpen(false);
      setAssetForm({ name: '', type: 'audio', url: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${selectedProjectId}/assets`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-zinc-800 border-t-zinc-100 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-zinc-100 rounded-3xl flex items-center justify-center text-zinc-950 shadow-2xl shadow-zinc-100/10">
              <Music size={40} />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tighter">StudioDrop</h1>
            <p className="text-zinc-400 text-lg">Professional mixtape release & campaign management.</p>
          </div>
          <Button onClick={handleLogin} className="w-full py-4 text-lg rounded-2xl">
            Sign in with Google
          </Button>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Industry Standard Tools</p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-zinc-100 flex font-sans">
        {/* Sidebar */}
        <aside className="w-72 border-r border-zinc-800 flex flex-col hidden lg:flex">
          <div className="p-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-950">
              <Music size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">StudioDrop</span>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <div className="px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Main</div>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-zinc-100 bg-zinc-900 rounded-xl">
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab('artists')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                activeTab === 'artists' ? "bg-zinc-900 text-zinc-100" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              )}
            >
              <UserIcon size={20} />
              <span className="font-medium">Artists</span>
            </button>
            <button 
              onClick={() => setActiveTab('ai_manager')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                activeTab === 'ai_manager' ? "bg-zinc-900 text-zinc-100" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              )}
            >
              <Sparkles size={20} />
              <span className="font-medium">AI Manager</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-colors">
              <Bell size={20} />
              <span className="font-medium">Notifications</span>
            </button>
            
            <div className="pt-8 px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Projects</div>
            <div className="space-y-1">
              {projects.map(p => (
                <button 
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group",
                    selectedProjectId === p.id ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                  )}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Music size={18} className={selectedProjectId === p.id ? "text-zinc-950" : "text-zinc-500"} />
                    <div className="flex flex-col truncate">
                      <span className="font-bold truncate">{p.name}</span>
                      <span className={cn("text-[10px] truncate", selectedProjectId === p.id ? "text-zinc-800" : "text-zinc-500")}>
                        {p.artistName}
                      </span>
                    </div>
                  </div>
                  {selectedProjectId === p.id && <ChevronRight size={16} />}
                </button>
              ))}
              <button 
                onClick={() => setIsProjectModalOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-all border border-dashed border-zinc-800 mt-2"
              >
                <Plus size={18} />
                <span className="font-medium">New Project</span>
              </button>
            </div>
          </nav>

          <div className="p-4 border-t border-zinc-800">
            <div className="flex items-center gap-3 p-4 bg-zinc-900 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                {user.photoURL ? <img src={user.photoURL} alt="" /> : <UserIcon size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{user.displayName}</p>
                <p className="text-xs text-zinc-500 truncate">Label Manager</p>
              </div>
              <button onClick={() => signOut(auth)} className="text-zinc-500 hover:text-red-400 transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="h-24 border-b border-zinc-800 flex items-center justify-between px-8 bg-black/50 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {selectedProject ? selectedProject.name : "Select a Project"}
                  </h2>
                  {selectedProject && (
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{selectedProject.status}</Badge>
                      <Badge variant={selectedProject.distributionStatus === 'live' ? 'success' : 'warning'}>
                        {selectedProject.distributionStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                  )}
                </div>
                {selectedProject && (
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-medium">
                    <span className="flex items-center gap-1">
                      <UserIcon size={12} />
                      {selectedProject.artistName}
                    </span>
                    {selectedProject.label && (
                      <span className="flex items-center gap-1">
                        <Database size={12} />
                        {selectedProject.label}
                      </span>
                    )}
                    {selectedProject.isrc && (
                      <span className="font-mono">ISRC: {selectedProject.isrc}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search assets, tasks..." 
                  className="bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-100 w-64"
                />
              </div>
              <Button variant="secondary" className="hidden md:flex">
                <Settings size={18} />
              </Button>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {selectedProject ? (
              <>
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-emerald-950/30 text-emerald-400 rounded-xl flex items-center justify-center">
                        <CheckSquare size={20} />
                      </div>
                      <span className="text-xs font-bold text-emerald-400">+12%</span>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Tasks Completed</p>
                      <p className="text-3xl font-bold mt-1">
                        {tasks.filter(t => t.status === 'done').length}/{tasks.length}
                      </p>
                    </div>
                  </Card>
                  <Card className="flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-blue-950/30 text-blue-400 rounded-xl flex items-center justify-center">
                        <Calendar size={20} />
                      </div>
                      <span className="text-xs font-bold text-blue-400">Next: 2d</span>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Scheduled Posts</p>
                      <p className="text-3xl font-bold mt-1">{posts.length}</p>
                    </div>
                  </Card>
                  <Card className="flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-amber-950/30 text-amber-400 rounded-xl flex items-center justify-center">
                        <Database size={20} />
                      </div>
                      <span className="text-xs font-bold text-amber-400">4.2 GB</span>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Total Assets</p>
                      <p className="text-3xl font-bold mt-1">{assets.length}</p>
                    </div>
                  </Card>
                  <Card className="flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-purple-950/30 text-purple-400 rounded-xl flex items-center justify-center">
                        <BarChart3 size={20} />
                      </div>
                      <span className="text-xs font-bold text-purple-400">Live</span>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Avg. Engagement</p>
                      <p className="text-3xl font-bold mt-1">8.4%</p>
                    </div>
                  </Card>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-zinc-800 gap-8">
                  {[
                    { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                    { id: 'ai_manager', label: 'AI Manager', icon: Sparkles },
                    { id: 'campaign', label: 'Campaign', icon: Calendar },
                    { id: 'assets', label: 'Assets', icon: Database },
                    { id: 'distribution', label: 'Distribution', icon: ExternalLink },
                    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                    { id: 'artists', label: 'Artists', icon: UserIcon },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "flex items-center gap-2 pb-4 text-sm font-bold transition-all relative",
                        activeTab === tab.id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <tab.icon size={18} />
                      {tab.label}
                      {activeTab === tab.id && (
                        <motion.div 
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[400px]">
                  <AnimatePresence mode="wait">
                    {activeTab === 'checklist' && (
                      <motion.div 
                        key="checklist"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold">Release Checklist</h3>
                          <Button onClick={() => setIsTaskModalOpen(true)} variant="secondary" className="h-9 text-xs">
                            <Plus size={16} />
                            Add Task
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          {tasks.length === 0 ? (
                            <div className="text-center py-12 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
                              <p className="text-zinc-500">No tasks yet. Start planning your drop.</p>
                            </div>
                          ) : (
                            tasks.map(task => (
                              <div 
                                key={task.id}
                                className="group flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-all"
                              >
                                <button 
                                  onClick={() => handleToggleTask(task)}
                                  className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                    task.status === 'done' ? "bg-emerald-500 border-emerald-500 text-zinc-950" : "border-zinc-700 hover:border-zinc-500"
                                  )}
                                >
                                  {task.status === 'done' && <CheckCircle2 size={16} />}
                                </button>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className={cn("font-bold", task.status === 'done' && "line-through text-zinc-500")}>
                                      {task.title}
                                    </p>
                                    {task.category && (
                                      <span className="px-1.5 py-0.5 bg-zinc-800 text-[8px] font-bold uppercase tracking-wider rounded text-zinc-400">
                                        {task.category}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                      <Clock size={10} />
                                      Due: 
                                      <input 
                                        type="date" 
                                        value={task.deadline}
                                        onChange={async (e) => {
                                          try {
                                            await updateDoc(doc(db, `projects/${selectedProjectId}/tasks`, task.id), {
                                              deadline: e.target.value
                                            });
                                          } catch (error) {
                                            handleFirestoreError(error, OperationType.UPDATE, `projects/${selectedProjectId}/tasks/${task.id}`);
                                          }
                                        }}
                                        className="bg-transparent border-none text-[10px] text-zinc-500 focus:outline-none focus:ring-0 p-0 w-24 cursor-pointer hover:text-zinc-300 transition-colors"
                                      />
                                    </span>
                                    <Badge variant={task.status === 'done' ? 'success' : 'warning'}>
                                      {task.status}
                                    </Badge>
                                  </div>
                                  {task.description && (
                                    <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">{task.description}</p>
                                  )}
                                </div>
                                <button 
                                  onClick={async () => {
                                    if(confirm("Delete task?")) {
                                      await deleteDoc(doc(db, `projects/${selectedProjectId}/tasks`, task.id));
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 transition-all"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'ai_manager' && (
                      <motion.div 
                        key="ai_manager"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <AIManager 
                          project={selectedProject} 
                          tasks={tasks} 
                          assets={assets} 
                          onAddTask={handleAIAddTask} 
                        />
                      </motion.div>
                    )}

                    {activeTab === 'campaign' && (
                      <motion.div 
                        key="campaign"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold">Promotional Campaign</h3>
                          <Button onClick={() => setIsPostModalOpen(true)} variant="secondary" className="h-9 text-xs">
                            <Plus size={16} />
                            Schedule Post
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {posts.map(post => (
                            <Card key={post.id} className="flex flex-col gap-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {post.platform === 'instagram' && <Instagram size={18} className="text-pink-500" />}
                                  {post.platform === 'twitter' && <Twitter size={18} className="text-blue-400" />}
                                  {post.platform === 'tiktok' && <Music size={18} className="text-zinc-100" />}
                                  {post.platform === 'facebook' && <Facebook size={18} className="text-blue-600" />}
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold uppercase tracking-widest">{post.platform}</span>
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">{post.postType}</span>
                                  </div>
                                </div>
                                <Badge variant="info">{post.status}</Badge>
                              </div>
                              <p className="text-sm text-zinc-300 line-clamp-3 italic">"{post.content}"</p>
                              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">{post.scheduledDate}</span>
                                <button className="text-zinc-500 hover:text-zinc-100">
                                  <MoreVertical size={16} />
                                </button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'assets' && (
                      <motion.div 
                        key="assets"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold">Asset Library</h3>
                          <Button onClick={() => setIsAssetModalOpen(true)} variant="secondary" className="h-9 text-xs">
                            <Plus size={16} />
                            Upload Asset
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {assets.map(asset => (
                            <div 
                              key={asset.id}
                              className="group bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-all"
                            >
                              <div className="aspect-square bg-zinc-950 flex items-center justify-center relative">
                                {asset.type === 'audio' && <Music size={48} className="text-zinc-800" />}
                                {asset.type === 'video' && <Calendar size={48} className="text-zinc-800" />}
                                {asset.type === 'image' && <Database size={48} className="text-zinc-800" />}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <a 
                                    href={asset.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-3 bg-zinc-100 text-zinc-950 rounded-full hover:scale-110 transition-transform"
                                  >
                                    <ExternalLink size={20} />
                                  </a>
                                  <button 
                                    onClick={async () => {
                                      if(confirm("Delete asset?")) {
                                        await deleteDoc(doc(db, `projects/${selectedProjectId}/assets`, asset.id));
                                      }
                                    }}
                                    className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </div>
                              <div className="p-4">
                                <p className="text-sm font-bold truncate">{asset.name}</p>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold mt-1">{asset.type}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'distribution' && (
                      <motion.div 
                        key="distribution"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold">Distribution Pipeline</h3>
                          <Badge variant={selectedProject?.distributionStatus === 'live' ? 'success' : 'warning'}>
                            {selectedProject?.distributionStatus.replace('_', ' ')}
                          </Badge>
                        </div>

                        {/* Readiness Checklist */}
                        <Card className="bg-zinc-900/30 border-zinc-800/50">
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Release Readiness</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center",
                                (selectedProject?.isrc && selectedProject?.upc && selectedProject?.label) ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-600"
                              )}>
                                <Database size={16} />
                              </div>
                              <div>
                                <p className="text-sm font-bold">Metadata</p>
                                <p className="text-[10px] text-zinc-500">ISRC, UPC, Label</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center",
                                assets.length > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-600"
                              )}>
                                <Music size={16} />
                              </div>
                              <div>
                                <p className="text-sm font-bold">Assets</p>
                                <p className="text-[10px] text-zinc-500">{assets.length} files uploaded</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center",
                                (tasks.length > 0 && tasks.every(t => t.status === 'done')) ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-600"
                              )}>
                                <CheckSquare size={16} />
                              </div>
                              <div>
                                <p className="text-sm font-bold">Tasks</p>
                                <p className="text-[10px] text-zinc-500">{tasks.filter(t => t.status === 'done').length}/{tasks.length} complete</p>
                              </div>
                            </div>
                          </div>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <Card className="space-y-6">
                            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Metadata & Identifiers</h4>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">ISRC (International Standard Recording Code)</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    defaultValue={selectedProject?.isrc}
                                    onBlur={async (e) => {
                                      if (selectedProjectId) {
                                        await updateDoc(doc(db, 'projects', selectedProjectId), { isrc: e.target.value });
                                      }
                                    }}
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-zinc-100"
                                    placeholder="US-ABC-12-34567"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">UPC (Universal Product Code)</label>
                                <input 
                                  type="text" 
                                  defaultValue={selectedProject?.upc}
                                  onBlur={async (e) => {
                                    if (selectedProjectId) {
                                      await updateDoc(doc(db, 'projects', selectedProjectId), { upc: e.target.value });
                                    }
                                  }}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-zinc-100"
                                  placeholder="123456789012"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Label / Distributor</label>
                                <input 
                                  type="text" 
                                  defaultValue={selectedProject?.label}
                                  onBlur={async (e) => {
                                    if (selectedProjectId) {
                                      await updateDoc(doc(db, 'projects', selectedProjectId), { label: e.target.value });
                                    }
                                  }}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-100"
                                  placeholder="e.g. Sony Music / DistroKid"
                                />
                              </div>
                            </div>
                          </Card>

                          <Card className="space-y-6">
                            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Pipeline Status</h4>
                            <div className="space-y-4">
                              {[
                                { id: 'not_started', label: 'Not Started', desc: 'Metadata and assets are being prepared.' },
                                { id: 'submitted', label: 'Submitted', desc: 'Sent to distributor for review.' },
                                { id: 'processing', label: 'Processing', desc: 'Being delivered to DSPs (Spotify, Apple, etc).' },
                                { id: 'live', label: 'Live', desc: 'Project is available to the public.' },
                                { id: 'takedown_requested', label: 'Takedown Requested', desc: 'Removal from platforms in progress.' },
                              ].map(status => (
                                <button 
                                  key={status.id}
                                  onClick={async () => {
                                    if (selectedProjectId) {
                                      await updateDoc(doc(db, 'projects', selectedProjectId), { distributionStatus: status.id });
                                    }
                                  }}
                                  className={cn(
                                    "w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4",
                                    selectedProject?.distributionStatus === status.id 
                                      ? "bg-zinc-100 border-zinc-100 text-zinc-950" 
                                      : "bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                                  )}
                                >
                                  <div className={cn(
                                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                    selectedProject?.distributionStatus === status.id ? "border-zinc-950" : "border-zinc-700"
                                  )}>
                                    {selectedProject?.distributionStatus === status.id && <div className="w-2 h-2 rounded-full bg-zinc-950" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold">{status.label}</p>
                                    <p className={cn("text-[10px]", selectedProject?.distributionStatus === status.id ? "text-zinc-700" : "text-zinc-500")}>
                                      {status.desc}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </Card>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'analytics' && (
                      <motion.div 
                        key="analytics"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold">Artist Stream Monitoring</h3>
                          <Button 
                            onClick={handleSyncAnalytics} 
                            disabled={isSyncingAnalytics}
                            variant="secondary"
                            className="h-9 text-xs"
                          >
                            <Clock size={16} className={isSyncingAnalytics ? "animate-spin" : ""} />
                            {isSyncingAnalytics ? "Syncing..." : "Sync Streams"}
                          </Button>
                        </div>

                        {artistAnalytics && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="flex flex-col items-center text-center">
                              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Total Streams</p>
                              <p className="text-4xl font-bold text-zinc-100">{artistAnalytics.totalStreams.toLocaleString()}</p>
                            </Card>
                            <Card className="flex flex-col items-center text-center">
                              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Monthly Listeners</p>
                              <p className="text-4xl font-bold text-zinc-100">{artistAnalytics.monthlyListeners.toLocaleString()}</p>
                            </Card>
                            <Card className="flex flex-col items-center text-center">
                              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Top Platform</p>
                              <p className="text-4xl font-bold text-emerald-400">Spotify</p>
                            </Card>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <Card className="h-[400px]">
                            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Stream Distribution</h4>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={artistAnalytics ? Object.entries(artistAnalytics.platformBreakdown).map(([name, streams]) => ({ name, streams })) : [
                                { name: 'Spotify', streams: 4000 },
                                { name: 'Apple Music', streams: 3000 },
                                { name: 'YouTube', streams: 2000 },
                                { name: 'Tidal', streams: 500 },
                              ]}>
                                <defs>
                                  <linearGradient id="colorStreams" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f4f4f5" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#f4f4f5" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                                  itemStyle={{ color: '#f4f4f5' }}
                                />
                                <Area type="monotone" dataKey="streams" stroke="#f4f4f5" fillOpacity={1} fill="url(#colorStreams)" strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </Card>

                          <Card className="h-[400px]">
                            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Top Tracks Performance</h4>
                            <div className="space-y-4">
                              {(artistAnalytics?.topTracks || [
                                { name: 'Track 1', streams: 120000 },
                                { name: 'Track 2', streams: 95000 },
                                { name: 'Track 3', streams: 80000 },
                              ]).map((track, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
                                  <div className="flex items-center gap-4">
                                    <span className="text-zinc-500 font-mono">0{i+1}</span>
                                    <p className="font-bold">{track.name}</p>
                                  </div>
                                  <p className="text-zinc-400 font-mono text-sm">{track.streams.toLocaleString()} streams</p>
                                </div>
                              ))}
                            </div>
                          </Card>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'artists' && (
                      <motion.div 
                        key="artists"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold">Managed Artists</h3>
                          <Button onClick={() => setIsArtistModalOpen(true)} variant="secondary" className="h-9 text-xs">
                            <Plus size={16} />
                            Add Artist
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {artists.map(artist => (
                            <Card key={artist.id} className="flex flex-col gap-4 group">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 group-hover:bg-zinc-100 group-hover:text-zinc-950 transition-all">
                                    <UserIcon size={24} />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-lg">{artist.name}</h4>
                                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{artist.genre || 'No Genre'}</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={async () => {
                                    if(confirm(`Delete ${artist.name}? This will not delete their projects.`)) {
                                      await deleteDoc(doc(db, 'artists', artist.id));
                                    }
                                  }}
                                  className="p-2 text-zinc-700 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                              <p className="text-sm text-zinc-400 line-clamp-2">{artist.bio || 'No biography provided.'}</p>
                              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">
                                  {projects.filter(p => p.artistId === artist.id).length} Projects
                                </span>
                                <Button 
                                  variant="ghost" 
                                  className="h-8 text-[10px] px-3"
                                  onClick={() => setViewingArtistId(artist.id)}
                                >
                                  View Profile
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center text-zinc-700">
                  <Music size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">No Project Selected</h3>
                  <p className="text-zinc-500 max-w-xs">Select a project from the sidebar or create a new one to start managing your drop.</p>
                </div>
                <Button onClick={handleCreateProject}>
                  <Plus size={20} />
                  Create Your First Project
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title="New Project Release">
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Project Name</label>
            <input 
              type="text" 
              required
              value={projectForm.name}
              onChange={e => setProjectForm({...projectForm, name: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
              placeholder="e.g. Midnight City"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Artist</label>
            <select 
              required
              value={projectForm.artistId}
              onChange={e => setProjectForm({...projectForm, artistId: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
            >
              <option value="">Select Artist</option>
              {artists.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button 
              type="button"
              onClick={() => { setIsProjectModalOpen(false); setIsArtistModalOpen(true); }}
              className="text-[10px] text-zinc-500 hover:text-zinc-100 mt-2 underline block"
            >
              + Create New Artist
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Project Type</label>
              <select 
                value={projectForm.type}
                onChange={e => setProjectForm({...projectForm, type: e.target.value as any})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
              >
                <option value="album">Album</option>
                <option value="mixtape">Mixtape</option>
                <option value="ep">EP</option>
                <option value="lp">LP</option>
                <option value="single">Single</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Label</label>
              <input 
                type="text" 
                value={projectForm.label}
                onChange={e => setProjectForm({...projectForm, label: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
                placeholder="e.g. Sony Music"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">ISRC</label>
              <input 
                type="text" 
                value={projectForm.isrc}
                onChange={e => setProjectForm({...projectForm, isrc: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
                placeholder="US-ABC-12-34567"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">UPC</label>
              <input 
                type="text" 
                value={projectForm.upc}
                onChange={e => setProjectForm({...projectForm, upc: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
                placeholder="123456789012"
              />
            </div>
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl">Create Project</Button>
        </form>
      </Modal>

      <Modal isOpen={isArtistModalOpen} onClose={() => setIsArtistModalOpen(false)} title="Create New Artist">
        <form onSubmit={handleCreateArtist} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Artist Name</label>
            <input 
              type="text" 
              required
              value={artistForm.name}
              onChange={e => setArtistForm({...artistForm, name: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
              placeholder="e.g. The Weekend"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Genre</label>
            <input 
              type="text" 
              value={artistForm.genre}
              onChange={e => setArtistForm({...artistForm, genre: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
              placeholder="e.g. R&B, Pop"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Bio</label>
            <textarea 
              value={artistForm.bio}
              onChange={e => setArtistForm({...artistForm, bio: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100 h-32 resize-none"
              placeholder="Artist background and story..."
            />
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl">Save Artist</Button>
        </form>
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Add Release Task">
        <form onSubmit={handleAddTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Task Title</label>
            <input 
              type="text" 
              required
              value={taskForm.title}
              onChange={e => setTaskForm({...taskForm, title: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
              placeholder="e.g. Final Master Approval"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Deadline</label>
            <input 
              type="date" 
              required
              value={taskForm.deadline}
              onChange={e => setTaskForm({...taskForm, deadline: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
            />
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl">Add Task</Button>
        </form>
      </Modal>

      <Modal isOpen={!!viewingArtistId} onClose={() => setViewingArtistId(null)} title="Artist Profile">
        {viewingArtist && (
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-zinc-800 rounded-3xl flex items-center justify-center text-zinc-500">
                <UserIcon size={48} />
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-bold tracking-tight">{viewingArtist.name}</h3>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">{viewingArtist.genre || 'No Genre'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Biography</h4>
              <p className="text-zinc-300 leading-relaxed italic">
                {viewingArtist.bio || 'No biography provided for this artist.'}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Active Projects</h4>
              <div className="grid gap-3">
                {projects.filter(p => p.artistId === viewingArtist.id).map(p => (
                  <div 
                    key={p.id}
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      setViewingArtistId(null);
                      setActiveTab('checklist');
                    }}
                    className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Music size={18} className="text-zinc-500 group-hover:text-zinc-100" />
                      <div>
                        <p className="font-bold text-sm">{p.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">{p.projectType}</p>
                      </div>
                    </div>
                    <Badge variant={p.status === 'released' ? 'success' : 'info'}>{p.status}</Badge>
                  </div>
                ))}
                {projects.filter(p => p.artistId === viewingArtist.id).length === 0 && (
                  <p className="text-center py-8 text-zinc-600 border border-dashed border-zinc-800 rounded-xl text-sm">
                    No projects found for this artist.
                  </p>
                )}
              </div>
            </div>

            <Button 
              onClick={() => {
                setProjectForm({ ...projectForm, artistId: viewingArtist.id });
                setViewingArtistId(null);
                setIsProjectModalOpen(true);
              }}
              className="w-full py-4 rounded-xl"
            >
              <Plus size={20} />
              Create New Project for {viewingArtist.name}
            </Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={isPostModalOpen} onClose={() => setIsPostModalOpen(false)} title="Schedule Campaign Post">
        <form onSubmit={handleAddPost} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Platform</label>
              <select 
                value={postForm.platform}
                onChange={e => setPostForm({...postForm, platform: e.target.value as any})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
              >
                <option value="instagram">Instagram</option>
                <option value="twitter">Twitter</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Post Type</label>
              <select 
                value={postForm.postType}
                onChange={e => setPostForm({...postForm, postType: e.target.value as any})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
              >
                <option value="feed">Feed Post</option>
                <option value="story">Story</option>
                <option value="reel">Reel</option>
                <option value="thread">Thread</option>
                <option value="video">Video</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Content / Caption</label>
            <textarea 
              required
              value={postForm.content}
              onChange={e => setPostForm({...postForm, content: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100 h-32 resize-none"
              placeholder="Write your post content here..."
            />
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl">Schedule Post</Button>
        </form>
      </Modal>

      <Modal isOpen={isAssetModalOpen} onClose={() => setIsAssetModalOpen(false)} title="Add Digital Asset">
        <form onSubmit={handleAddAsset} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Asset Name</label>
            <input 
              type="text" 
              required
              value={assetForm.name}
              onChange={e => setAssetForm({...assetForm, name: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
              placeholder="e.g. Mastered Audio v1"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Asset Type</label>
            <select 
              value={assetForm.type}
              onChange={e => setAssetForm({...assetForm, type: e.target.value as any})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
            >
              <option value="audio">Audio</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Storage URL</label>
            <input 
              type="url" 
              required
              value={assetForm.url}
              onChange={e => setAssetForm({...assetForm, url: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-100"
              placeholder="https://dropbox.com/s/..."
            />
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl">Add Asset</Button>
        </form>
      </Modal>
    </ErrorBoundary>
  );
}
