import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Radio, 
  Square, 
  Clock, 
  X, 
  Trash2, 
  CornerDownLeft,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Zap
} from 'lucide-react';
import { NoteItem, Topic, Tag, TaskPriority, PRIORITY_COLORS } from '../types';
import { db, touchOrCreateTags } from '../db';
import { speechService } from '../services/speech';
import { audioService } from '../services/audio';
import { syncService } from '../services/syncService';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface HomeCaptureViewProps {
  topics: Topic[];
  recentTags: Tag[];
  recentNotes: NoteItem[];
  topicsMap: Map<string, Topic>;
  onGoToNotes: () => void;
}

export const HomeCaptureView: React.FC<HomeCaptureViewProps> = ({
  topics,
  recentTags: _recentTags,
  recentNotes,
  topicsMap,
  onGoToNotes,
}) => {
  const [inputText, setInputText] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [topicId, setTopicId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [justCapturedTitle, setJustCapturedTitle] = useState<string | null>(null);

  // Reminders
  const [isReminder, setIsReminder] = useState(false);
  const [reminderDateStr, setReminderDateStr] = useState('');
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  // Voice recording & Speech-to-Text
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>(undefined);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto focus on load
    textareaRef.current?.focus();
  }, []);

  // Parse inline #tags, @topics, and !priorities
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);

    // Auto-parse #tags
    const tagMatches = text.match(/#([a-zA-Z0-9_\-]+)/g);
    if (tagMatches) {
      const extracted = tagMatches.map((m) => m.substring(1).toLowerCase());
      setTags((prev) => Array.from(new Set([...prev, ...extracted])));
    }

    // Auto-parse @topics
    const topicMatch = text.match(/@([a-zA-Z0-9_\-]+)/i);
    if (topicMatch) {
      const matchedName = topicMatch[1].toLowerCase();
      const found = topics.find((t) => t.title.toLowerCase() === matchedName);
      if (found) {
        setTopicId(found.id);
      }
    }

    // Auto-parse !priorities
    if (text.includes('!urgent')) setPriority('Urgent');
    else if (text.includes('!high')) setPriority('High');
    else if (text.includes('!med') || text.includes('!medium')) setPriority('Medium');
    else if (text.includes('!low')) setPriority('Low');
  };

  // Toggle Speech-to-Text
  const toggleSpeech = () => {
    if (isTranscribing) {
      speechService.stop();
    } else {
      speechService.start(
        (transcript, isFinal) => {
          setInputText((prev) => {
            const separator = prev.trim() ? ' ' : '';
            return isFinal ? prev + separator + transcript : prev;
          });
        },
        (active) => setIsTranscribing(active),
        (err) => {
          console.warn('Speech error:', err);
          setIsTranscribing(false);
        }
      );
    }
  };

  // Toggle Audio Voice Memo
  const toggleAudio = async () => {
    if (isRecordingAudio) {
      try {
        const { blob, duration } = await audioService.stopRecording();
        setIsRecordingAudio(false);
        setAudioBlob(blob);
        setAudioDuration(duration);
        setTags((prev) => Array.from(new Set([...prev, 'voice'])));
      } catch (err) {
        console.error('Error stopping audio recording:', err);
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

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Quick Submit
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const raw = inputText.trim();
    if (!raw && !audioBlob) return;

    let cleanText = raw
      .replace(/#([a-zA-Z0-9_\-]+)/g, '')
      .replace(/@([a-zA-Z0-9_\-]+)/g, '')
      .replace(/!(urgent|high|medium|low|med)/gi, '')
      .trim();

    const lines = cleanText.split('\n').map((l) => l.trim()).filter(Boolean);
    const title = lines[0] || (raw ? raw.slice(0, 50) : 'Voice Note');
    const bodyText = lines.slice(1).join('\n');

    let parsedReminderDate: number | null = null;
    if (isReminder && reminderDateStr) {
      parsedReminderDate = new Date(reminderDateStr).getTime();
    }

    const noteToSave: NoteItem = {
      id: 'note-' + Math.random().toString(36).substring(2, 9),
      title,
      bodyText,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isReminder,
      reminderDate: parsedReminderDate,
      isCompleted: false,
      priority,
      kanbanStatus: 'To-Do',
      topicId: topicId || null,
      tags,
      audioBlob,
      audioDuration,
    };

    await db.notes.add(noteToSave);
    syncService.syncNote(noteToSave);

    if (tags.length > 0) {
      await touchOrCreateTags(tags);
    }

    // Flash success toast
    setJustCapturedTitle(title);
    setTimeout(() => setJustCapturedTitle(null), 3000);

    // Reset fields
    setInputText('');
    setTags([]);
    setPriority('Medium');
    setIsReminder(false);
    setReminderDateStr('');
    setShowReminderPicker(false);
    setAudioBlob(undefined);
    setAudioDuration(0);

    if (isTranscribing) speechService.stop();
    if (isRecordingAudio) audioService.cancelRecording();

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const currentTopic = topicId ? topics.find((t) => t.id === topicId) : undefined;
  const currentPriorityInfo = PRIORITY_COLORS[priority];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-3xl w-full mx-auto my-auto min-h-[calc(100vh-140px)]">
      {/* Welcome / Focus Heading */}
      <div className="text-center mb-6 space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue text-xs font-semibold mb-1">
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Capture Focus</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          What's on your mind?
        </h2>
        <p className="text-xs sm:text-sm text-ios-gray-500 max-w-md mx-auto">
          Type your task, thought, or idea. Use <span className="font-mono text-ios-blue">#tag</span> and <span className="font-mono text-purple-500">@topic</span> to organize instantly.
        </p>
      </div>

      {/* Primary Centered Writing Card */}
      <div className="w-full relative rounded-3xl bg-white dark:bg-ios-gray-900 border border-ios-gray-200/90 dark:border-ios-gray-800 shadow-ios-modal transition-all duration-200 overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
        <div className="p-5 sm:p-6 pb-3">
          <textarea
            ref={textareaRef}
            rows={3}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type task, thought, or memo (Press Enter ↵ to save)..."
            className="w-full bg-transparent text-base sm:text-lg text-gray-900 dark:text-gray-100 placeholder-ios-gray-400 focus:outline-none resize-none leading-relaxed"
          />

          {/* Voice Memo Player Preview */}
          {audioBlob && (
            <div className="flex items-center justify-between gap-2 my-2.5 p-2.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-900/40">
              <VoiceNotePlayer audioBlob={audioBlob} duration={audioDuration} compact />
              <button
                type="button"
                onClick={() => {
                  setAudioBlob(undefined);
                  setAudioDuration(0);
                }}
                className="p-1 text-ios-gray-400 hover:text-red-500 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Active Tags Chips */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 pb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue"
                >
                  #{t}
                  <button type="button" onClick={() => handleRemoveTag(t)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls & Quick Pills Bar */}
        <div className="px-5 py-3 border-t border-ios-gray-100 dark:border-ios-gray-800/80 bg-ios-gray-50/70 dark:bg-ios-gray-950/40 flex items-center justify-between gap-2 flex-wrap">
          {/* Left: Quick Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 1. Speech-to-Text Button */}
            <button
              type="button"
              onClick={toggleSpeech}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                isTranscribing
                  ? 'bg-red-500 text-white animate-pulse shadow-sm'
                  : 'bg-white dark:bg-ios-gray-800 text-ios-gray-700 dark:text-ios-gray-300 border border-ios-gray-200 dark:border-ios-gray-700 hover:text-ios-blue'
              }`}
              title="Dictate with voice"
            >
              {isTranscribing ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isTranscribing ? 'Listening...' : 'Dictate'}</span>
            </button>

            {/* 2. Record Voice Memo Button */}
            <button
              type="button"
              onClick={toggleAudio}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                isRecordingAudio
                  ? 'bg-purple-600 text-white animate-pulse shadow-sm'
                  : 'bg-white dark:bg-ios-gray-800 text-ios-gray-700 dark:text-ios-gray-300 border border-ios-gray-200 dark:border-ios-gray-700 hover:text-purple-600'
              }`}
              title="Record voice memo"
            >
              {isRecordingAudio ? <Square className="w-3.5 h-3.5 fill-current" /> : <Radio className="w-3.5 h-3.5" />}
              <span>
                {isRecordingAudio ? `${recordingDuration}s` : 'Voice Note'}
              </span>
            </button>

            {/* 3. Topic Selector Pill */}
            <div className="relative inline-flex items-center">
              <select
                value={topicId || ''}
                onChange={(e) => setTopicId(e.target.value || null)}
                className="appearance-none pl-6 pr-6 py-1.5 text-xs rounded-full bg-white dark:bg-ios-gray-800 border border-ios-gray-200 dark:border-ios-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="">No Topic</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <span
                className="w-2 h-2 rounded-full absolute left-2.5 pointer-events-none"
                style={{ backgroundColor: currentTopic ? currentTopic.colorHex : '#8E8E93' }}
              />
              <ChevronDown className="w-3 h-3 text-ios-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {/* 4. Priority Selector Pill */}
            <div className="relative inline-flex items-center">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="appearance-none pl-6 pr-5 py-1.5 text-xs rounded-full bg-white dark:bg-ios-gray-800 border border-ios-gray-200 dark:border-ios-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:outline-none cursor-pointer"
              >
                {(['Low', 'Medium', 'High', 'Urgent'] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <span
                className="w-2 h-2 rounded-full absolute left-2.5 pointer-events-none"
                style={{ backgroundColor: currentPriorityInfo.dot }}
              />
              <ChevronDown className="w-3 h-3 text-ios-gray-400 absolute right-1.5 pointer-events-none" />
            </div>

            {/* 5. Reminder Trigger */}
            <button
              type="button"
              onClick={() => {
                setShowReminderPicker(!showReminderPicker);
                if (!isReminder) setIsReminder(true);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isReminder && reminderDateStr
                  ? 'bg-orange-500/10 text-orange-600 border border-orange-500/30'
                  : 'bg-white dark:bg-ios-gray-800 text-ios-gray-700 dark:text-ios-gray-300 border border-ios-gray-200 dark:border-ios-gray-700 hover:text-orange-500'
              }`}
              title="Set a reminder"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isReminder && reminderDateStr ? 'Reminder Set' : 'Reminder'}
              </span>
            </button>
          </div>

          {/* Right: Capture Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!inputText.trim() && !audioBlob}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-ios-blue text-white text-xs font-semibold hover:bg-blue-600 disabled:opacity-40 transition-all shadow-sm active:scale-95 ml-auto"
          >
            <span>Capture</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Reminder Date Picker Popover */}
        {showReminderPicker && (
          <div className="p-3.5 border-t border-ios-gray-100 dark:border-ios-gray-800 bg-orange-50/40 dark:bg-orange-950/20 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1">
              <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <input
                type="datetime-local"
                value={reminderDateStr}
                onChange={(e) => {
                  setReminderDateStr(e.target.value);
                  setIsReminder(true);
                }}
                className="text-xs rounded-xl px-3 py-2 bg-white dark:bg-ios-gray-800 border border-ios-gray-200 dark:border-ios-gray-700 text-gray-900 dark:text-gray-100 font-medium"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setShowReminderPicker(false);
                setIsReminder(false);
                setReminderDateStr('');
              }}
              className="text-xs text-ios-gray-400 hover:text-red-500"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Success Flash Notification */}
      {justCapturedTitle && (
        <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4" />
          <span>Saved: "{justCapturedTitle}"</span>
        </div>
      )}

      {/* Bottom Shortcuts / Recent Quick Preview */}
      <div className="mt-8 w-full flex items-center justify-between text-xs text-ios-gray-500 px-2">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-ios-blue" />
          <span>{recentNotes.length} notes captured</span>
        </span>

        <button
          type="button"
          onClick={onGoToNotes}
          className="flex items-center gap-1 text-ios-blue hover:underline font-semibold"
        >
          <span>View Notes Stream</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick 2 Recent Notes Preview Cards */}
      {recentNotes.length > 0 && (
        <div className="w-full mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 opacity-90 hover:opacity-100 transition-opacity">
          {recentNotes.slice(0, 2).map((n) => {
            const topic = n.topicId ? topicsMap.get(n.topicId) : undefined;
            return (
              <div
                key={n.id}
                onClick={onGoToNotes}
                className="p-3 rounded-2xl bg-white/70 dark:bg-ios-gray-900/70 border border-ios-gray-200/60 dark:border-ios-gray-800 text-xs cursor-pointer hover:border-ios-blue/40 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {n.title || 'Untitled'}
                  </span>
                  {topic && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium flex-shrink-0"
                      style={{ backgroundColor: topic.colorHex }}
                    >
                      {topic.title}
                    </span>
                  )}
                </div>
                {n.bodyText && (
                  <p className="mt-1 text-ios-gray-500 line-clamp-1 text-[11px]">
                    {n.bodyText}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
