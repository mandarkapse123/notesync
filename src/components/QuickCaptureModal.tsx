import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Radio, 
  Square, 
  Clock, 
  Plus, 
  Sparkles, 
  Trash2
} from 'lucide-react';
import { NoteItem, Topic, Tag, TaskPriority, KanbanColumn, TOPIC_PALETTE_COLORS } from '../types';
import { db, touchOrCreateTags } from '../db';
import { speechService } from '../services/speech';
import { audioService } from '../services/audio';
import { syncService } from '../services/syncService';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  topics: Topic[];
  recentTags: Tag[];
  editingNote?: NoteItem | null;
  defaultTopicId?: string | null;
  defaultColumn?: KanbanColumn;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  onClose,
  topics,
  recentTags,
  editingNote = null,
  defaultTopicId = null,
  defaultColumn = 'To-Do',
}) => {
  const [title, setTitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(defaultTopicId);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // Reminders
  const [isReminder, setIsReminder] = useState(false);
  const [reminderDateStr, setReminderDateStr] = useState('');

  // Speech-to-Text state
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>(undefined);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // New Topic creation modal state
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicColor, setNewTopicColor] = useState(TOPIC_PALETTE_COLORS[0]);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset or populate fields when opening
  useEffect(() => {
    if (isOpen) {
      if (editingNote) {
        setTitle(editingNote.title);
        setBodyText(editingNote.bodyText);
        setPriority(editingNote.priority);
        setSelectedTopicId(editingNote.topicId || null);
        setTags(editingNote.tags || []);
        setIsReminder(editingNote.isReminder);
        if (editingNote.reminderDate) {
          const d = new Date(editingNote.reminderDate);
          // format YYYY-MM-DDTHH:mm
          const pad = (n: number) => (n < 10 ? '0' + n : n);
          setReminderDateStr(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          );
        } else {
          setReminderDateStr('');
        }
        setAudioBlob(editingNote.audioBlob);
        setAudioDuration(editingNote.audioDuration || 0);
      } else {
        setTitle('');
        setBodyText('');
        setPriority('Medium');
        setSelectedTopicId(defaultTopicId || null);
        setTags([]);
        setIsReminder(false);
        setReminderDateStr('');
        setAudioBlob(undefined);
        setAudioDuration(0);
      }

      // Auto-focus title input
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    } else {
      // Clean up any ongoing audio/speech
      if (isTranscribing) speechService.stop();
      if (isRecordingAudio) audioService.cancelRecording();
    }
  }, [isOpen, editingNote, defaultTopicId]);

  // Parse inline #tags from title and body
  const parseInlineTags = (text: string) => {
    const matches = text.match(/#([a-zA-Z0-9_\-]+)/g);
    if (matches) {
      const extracted = matches.map((m) => m.substring(1).toLowerCase());
      setTags((prev) => Array.from(new Set([...prev, ...extracted])));
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    parseInlineTags(val);
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBodyText(val);
    parseInlineTags(val);
  };

  // Toggle Live Speech-to-Text
  const toggleSpeechRecognition = () => {
    if (isTranscribing) {
      speechService.stop();
    } else {
      speechService.start(
        (transcript, isFinal) => {
          setBodyText((prev) => {
            const separator = prev.trim() ? ' ' : '';
            return isFinal ? prev + separator + transcript : prev;
          });
        },
        (active) => {
          setIsTranscribing(active);
        },
        (err) => {
          console.warn('Speech error:', err);
          setIsTranscribing(false);
        }
      );
    }
  };

  // Toggle Voice Note Audio Recording
  const toggleAudioRecording = async () => {
    if (isRecordingAudio) {
      try {
        const { blob, duration } = await audioService.stopRecording();
        setIsRecordingAudio(false);
        setAudioBlob(blob);
        setAudioDuration(duration);
        // Automatically add #voice tag
        setTags((prev) => Array.from(new Set([...prev, 'voice'])));
      } catch (err) {
        console.error('Error stopping recording:', err);
        setIsRecordingAudio(false);
      }
    } else {
      setRecordingDuration(0);
      const started = await audioService.startRecording(
        (sec) => setRecordingDuration(sec),
        (err) => {
          alert('Could not access microphone: ' + err.message);
          setIsRecordingAudio(false);
        }
      );
      if (started) {
        setIsRecordingAudio(true);
      }
    }
  };

  // Add Tag manually
  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleCreateTopic = async () => {
    if (!newTopicTitle.trim()) return;
    const newTopic: Topic = {
      id: 'topic-' + Math.random().toString(36).substring(2, 9),
      title: newTopicTitle.trim(),
      colorHex: newTopicColor,
      createdAt: Date.now(),
    };
    await db.topics.add(newTopic);
    await syncService.syncTopic(newTopic);
    setSelectedTopicId(newTopic.id);
    setNewTopicTitle('');
    setShowNewTopic(false);
  };

  // Save Note to IndexedDB and sync to Supabase
  const handleSave = async () => {
    if (!title.trim() && !bodyText.trim() && !audioBlob && !editingNote?.audioUrl) {
      onClose();
      return;
    }

    let parsedReminderDate: number | null = null;
    if (isReminder && reminderDateStr) {
      parsedReminderDate = new Date(reminderDateStr).getTime();
    }

    const noteToSave: NoteItem = {
      id: editingNote ? editingNote.id : 'note-' + Math.random().toString(36).substring(2, 9),
      title: title.trim() || 'Untitled Note',
      bodyText: bodyText.trim(),
      createdAt: editingNote ? editingNote.createdAt : Date.now(),
      updatedAt: Date.now(),
      isReminder,
      reminderDate: parsedReminderDate,
      isCompleted: editingNote ? editingNote.isCompleted : false,
      priority,
      kanbanStatus: editingNote ? editingNote.kanbanStatus : defaultColumn,
      topicId: selectedTopicId,
      tags,
      audioBlob,
      audioUrl: editingNote?.audioUrl,
      audioDuration,
    };

    if (editingNote) {
      await db.notes.put(noteToSave);
    } else {
      await db.notes.add(noteToSave);
    }

    // Sync to Supabase in background
    syncService.syncNote(noteToSave);

    // Touch or create tags in DB
    if (tags.length > 0) {
      await touchOrCreateTags(tags);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-ios-gray-900 border border-ios-gray-200 dark:border-ios-gray-800 shadow-ios-modal flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ios-gray-100 dark:border-ios-gray-800/80">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-ios-blue animate-pulse" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {editingNote ? 'Edit Note' : 'Quick Capture'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-ios-gray-400 hover:text-ios-gray-600 dark:hover:text-ios-gray-200 hover:bg-ios-gray-100 dark:hover:bg-ios-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Note Title */}
          <div>
            <input
              ref={titleInputRef}
              type="text"
              placeholder="Title or idea... (e.g. #ideas Review project)"
              value={title}
              onChange={handleTitleChange}
              className="w-full font-semibold text-lg bg-transparent text-gray-900 dark:text-gray-100 placeholder-ios-gray-400 focus:outline-none"
            />
          </div>

          {/* Note Body */}
          <div className="relative">
            <textarea
              placeholder="Add details, notes, or use mic to transcribe speech..."
              value={bodyText}
              onChange={handleBodyChange}
              rows={3}
              className="w-full text-sm bg-transparent text-gray-800 dark:text-gray-200 placeholder-ios-gray-400 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Voice Note Player (if recorded or attached) */}
          {(audioBlob || editingNote?.audioUrl) && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
              <div className="flex-1">
                <VoiceNotePlayer 
                  audioBlob={audioBlob} 
                  audioUrl={editingNote?.audioUrl} 
                  duration={audioDuration} 
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setAudioBlob(undefined);
                  setAudioDuration(0);
                  if (editingNote) editingNote.audioUrl = undefined;
                }}
                className="p-1.5 text-ios-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                title="Remove recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Voice Input Toolbar (Speech-to-Text & Audio Recording) */}
          <div className="flex items-center gap-2 py-2 border-y border-ios-gray-100 dark:border-ios-gray-800/80">
            {/* Live Dictation (Speech-to-Text) */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                isTranscribing
                  ? 'bg-red-500 text-white animate-pulse shadow-sm'
                  : 'bg-ios-gray-100 dark:bg-ios-gray-800 text-ios-gray-700 dark:text-ios-gray-300 hover:bg-ios-blue/10 hover:text-ios-blue'
              }`}
              title="Dictate text using your voice"
            >
              {isTranscribing ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isTranscribing ? 'Listening...' : 'Speech-to-Text'}</span>
            </button>

            {/* Record Voice Note */}
            <button
              type="button"
              onClick={toggleAudioRecording}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                isRecordingAudio
                  ? 'bg-purple-600 text-white animate-pulse shadow-sm'
                  : 'bg-ios-gray-100 dark:bg-ios-gray-800 text-ios-gray-700 dark:text-ios-gray-300 hover:bg-purple-500/10 hover:text-purple-600'
              }`}
              title="Record an audio voice memo"
            >
              {isRecordingAudio ? <Square className="w-3.5 h-3.5 fill-current" /> : <Radio className="w-3.5 h-3.5" />}
              <span>
                {isRecordingAudio ? `Recording (${recordingDuration}s)...` : 'Record Voice Note'}
              </span>
            </button>
          </div>

          {/* Topic & Priority Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Topic Selector */}
            <div>
              <label className="block text-xs font-medium text-ios-gray-500 mb-1.5">Topic</label>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedTopicId || ''}
                  onChange={(e) => setSelectedTopicId(e.target.value || null)}
                  className="flex-1 text-xs rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800 border-none p-2.5 text-gray-900 dark:text-gray-100 font-medium focus:ring-1 focus:ring-ios-blue"
                >
                  <option value="">No Topic</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowNewTopic(true)}
                  className="p-2.5 rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800 text-ios-gray-500 hover:text-ios-blue transition-colors"
                  title="Create new topic"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Priority Selector */}
            <div>
              <label className="block text-xs font-medium text-ios-gray-500 mb-1.5">Priority</label>
              <div className="grid grid-cols-4 gap-1 p-0.5 rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800">
                {(['Low', 'Medium', 'High', 'Urgent'] as TaskPriority[]).map((p) => {
                  const isSelected = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                        isSelected
                          ? 'bg-white dark:bg-ios-gray-700 text-gray-900 dark:text-gray-100 shadow-sm font-semibold'
                          : 'text-ios-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* New Topic Inline Creator */}
          {showNewTopic && (
            <div className="p-3 rounded-2xl bg-ios-gray-50 dark:bg-ios-gray-800/60 border border-ios-gray-200 dark:border-ios-gray-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">New Topic</span>
                <button
                  type="button"
                  onClick={() => setShowNewTopic(false)}
                  className="text-ios-gray-400 hover:text-ios-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Topic title..."
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  className="flex-1 text-xs rounded-lg px-2.5 py-1.5 bg-white dark:bg-ios-gray-900 border border-ios-gray-200 dark:border-ios-gray-700"
                />
                <button
                  type="button"
                  onClick={handleCreateTopic}
                  className="px-3 py-1.5 text-xs font-semibold bg-ios-blue text-white rounded-lg hover:bg-blue-600"
                >
                  Add
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {TOPIC_PALETTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTopicColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      newTopicColor === c ? 'scale-125 ring-2 ring-offset-1 ring-ios-blue' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tags Section */}
          <div>
            <label className="block text-xs font-medium text-ios-gray-500 mb-1.5">Tags</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <form onSubmit={handleAddTag} className="inline-flex">
                <input
                  type="text"
                  placeholder="+ Add tag (Enter)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="text-xs bg-transparent placeholder-ios-gray-400 focus:outline-none px-1 py-1 w-28"
                />
              </form>
            </div>

            {/* Tag suggestions */}
            {recentTags.length > 0 && (
              <div className="flex items-center gap-1 mt-2 overflow-x-auto scrollbar-none py-1">
                <span className="text-[11px] text-ios-gray-400 flex items-center gap-1 flex-shrink-0">
                  <Sparkles className="w-3 h-3" /> Suggested:
                </span>
                {recentTags
                  .filter((rt) => !tags.includes(rt.name))
                  .slice(0, 5)
                  .map((rt) => (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => setTags([...tags, rt.name])}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-ios-gray-100 dark:bg-ios-gray-800 text-ios-gray-600 dark:text-ios-gray-400 hover:bg-ios-blue/10 hover:text-ios-blue flex-shrink-0"
                    >
                      #{rt.name}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Reminder Toggle */}
          <div className="pt-2 border-t border-ios-gray-100 dark:border-ios-gray-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  Set Task Reminder
                </span>
              </div>
              <input
                type="checkbox"
                checked={isReminder}
                onChange={(e) => setIsReminder(e.target.checked)}
                className="w-4 h-4 accent-ios-blue rounded cursor-pointer"
              />
            </div>

            {isReminder && (
              <div className="mt-2.5">
                <input
                  type="datetime-local"
                  value={reminderDateStr}
                  onChange={(e) => setReminderDateStr(e.target.value)}
                  className="w-full text-xs rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800 p-2.5 text-gray-900 dark:text-gray-100 font-medium focus:ring-1 focus:ring-ios-blue"
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-ios-gray-100 dark:border-ios-gray-800/80 bg-ios-gray-50/50 dark:bg-ios-gray-950/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-ios-gray-600 dark:text-ios-gray-400 hover:bg-ios-gray-100 dark:hover:bg-ios-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-ios-blue hover:bg-blue-600 active:scale-95 rounded-xl shadow-sm transition-all"
          >
            {editingNote ? 'Save Changes' : 'Create Note'}
          </button>
        </div>
      </div>
    </div>
  );
};
