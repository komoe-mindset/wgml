import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChapterView } from './components/ChapterView';
import { LoginScreen } from './components/LoginScreen'; 
import { UserGuide } from './components/UserGuide';
import { OfflineBanner } from './components/OfflineBanner';
import { CHAPTERS } from './constants';
import { Monitor, Layout, Menu, ChevronLeft, ChevronRight, Home, GraduationCap, UserCog, LogOut, Sparkles, X, CheckCircle, AlertCircle, Globe, Maximize2, Minimize2, Upload, Loader2, Download } from 'lucide-react';
import { exportTeachingPackage, importTeachingPackage } from './utils/packageManager';
import { saveToDB, loadFromDB, initDB, STORE_NAME, DB_NAME } from './utils/db';
import { Quiz } from './types';

// --- Toast Component ---
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-slate-800'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Sparkles className="w-5 h-5" />
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white ${bgColors[type]} animate-in slide-in-from-right-10 fade-in duration-300`}>
      {icons[type]}
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// --- Empty State Modal (Onboarding Blocker) ---
const EmptyStateModal = ({ onImport, onBack }: { onImport: (file: File) => Promise<boolean>; onBack: () => void }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
        setIsProcessing(true);
        await onImport(e.target.files[0]);
        setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center animate-in zoom-in-95">
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <Upload className="w-10 h-10 text-indigo-600 animate-bounce" />
                <div className="absolute inset-0 border-4 border-indigo-200 rounded-full animate-ping opacity-20"></div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2 font-burmese">Setup Required (စတင်ရန်လိုသည်)</h2>
            <p className="text-slate-500 mb-8 font-burmese leading-relaxed">
                သင်ခန်းစာများ မရှိသေးပါ။ ဆရာပေးပို့သော Package (.zip) ဖိုင်ကို ထည့်သွင်းပါ။<br/>
                <span className="text-xs text-slate-400 block mt-2">No content found. Please import the Teaching Package.</span>
            </p>
            
            <div className="space-y-3">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {isProcessing ? 'Importing...' : 'Import Lesson Package'}
                </button>

                <button 
                    onClick={onBack}
                    className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                    <LogOut className="w-4 h-4" />
                    Back to Login
                </button>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFile} accept=".zip" className="hidden" />
            
            <div className="mt-6 text-xs text-slate-400 font-medium">
                Ask your teacher for the course file.
            </div>
        </div>
    </div>
  );
};

export default function App() {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'teacher' | 'student' | null>(null);

  // App State
  const [activeChapterId, setActiveChapterId] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default open on desktop
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false); // New Focus Mode
  const [language, setLanguage] = useState<'my' | 'en'>(() => (localStorage.getItem('app_language') as 'my' | 'en') || 'my');
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  // Content State
  const [chapterImages, setChapterImages] = useState<Record<number, string[]>>({});
  const [chapterDiagrams, setChapterDiagrams] = useState<Record<number, string[]>>({});
  const [chapterHtml, setChapterHtml] = useState<Record<number, string>>({});
  const [chapterResources, setChapterResources] = useState<Record<number, { audio?: string; youtube?: string; questions?: string[]; links?: { title: string; url: string }[] }>>({});
  const [chapterQuizzes, setChapterQuizzes] = useState<Record<number, Quiz>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Global Tab State for persistence
  const [currentTab, setCurrentTab] = useState<'content' | 'visual' | 'gallery' | 'resources' | 'quiz'>('content');

  const activeChapter = CHAPTERS.find(c => c.id === activeChapterId) || CHAPTERS[0];

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const handleLanguageToggle = () => {
    const newLang = language === 'my' ? 'en' : 'my';
    setLanguage(newLang);
    localStorage.setItem('app_language', newLang);
  };

  // PWA Install Prompt Listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Load Auth from Session
  useEffect(() => {
    const savedRole = sessionStorage.getItem('user_role');
    if (savedRole === 'teacher' || savedRole === 'student') {
      setUserRole(savedRole);
      setIsLoggedIn(true);
    }
  }, []);

  // Load Content from DB
  useEffect(() => {
    const loadData = async () => {
      try {
        const images = await loadFromDB('images');
        const diagrams = await loadFromDB('diagrams');
        const html = await loadFromDB('html');
        const resources = await loadFromDB('resources');
        const quizzes = await loadFromDB('quizzes');
        
        if (images) setChapterImages(images);
        if (diagrams) setChapterDiagrams(diagrams);
        if (html) setChapterHtml(html);
        if (resources) setChapterResources(resources);
        if (quizzes) setChapterQuizzes(quizzes);
      } catch (err) {
        console.error("Failed to load from DB", err);
        showToast("Failed to load saved content", 'error');
      } finally {
        setIsLoading(false);
      }
    };
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  // Auto-Save Effects
  useEffect(() => { if (!isLoading && isLoggedIn && userRole === 'teacher') saveToDB('images', chapterImages); }, [chapterImages, isLoading, isLoggedIn, userRole]);
  useEffect(() => { if (!isLoading && isLoggedIn && userRole === 'teacher') saveToDB('diagrams', chapterDiagrams); }, [chapterDiagrams, isLoading, isLoggedIn, userRole]);
  useEffect(() => { if (!isLoading && isLoggedIn && userRole === 'teacher') saveToDB('html', chapterHtml); }, [chapterHtml, isLoading, isLoggedIn, userRole]);
  useEffect(() => { if (!isLoading && isLoggedIn && userRole === 'teacher') saveToDB('resources', chapterResources); }, [chapterResources, isLoading, isLoggedIn, userRole]);
  useEffect(() => { if (!isLoading && isLoggedIn && userRole === 'teacher') saveToDB('quizzes', chapterQuizzes); }, [chapterQuizzes, isLoading, isLoggedIn, userRole]);

  const handleLogin = (role: 'teacher' | 'student') => {
    setUserRole(role);
    setIsLoggedIn(true);
    sessionStorage.setItem('user_role', role);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    sessionStorage.removeItem('user_role');
    setIsPresentationMode(false);
    setIsFocusMode(false);
    setActiveChapterId(1);
    setCurrentTab('content'); 
  };

  const handleHome = () => { setActiveChapterId(1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleNext = () => { if (activeChapterId < CHAPTERS.length) setActiveChapterId(prev => prev + 1); };
  const handlePrev = () => { if (activeChapterId > 1) setActiveChapterId(prev => prev - 1); };

  // Presentation Mode Toggle with Fullscreen API
  const togglePresentationMode = () => {
      if (!isPresentationMode) {
          // Enter Fullscreen
          const elem = document.documentElement;
          if (elem.requestFullscreen) {
              elem.requestFullscreen().catch(err => console.error(err));
          }
          setIsPresentationMode(true);
          setIsSidebarOpen(false); // Auto close sidebar
          setIsFocusMode(false); // Ensure focus mode state doesn't conflict
      } else {
          // Exit Fullscreen
          if (document.exitFullscreen && document.fullscreenElement) {
              document.exitFullscreen().catch(err => console.error(err));
          }
          setIsPresentationMode(false);
          setIsSidebarOpen(true); // Restore sidebar
      }
  };

  // Sync state with browser fullscreen events (Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      setIsPresentationMode(isFullscreen);
      if (!isFullscreen) setIsSidebarOpen(true); // Re-open sidebar on exit
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFocusMode = () => {
      setIsFocusMode(!isFocusMode);
      setIsSidebarOpen(!!isFocusMode); // If exiting focus mode (true -> false), open sidebar
  };

  // Content Handlers
  const handleAddImage = (chapterId: number, img: string | string[]) => {
    setChapterImages(prev => ({ ...prev, [chapterId]: [...(prev[chapterId] || []), ...(Array.isArray(img) ? img : [img])] }));
  };
  const handleReorderImages = (chapterId: number, newImages: string[]) => setChapterImages(prev => ({ ...prev, [chapterId]: newImages }));
  const handleRemoveImage = (chapterId: number, index: number) => {
    setChapterImages(prev => ({ ...prev, [chapterId]: prev[chapterId].filter((_, i) => i !== index) }));
    showToast("Image removed", 'info');
  };
  const handleBulkRemoveImages = (chapterId: number, indices: number[]) => {
    setChapterImages(prev => ({ ...prev, [chapterId]: (prev[chapterId] || []).filter((_, idx) => !indices.includes(idx)) }));
    showToast(`Deleted ${indices.length} images`, 'info');
  };
  const handleBulkMoveGalleryToVisual = (chapterId: number, indices: number[]) => {
    const currentImages = chapterImages[chapterId] || [];
    const imagesToMove = currentImages.filter((_, idx) => indices.includes(idx));
    if (imagesToMove.length === 0) return;
    setChapterDiagrams(prev => ({ ...prev, [chapterId]: [...(prev[chapterId] || []), ...imagesToMove] }));
    setChapterImages(prev => ({ ...prev, [chapterId]: currentImages.filter((_, idx) => !indices.includes(idx)) }));
    showToast(`Moved ${imagesToMove.length} images to Visual Aid`);
  };
  const handleAddDiagram = (chapterId: number, img: string | string[]) => {
    const newDiagrams = Array.isArray(img) ? img : [img];
    setChapterDiagrams(prev => ({ ...prev, [chapterId]: [...(prev[chapterId] || []), ...newDiagrams] }));
    showToast("Visual aid added");
  };
  const handleReorderDiagrams = (chapterId: number, newDiagrams: string[]) => setChapterDiagrams(prev => ({ ...prev, [chapterId]: newDiagrams }));
  const handleRemoveDiagram = (chapterId: number, index: number) => {
    setChapterDiagrams(prev => ({ ...prev, [chapterId]: prev[chapterId].filter((_, i) => i !== index) }));
    showToast("Visual aid removed", 'info');
  };
  const handleClearDiagrams = (chapterId: number) => {
      setChapterDiagrams(prev => { const n = { ...prev }; delete n[chapterId]; return n; });
  };
  const handleSetHtml = (chapterId: number, html: string) => {
    setChapterHtml(prev => ({ ...prev, [chapterId]: html }));
    showToast("Lecture notes saved");
  };
  const handleRemoveHtml = (chapterId: number) => {
    setChapterHtml(prev => { const n = { ...prev }; delete n[chapterId]; return n; });
    showToast("Content removed", 'info');
  };
  const handleUpdateResources = (chapterId: number, audio?: string, youtube?: string, questions?: string[], links?: { title: string; url: string }[]) => {
    setChapterResources(prev => ({ ...prev, [chapterId]: { ...prev[chapterId], audio, youtube, questions, links } }));
  };
  
  // Quiz Handler
  const handleSaveQuiz = (quiz: Quiz) => {
      setChapterQuizzes(prev => ({ ...prev, [quiz.chapterId]: quiz }));
  };

  const handleExport = async () => {
    try {
      setIsLoading(true);
      await exportTeachingPackage(chapterImages, chapterDiagrams, chapterHtml, chapterResources, chapterQuizzes);
      showToast("Package exported successfully!");
    } catch (error) {
      console.error(error);
      showToast("Failed to export package", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Modified to return boolean for LoginScreen UI Feedback
  const handleImport = async (file: File): Promise<boolean> => {
    try {
      setIsLoading(true);
      const data = await importTeachingPackage(file);
      setChapterImages(data.images);
      setChapterDiagrams(data.diagrams);
      setChapterHtml(data.html || {});
      setChapterResources(data.resources || {});
      setChapterQuizzes(data.quizzes || {});
      
      await saveToDB('images', data.images);
      await saveToDB('diagrams', data.diagrams);
      await saveToDB('html', data.html || {});
      await saveToDB('resources', data.resources || {});
      await saveToDB('quizzes', data.quizzes || {});

      showToast("Package loaded successfully!");
      return true;
    } catch (error) {
      console.error(error);
      showToast("Failed to load package.", 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleFactoryReset = async () => {
    try {
        setIsLoading(true);
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => {
             setChapterImages({}); setChapterDiagrams({}); setChapterHtml({}); setChapterResources({}); setChapterQuizzes({});
             setIsLoading(false); alert("Reset Complete. App will reload."); window.location.reload();
        };
        request.onerror = () => { setIsLoading(false); showToast("Failed to reset data.", 'error'); };
    } catch (e) { console.error(e); setIsLoading(false); }
  };

  if (!isLoggedIn) {
    return (
      <>
        <OfflineBanner />
        <LoginScreen 
          onLogin={handleLogin} 
          onImport={handleImport} 
          language={language}
          onToggleLanguage={handleLanguageToggle}
          onOpenGuide={() => setIsUserGuideOpen(true)}
          installPrompt={installPrompt}
          onInstallApp={handleInstallApp}
        />
        <UserGuide 
          isOpen={isUserGuideOpen} 
          onClose={() => setIsUserGuideOpen(false)} 
          language={language} 
          defaultRole="student" 
        />
      </>
    );
  }

  // Check if content exists
  const hasContent = Object.keys(chapterImages).length > 0 || 
                     Object.keys(chapterHtml).length > 0 || 
                     Object.keys(chapterDiagrams).length > 0;

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans">
      <div className="fixed top-0 left-0 right-0 z-[200]">
        <OfflineBanner />
      </div>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <UserGuide 
          isOpen={isUserGuideOpen} 
          onClose={() => setIsUserGuideOpen(false)} 
          language={language} 
          defaultRole={userRole || 'student'}
      />

      {/* Empty State / Onboarding Blocker for Students */}
      {userRole === 'student' && !hasContent && !isLoading && (
          <EmptyStateModal onImport={handleImport} onBack={handleLogout} />
      )}

      {isSidebarOpen && !isPresentationMode && !isFocusMode && (
        <Sidebar 
          activeChapterId={activeChapterId}
          onSelectChapter={setActiveChapterId}
          isOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onExport={handleExport}
          onImport={handleImport}
          onFactoryReset={handleFactoryReset}
          isStudentMode={userRole === 'student'}
          showToast={showToast}
          language={language}
          onOpenGuide={() => setIsUserGuideOpen(true)}
          installPrompt={installPrompt}
          onInstallApp={handleInstallApp}
        />
      )}

      <main className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${!isSidebarOpen || isPresentationMode || isFocusMode ? 'w-full' : ''}`}>
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              <span className="font-burmese">Loading...</span>
            </div>
          </div>
        )}

        {!isPresentationMode && !isFocusMode && (
          <header className="min-h-[56px] lg:min-h-[64px] h-auto bg-white border-b border-slate-200 flex items-center justify-between px-3 lg:px-6 py-2 shadow-sm z-10 gap-2 shrink-0">
            <div className="flex items-center gap-2 lg:gap-4 shrink-0">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"><Menu className="w-6 h-6" /></button>
              
              {/* Desktop Title */}
              <div className="hidden md:flex flex-col justify-center">
                <h2 className="font-bold text-slate-800 text-sm sm:text-lg font-burmese leading-[2.2]">
                    {language === 'my' ? "ဉာဏ်ယှဉ်သတိဖြင့် နေထိုင်ခြင်း" : "Wisdom-Guided Mindful Living"}
                </h2>
                <span className="text-slate-400 text-[10px] sm:text-xs font-serif">
                    {language === 'my' ? "Wisdom-Guided Mindful Living (Level 1)" : "ဉာဏ်ယှဉ်သတိဖြင့် နေထိုင်ခြင်း (Level 1)"}
                </span>
              </div>

              {/* Mobile Chapter Navigation (Integrated into Top Bar to save footer space) */}
              <div className="flex md:hidden items-center gap-1">
                 <button onClick={handlePrev} disabled={activeChapterId === 1} className="p-2 rounded-full text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-30">
                    <ChevronLeft className="w-5 h-5" />
                 </button>
                 <span className="text-xs font-bold text-slate-500 w-12 text-center">Ch. {activeChapterId}</span>
                 <button onClick={handleNext} disabled={activeChapterId === CHAPTERS.length} className="p-2 rounded-full text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-30">
                    <ChevronRight className="w-5 h-5" />
                 </button>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
               {/* Language Toggle in Header */}
               <button 
                onClick={handleLanguageToggle}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-white text-xs font-bold transition-all text-slate-600"
                title="Switch Language"
               >
                 <Globe className="w-4 h-4 text-indigo-500" />
                 <span className="hidden sm:inline">{language === 'my' ? 'MY' : 'EN'}</span>
                 <span className="sm:hidden">{language === 'my' ? 'MY' : 'EN'}</span>
               </button>

              {userRole === 'teacher' && (
                <div className="hidden md:flex items-center gap-2 pr-4 mr-4 border-r border-slate-200">
                  <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors"><span className="hidden lg:inline">Export</span> Save</button>
                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer"><span className="hidden lg:inline">Import</span> Load<input type="file" accept=".zip" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} className="hidden" /></label>
                </div>
              )}

              {/* Desktop Nav Arrows */}
              <div className="hidden md:flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
                <button onClick={handlePrev} disabled={activeChapterId === 1} className="p-1.5 rounded-full text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-bold text-slate-500 px-3 min-w-[70px] text-center font-burmese select-none pt-0.5">
                    {language === 'my' ? 'အခန်း' : 'Ch.'} {activeChapterId}
                </span>
                <button onClick={handleNext} disabled={activeChapterId === CHAPTERS.length} className="p-1.5 rounded-full text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>

              <div className={`hidden sm:flex items-center gap-2 px-3 py-1 ${userRole === 'student' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'} rounded-full text-xs font-bold font-burmese border`}>
                {userRole === 'student' ? <GraduationCap className="w-4 h-4" /> : <UserCog className="w-4 h-4" />}
                <span className="hidden sm:inline pt-0.5">
                    {language === 'my' 
                        ? (userRole === 'student' ? 'ကျောင်းသား' : 'ဆရာ') 
                        : (userRole === 'student' ? 'Student' : 'Teacher')}
                </span>
              </div>

              <button onClick={handleLogout} className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full text-sm font-medium text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 hover:border-red-200 transition-all">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-burmese pt-0.5">
                    {language === 'my' ? 'ထွက်မည်' : 'Logout'}
                </span>
              </button>
            </div>
          </header>
        )}

        {/* Focus Mode floating header - only visible in Focus Mode */}
        {isFocusMode && !isPresentationMode && (
          <div className="absolute top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4">
              <button 
                onClick={toggleFocusMode}
                className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-full shadow-md border border-slate-200 hover:bg-slate-50 transition-all font-bold text-sm group"
              >
                 <Minimize2 className="w-4 h-4 text-indigo-500 group-hover:scale-90 transition-transform" />
                 <span>Exit Focus</span>
              </button>
          </div>
        )}

        <div className="flex-1 overflow-hidden relative">
           <ChapterView 
             chapter={activeChapter} 
             isPresentationMode={isPresentationMode}
             chapterImages={chapterImages[activeChapter.id] || []}
             customDiagrams={chapterDiagrams[activeChapter.id] || []}
             customHtml={chapterHtml[activeChapter.id]}
             resources={chapterResources[activeChapter.id]}
             quiz={chapterQuizzes[activeChapter.id]}
             onAddImage={(img) => handleAddImage(activeChapter.id, img)}
             onRemoveImage={(idx) => handleRemoveImage(activeChapter.id, idx)}
             onBulkRemoveImage={(indices) => handleBulkRemoveImages(activeChapter.id, indices)}
             onReorderImages={(imgs) => handleReorderImages(activeChapter.id, imgs)}
             onAddDiagram={(img) => handleAddDiagram(activeChapter.id, img)}
             onRemoveDiagram={(idx) => handleRemoveDiagram(activeChapter.id, idx)}
             onReorderDiagrams={(diagrams) => handleReorderDiagrams(activeChapter.id, diagrams)}
             onClearDiagrams={() => handleClearDiagrams(activeChapter.id)}
             onSetHtml={(html) => handleSetHtml(activeChapter.id, html)}
             onRemoveHtml={() => handleRemoveHtml(activeChapter.id)}
             onUpdateResources={(audio, youtube, questions, links) => handleUpdateResources(activeChapter.id, audio, youtube, questions, links)}
             onSaveQuiz={handleSaveQuiz}
             isReadOnly={userRole === 'student'} 
             activeTab={currentTab}
             onTabChange={setCurrentTab}
             showToast={showToast}
             onBulkMoveToVisual={(indices) => handleBulkMoveGalleryToVisual(activeChapter.id, indices)}
             onExitPresentation={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(console.error);
                setIsPresentationMode(false);
                setIsSidebarOpen(true);
             }}
             onEnterPresentation={togglePresentationMode}
             language={language}
             isFocusMode={isFocusMode}
             onToggleFocusMode={toggleFocusMode}
           />
        </div>
      </main>
    </div>
  );
}