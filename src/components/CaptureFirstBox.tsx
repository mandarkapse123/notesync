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
  ChevronDown
} from 'lucide-react';
import { NoteItem, Topic, Tag, TaskPriority, PRIORITY_COLORS } from '../types';
import { db, touchOrCreateTags } from '../db';
import { speechService } from '../services/speech';
import { audioService } from '../services/audio';
import { syncService } from '../services/syncService';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface CaptureFirstBoxProps {
  topics: Topic[];
  recentTags: Tag[];
  selectedTopicId: string | null;
  onNoteCreated?: (note: NoteItem) => void;
}

export const CaptureFirstBox: React.FC<CaptureFirstBoxProps> = ({
  topics,
  recentTags: _recentTags,
  selectedTopicId,
  onNoteCreated,
}) => {
  const [inputText, setInputText] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [topicId, setTopicId] = useState<string | null>(selectedTopicId);
  const [tags, setTags] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Sync default topic if parent filter changes
  useEffect(() => {
    if (selectedTopicId) {
      setTopicId(selectedTopicId);
    }
  }, [selectedTopicId]);

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

    // Auto-parse @topics (e.g. @Work, @Personal)
    const topicMatch = text.match(/@([a-zA-Z0-9_\-]+)/i);
    if (topicMatch) {
      const matchedName = topicMatch[1].toLowerCase();
      const found = topics.find((t) => t.title.toLowerCase() === matchedName);
      if (found) {
        setTopicId(found.id);
      }
    }

    // Auto-parse !priorities (!urgent, !high, !medium, !low)
    if (text.includes('!urgent')) setPriority('Urgent');
    else if (text.includes('!high')) setPriority('High');
    else if (text.includes('!med') || text.includes('!medium')) setPriority('Medium');
    else if (text.includes('!low')) setPriority('Low');

    if (text.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  };

  // Toggle Live Speech-to-Text
  const toggleSpeech = () => {
    if (isTranscribing) {
      speechService.stop();
    } else {
      setIsExpanded(true);
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
        setIsExpanded(true);
      } catch (err) {
        console.error('Error stopping audio recording:', err);
        setIsRecordingAudio(false);
      }
    } else {
      setRecordingDuration(0);
      setIsExpanded(true);
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

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Quick Submit
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const raw = inputText.trim();
    if (!raw && !audioBlob) return;

    // Clean inline syntax tags from title/body if present for clean title
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

    // Save to IndexedDB local storage
    await db.notes.add(noteToSave);

    // Sync to Supabase cloud
    syncService.syncNote(noteToSave);

    if (tags.length > 0) {
      await touchOrCreateTags(tags);
    }

    if (onNoteCreated) {
      onNoteCreated(noteToSave);
    }

    // Reset box
    setInputText('');
    setTags([]);
    setPriority('Medium');
    setIsReminder(false);
    setReminderDateStr('');
    setShowReminderPicker(false);
    setAudioBlob(undefined);
    setAudioDuration(0);
    setIsExpanded(false);

    // Stop speech/audio if running
    if (isTranscribing) speechService.stop();
    if (isRecordingAudio) audioService.cancelRecording();

    // Re-focus
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter key (without Shift) captures immediately!
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const currentTopic = topicId ? topics.find((t) => t.id === topicId) : undefined;
  const currentPriorityInfo = PRIORITY_COLORS[priority];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-2 pb-1">
      <div 
        className={`relative rounded-3xl bg-white dark:bg-ios-gray-900 border border-ios-gray-200/90 dark:border-ios-gray-800 shadow-ios transition-all duration-200 ${
          isExpanded ? 'ring-2 ring-ios-blue/30 shadow-ios-hover' : ''
        }`}
      >
        {/* Main Input Text Area */}
        <div className="p-4 pb-2">
          <textarea
            ref={textareaRef}
            rows={isExpanded ? 3 : 1}
            value={inputText}
            onChange={handleInputChange}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={handleKeyDown}
            placeholder="⚡ What's on your mind? Type task, #tags, @topic (Press Enter to save)..."
            className="w-full bg-transparent text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-ios-gray-400 focus:outline-none resize-none leading-relaxed transition-all"
          />

          {/* Voice Memo Player Preview (if recorded) */}
          {audioBlob && (
            <div className="flex items-center justify-between gap-2 my-2 p-2 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-900/40">
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

        {/* Action Controls & Quick Pills */}
        <div className="px-4 py-2.5 border-t border-ios-gray-100 dark:border-ios-gray-800/80 bg-ios-gray-50/50 dark:bg-ios-gray-950/30 rounded-b-3xl flex items-center justify-between gap-2 flex-wrap">
          {/* Left: Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 1. Speech-to-Text Button */}
            <button
              type="button"
              onClick={toggleSpeech}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                isTranscribing
                  ? 'bg-red-500 text-white animate-pulse shadow-sm'
                  : 'bg-white dark:bg-ios-gray-800 text-ios-gray-700 dark:text-ios-gray-300 border border-ios-gray-200 dark:border-ios-gray-700 hover:text-ios-blue'
              }`}
              title="Dictate with voice"
            >
              {isTranscribing ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isTranscribing ? 'Listening...' : 'Dictate'}</span>
            </button>

            {/* 2. Record Voice Memo Button */}
            <button
              type="button"
              onClick={toggleAudio}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                isRecordingAudio
                  ? 'bg-purple-600 text-white animate-pulse shadow-sm'
                  : 'bg-white dark:bg-ios-gray-800 text-ios-gray-700 dark:text-ios-gray-300 border border-ios-gray-200 dark:border-ios-gray-700 hover:text-purple-600'
              }`}
              title="Record voice memo"
            >
              {isRecordingAudio ? <Square className="w-3.5 h-3.5 fill-current" /> : <Radio className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
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
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
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

          {/* Right: Capture Action Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!inputText.trim() && !audioBlob}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-ios-blue text-white text-xs font-semibold hover:bg-blue-600 disabled:opacity-40 transition-all shadow-sm active:scale-95 ml-auto"
          >
            <span>Capture</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Reminder Date Picker Popover */}
        {showReminderPicker && (
          <div className="p-3 border-t border-ios-gray-100 dark:border-ios-gray-800 bg-orange-50/40 dark:bg-orange-950/20 rounded-b-3xl flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1">
              <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <input
                type="datetime-local"
                value={reminderDateStr}
                onChange={(e) => {
                  setReminderDateStr(e.target.value);
                  setIsReminder(true);
                }}
                className="text-xs rounded-xl px-2.5 py-1.5 bg-white dark:bg-ios-gray-800 border border-ios-gray-200 dark:border-ios-gray-700 text-gray-900 dark:text-gray-100 font-medium"
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
    </div>
  );
};
