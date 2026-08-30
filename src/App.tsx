import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  List as ListIcon, 
  Sun, 
  Moon, 
  Database,
  Cloud,
  CloudOff,
  RefreshCw,
  X,
  Layers,
  Home as HomeIcon,
  Zap
} from 'lucide-react';
import { db, seedInitialDataIfNeeded } from './db';
import { NoteItem, Topic, SmartFilter, KanbanColumn } from './types';
import { HomeCaptureView } from './components/HomeCaptureView';
import { ListView } from './components/ListView';
import { KanbanBoard } from './components/KanbanBoard';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { BackupModal } from './components/BackupModal';
import { TopicManagerModal } from './components/TopicManagerModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { getStoredFirebaseConfig } from './lib/firebase';
import { syncService } from './services/syncService';

type TabMode = 'home' | 'notes' | 'kanban';

export const App: React.FC = () => {
  // App state - 'home' is the primary default screen!
  const [tabMode, setTabMode] = useState<TabMode>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeSmartFilter, setActiveSmartFilter] = useState<SmartFilter>('all');
  
  // Modals state
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isTopicManagerOpen, setIsTopicManagerOpen] = useState(false);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [quickAddColumn, setQuickAddColumn] = useState<KanbanColumn | null>(null);

  // Cloud sync state - defaults to true because Firebase is pre-configured
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(() => {
    const config = getStoredFirebaseConfig();
    return Boolean(config && config.apiKey && config.projectId);
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const checkCloudConnection = () => {
    const config = getStoredFirebaseConfig();
    const isConn = Boolean(config && config.apiKey && config.projectId);
    setIsCloudConnected(isConn);
    if (isConn) {
      syncService.pullAll();
    }
  };

  useEffect(() => {
    seedInitialDataIfNeeded().then(() => {
      checkCloudConnection();
    });

    const unsubscribe = syncService.onSyncStatus((syncing) => {
      setIsSyncing(syncing);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Live queries from IndexedDB
  const allNotes = useLiveQuery(() => db.notes.toArray(), []) || [];
  const topics = useLiveQuery(() => db.topics.orderBy('createdAt').toArray(), []) || [];
  const tags = useLiveQuery(() => db.tags.orderBy('lastUsedAt').reverse().toArray(), []) || [];

  const topicsMap = useMemo(() => {
    const map = new Map<string, Topic>();
    topics.forEach((t) => map.set(t.id, t));
    return map;
  }, [topics]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return allNotes.filter((note) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(q);
        const matchesBody = note.bodyText.toLowerCase().includes(q);
        const matchesTag = note.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesBody && !matchesTag) return false;
      }

      // 2. Topic Filter
      if (selectedTopicId && note.topicId !== selectedTopicId) {
        return false;
      }

      // 3. Tag Filter
      if (selectedTags.length > 0) {
        if (!note.tags || !selectedTags.every((st) => note.tags.includes(st))) {
          return false;
        }
      }

      // 4. Smart Filter
      if (activeSmartFilter === 'today') {
        if (!note.isReminder || !note.reminderDate) return false;
        const noteDate = new Date(note.reminderDate);
        const today = new Date();
        const isSameDay =
          noteDate.getDate() === today.getDate() &&
          noteDate.getMonth() === today.getMonth() &&
          noteDate.getFullYear() === today.getFullYear();
        if (!isSameDay) return false;
      } else if (activeSmartFilter === 'urgent') {
        if (note.priority !== 'Urgent') return false;
      } else if (activeSmartFilter === 'untagged') {
        if (note.tags && note.tags.length > 0) return false;
      } else if (activeSmartFilter === 'voice') {
        if (!note.audioBlob && !note.audioUrl && (!note.tags || !note.tags.includes('voice'))) return false;
      } else if (activeSmartFilter === 'completed') {
        if (!note.isCompleted) return false;
      }

      return true;
    });
  }, [allNotes, searchQuery, selectedTopicId, selectedTags, activeSmartFilter]);

  // Note actions
  const handleToggleComplete = async (id: string) => {
    const note = allNotes.find((n) => n.id === id);
    if (note) {
      const nextStatus: KanbanColumn = !note.isCompleted ? 'Done' : 'To-Do';
      const updated = {
        isCompleted: !note.isCompleted,
        kanbanStatus: nextStatus,
        updatedAt: Date.now(),
      };
      await db.notes.update(id, updated);
      syncService.syncNote({ ...note, ...updated });
    }
  };

  const handleDeleteNote = async (id: string) => {
    await db.notes.delete(id);
    await syncService.deleteNote(id);
  };

  const handleEditNote = (note: NoteItem) => {
    setEditingNote(note);
    setIsQuickCaptureOpen(true);
  };

  const handleToggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleTagClick = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const handleQuickAddInColumn = (column: KanbanColumn) => {
    setQuickAddColumn(column);
    setEditingNote(null);
    setIsQuickCaptureOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F7] dark:bg-black text-gray-900 dark:text-gray-100">
      {/* Top iOS Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-ios-gray-900/80 backdrop-blur-md border-b border-ios-gray-200/70 dark:border-ios-gray-800/80 px-4 sm:px-6 py-2.5 pt-safe">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Logo & Cloud Sync Status */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setTabMode('home')}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <img 
                src="/logo.png" 
                alt="NoteSync" 
                className="w-8 h-8 rounded-xl shadow-sm object-cover border border-black/5 dark:border-white/10" 
              />
              <div className="text-left hidden xs:block">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight text-gray-900 dark:text-gray-100">
                    NoteSync
                  </h1>
                </div>
              </div>
            </button>

            {/* Cloud Sync Status Badge */}
            <button
              type="button"
              onClick={() => setIsFirebaseModalOpen(true)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                isCloudConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                  : 'bg-ios-gray-200/70 dark:bg-ios-gray-800 text-ios-gray-500 border border-ios-gray-300 dark:border-ios-gray-700 hover:text-amber-500'
              }`}
              title={isCloudConnected ? (isSyncing ? 'Syncing with Firebase Cloud...' : 'Firebase Cloud Connected (Click to configure)') : 'Connect Firebase Cloud Backend'}
            >
              {isSyncing ? (
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-emerald-600" />
              ) : isCloudConnected ? (
                <Cloud className="w-2.5 h-2.5 fill-current" />
              ) : (
                <CloudOff className="w-2.5 h-2.5" />
              )}
              <span>{isSyncing ? 'Syncing' : isCloudConnected ? 'Cloud' : 'Local'}</span>
            </button>
          </div>

          {/* Center: Main Navigation Tabs (Home / Notes / Board) */}
          <div className="flex items-center p-1 rounded-2xl bg-ios-gray-100 dark:bg-ios-gray-800 border border-ios-gray-200/50 dark:border-ios-gray-700/50 shadow-inner">
            <button
              type="button"
              onClick={() => setTabMode('home')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tabMode === 'home'
                  ? 'bg-white dark:bg-ios-gray-700 text-ios-blue shadow-sm'
                  : 'text-ios-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            <button
              type="button"
              onClick={() => setTabMode('notes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tabMode === 'notes'
                  ? 'bg-white dark:bg-ios-gray-700 text-ios-blue shadow-sm'
                  : 'text-ios-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>Notes</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tabMode === 'notes' ? 'bg-ios-blue/10 text-ios-blue' : 'bg-ios-gray-200 dark:bg-ios-gray-700 text-ios-gray-500'}`}>
                {allNotes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTabMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tabMode === 'kanban'
                  ? 'bg-white dark:bg-ios-gray-700 text-ios-blue shadow-sm'
                  : 'text-ios-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>

          {/* Right: Quick Tools */}
          <div className="flex items-center gap-1">
            {/* Manage Topics Button */}
            <button
              type="button"
              onClick={() => setIsTopicManagerOpen(true)}
              className="p-2 rounded-xl text-ios-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-ios-gray-100 dark:hover:bg-ios-gray-800 transition-colors"
              title="Manage Topics"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl text-ios-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-ios-gray-100 dark:hover:bg-ios-gray-800 transition-colors"
              title="Toggle Dark/Light Mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Backup & Restore */}
            <button
              type="button"
              onClick={() => setIsBackupOpen(true)}
              className="p-2 rounded-xl text-ios-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-ios-gray-100 dark:hover:bg-ios-gray-800 transition-colors"
              title="Backup & Restore Data"
            >
              <Database className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {tabMode === 'home' ? (
          /* 🏠 1. HOME TAB: Centered Writing & Quick Capture View */
          <HomeCaptureView
            topics={topics}
            recentTags={tags}
            recentNotes={allNotes}
            topicsMap={topicsMap}
            onGoToNotes={() => setTabMode('notes')}
          />
        ) : tabMode === 'notes' ? (
          /* 📋 2. NOTES TAB: Search, Topics, Smart Filters, Tag Chips, Notes Stream */
          <div className="flex-1 flex flex-col">
            {/* Search Header for Notes tab */}
            <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 pt-4 pb-1">
              <div className="relative">
                <Search className="w-4 h-4 text-ios-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search notes, #tags, ideas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 text-sm rounded-2xl bg-white dark:bg-ios-gray-900 border border-ios-gray-200/80 dark:border-ios-gray-800 text-gray-900 dark:text-gray-100 placeholder-ios-gray-400 focus:ring-2 focus:ring-ios-blue shadow-sm transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <ListView
              notes={filteredNotes}
              topics={topics}
              topicsMap={topicsMap}
              tags={tags}
              selectedTopicId={selectedTopicId}
              onSelectTopic={setSelectedTopicId}
              selectedTags={selectedTags}
              onToggleTag={handleToggleTag}
              onClearTags={() => setSelectedTags([])}
              activeSmartFilter={activeSmartFilter}
              onSelectSmartFilter={setActiveSmartFilter}
              onToggleComplete={handleToggleComplete}
              onDeleteNote={handleDeleteNote}
              onEditNote={handleEditNote}
              onTagClick={handleTagClick}
              onOpenTopicManager={() => setIsTopicManagerOpen(true)}
            />
          </div>
        ) : (
          /* 📊 3. KANBAN TAB: Swimlanes with Drag and Drop */
          <KanbanBoard
            notes={filteredNotes}
            topics={topics}
            topicsMap={topicsMap}
            tags={tags}
            onToggleComplete={handleToggleComplete}
            onDeleteNote={handleDeleteNote}
            onEditNote={handleEditNote}
            onTagClick={handleTagClick}
            onQuickAddInColumn={handleQuickAddInColumn}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar for Easy Thumb Reach */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-ios-gray-900/90 backdrop-blur-lg border-t border-ios-gray-200/70 dark:border-ios-gray-800 px-6 py-2 pb-safe flex items-center justify-around">
        <button
          type="button"
          onClick={() => setTabMode('home')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
            tabMode === 'home' ? 'text-ios-blue font-bold' : 'text-ios-gray-400'
          }`}
        >
          <HomeIcon className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => setTabMode('notes')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
            tabMode === 'notes' ? 'text-ios-blue font-bold' : 'text-ios-gray-400'
          }`}
        >
          <ListIcon className="w-5 h-5" />
          <span>Notes</span>
        </button>

        <button
          type="button"
          onClick={() => setTabMode('kanban')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
            tabMode === 'kanban' ? 'text-ios-blue font-bold' : 'text-ios-gray-400'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span>Board</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEditingNote(null);
            setQuickAddColumn(null);
            setIsQuickCaptureOpen(true);
          }}
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-ios-blue"
        >
          <div className="w-7 h-7 rounded-full bg-ios-blue text-white flex items-center justify-center -mt-2 shadow-md">
            <Plus className="w-4 h-4" />
          </div>
          <span>New</span>
        </button>
      </nav>

      {/* Floating Action Button (Desktop/Tablet) */}
      <div className="hidden sm:block fixed right-6 bottom-6 z-40">
        <button
          type="button"
          onClick={() => {
            setEditingNote(null);
            setQuickAddColumn(null);
            setIsQuickCaptureOpen(true);
          }}
          className="flex items-center justify-center w-13 h-13 rounded-full bg-ios-blue text-white shadow-ios-hover hover:bg-blue-600 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-ios-blue/30"
          aria-label="Quick capture note"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Quick Capture Sheet Modal (for editing existing notes or FAB click) */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => {
          setIsQuickCaptureOpen(false);
          setEditingNote(null);
          setQuickAddColumn(null);
        }}
        topics={topics}
        recentTags={tags}
        editingNote={editingNote}
        defaultTopicId={selectedTopicId}
        defaultColumn={quickAddColumn || 'To-Do'}
      />

      {/* Topic Manager Modal */}
      <TopicManagerModal
        isOpen={isTopicManagerOpen}
        onClose={() => setIsTopicManagerOpen(false)}
        topics={topics}
      />

      {/* Firebase Cloud Backend Configuration Modal */}
      <FirebaseConfigModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        onConfigSaved={checkCloudConnection}
      />

      {/* Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
      />
    </div>
  );
};
