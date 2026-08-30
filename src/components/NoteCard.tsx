import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Trash2, 
  GripVertical,
  Flag
} from 'lucide-react';
import { NoteItem, Topic, PRIORITY_COLORS } from '../types';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface NoteCardProps {
  note: NoteItem;
  topicsMap: Map<string, Topic>;
  onToggleComplete: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onEditNote?: (note: NoteItem) => void;
  onTagClick?: (tag: string) => void;
  isDraggable?: boolean;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  topicsMap,
  onToggleComplete,
  onDeleteNote,
  onEditNote,
  onTagClick,
  isDraggable = false,
}) => {
  const topic = note.topicId ? topicsMap.get(note.topicId) : undefined;
  const priorityInfo = PRIORITY_COLORS[note.priority];

  const formattedReminder = note.reminderDate
    ? new Date(note.reminderDate).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', note.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onClick={() => onEditNote && onEditNote(note)}
      className={`group relative rounded-2xl bg-white dark:bg-ios-gray-900 border border-ios-gray-200/80 dark:border-ios-gray-800 p-4 shadow-sm hover:shadow-ios transition-all duration-200 ${
        note.isCompleted ? 'opacity-70 bg-ios-gray-50/50 dark:bg-ios-gray-950/40' : ''
      } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      {/* Leading Topic Accent Bar (if assigned) */}
      {topic && (
        <div
          className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
          style={{ backgroundColor: topic.colorHex }}
        />
      )}

      {/* Header: Checkbox + Priority + Title + Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* Completion Checkbox */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(note.id);
            }}
            className="mt-0.5 text-ios-gray-400 hover:text-green-500 transition-colors flex-shrink-0"
            aria-label={note.isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {note.isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 fill-green-500/20" />
            ) : (
              <Circle className="w-5 h-5 text-ios-gray-300 dark:text-ios-gray-600 hover:text-ios-gray-400" />
            )}
          </button>

          {/* Title and Topic */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Priority Dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: priorityInfo.dot }}
                title={`Priority: ${note.priority}`}
              />

              <h3
                className={`font-semibold text-base leading-snug text-gray-900 dark:text-gray-100 line-clamp-1 ${
                  note.isCompleted ? 'line-through text-ios-gray-400 dark:text-ios-gray-500' : ''
                }`}
              >
                {note.title || 'Untitled Note'}
              </h3>
            </div>

            {/* Topic label (if available) */}
            {topic && (
              <span
                className="inline-block mt-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: topic.colorHex }}
              >
                {topic.title}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          {isDraggable && (
            <span className="text-ios-gray-400 dark:text-ios-gray-600 cursor-grab">
              <GripVertical className="w-4 h-4" />
            </span>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNote(note.id);
            }}
            className="p-1 rounded-lg text-ios-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title="Delete Note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body text preview */}
      {note.bodyText && (
        <p className="mt-2 text-sm text-ios-gray-600 dark:text-ios-gray-300 line-clamp-2 leading-relaxed pl-7 whitespace-pre-wrap">
          {note.bodyText}
        </p>
      )}

      {/* Voice Note Player (if attached or uploaded) */}
      {(note.audioBlob || note.audioUrl) && (
        <div className="mt-3 pl-7">
          <VoiceNotePlayer 
            audioBlob={note.audioBlob} 
            audioUrl={note.audioUrl} 
            duration={note.audioDuration} 
            compact 
          />
        </div>
      )}

      {/* Footer: Tags + Reminders + Priority Badge */}
      <div className="mt-3.5 pt-2.5 border-t border-ios-gray-100 dark:border-ios-gray-800/80 flex items-center justify-between gap-2 pl-7 flex-wrap text-xs text-ios-gray-500">
        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {note.tags && note.tags.length > 0 ? (
            note.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick && onTagClick(tag);
                }}
                className="px-2 py-0.5 rounded-full bg-ios-gray-100 dark:bg-ios-gray-800 text-ios-gray-600 dark:text-ios-gray-300 text-[11px] font-medium hover:bg-ios-blue/10 hover:text-ios-blue transition-colors"
              >
                #{tag}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-ios-gray-400">Untagged</span>
          )}
        </div>

        {/* Right side: Reminder & Priority */}
        <div className="flex items-center gap-2">
          {note.isReminder && formattedReminder && (
            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium text-[11px] bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              <span>{formattedReminder}</span>
            </div>
          )}

          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 ${priorityInfo.bg} ${priorityInfo.text}`}>
            <Flag className="w-2.5 h-2.5" />
            {note.priority}
          </span>
        </div>
      </div>
    </div>
  );
};
