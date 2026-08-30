import React from 'react';
import { 
  NoteItem, 
  Topic, 
  Tag, 
  SmartFilter 
} from '../types';
import { NoteCard } from './NoteCard';
import { TopicChips } from './TopicChips';
import { TagPills } from './TagPills';
import { 
  CheckCircle, 
  Clock, 
  Flame, 
  Inbox, 
  Mic, 
  Sparkles,
  Tag as TagIcon
} from 'lucide-react';

interface ListViewProps {
  notes: NoteItem[];
  topics: Topic[];
  topicsMap: Map<string, Topic>;
  tags: Tag[];
  selectedTopicId: string | null;
  onSelectTopic: (id: string | null) => void;
  selectedTags: string[];
  onToggleTag: (tagName: string) => void;
  onClearTags: () => void;
  activeSmartFilter: SmartFilter;
  onSelectSmartFilter: (filter: SmartFilter) => void;
  onToggleComplete: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onEditNote: (note: NoteItem) => void;
  onTagClick: (tag: string) => void;
  onOpenTopicManager?: () => void;
}

export const ListView: React.FC<ListViewProps> = ({
  notes,
  topics,
  topicsMap,
  tags,
  selectedTopicId,
  onSelectTopic,
  selectedTags,
  onToggleTag,
  onClearTags,
  activeSmartFilter,
  onSelectSmartFilter,
  onToggleComplete,
  onDeleteNote,
  onEditNote,
  onTagClick,
  onOpenTopicManager,
}) => {
  const SMART_FILTERS: { id: SmartFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Notes', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'today', label: "Today's Reminders", icon: <Clock className="w-3.5 h-3.5 text-orange-500" /> },
    { id: 'urgent', label: 'Urgent', icon: <Flame className="w-3.5 h-3.5 text-red-500" /> },
    { id: 'voice', label: 'Voice Notes', icon: <Mic className="w-3.5 h-3.5 text-purple-500" /> },
    { id: 'untagged', label: 'Untagged', icon: <TagIcon className="w-3.5 h-3.5 text-gray-500" /> },
    { id: 'completed', label: 'Completed', icon: <CheckCircle className="w-3.5 h-3.5 text-green-500" /> },
  ];

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4 pb-28">
      {/* 1. Topic Bar */}
      <TopicChips
        topics={topics}
        selectedTopicId={selectedTopicId}
        onSelectTopic={onSelectTopic}
        onOpenTopicManager={onOpenTopicManager}
      />

      {/* 2. Smart Filters Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none px-4 -mx-4">
        {SMART_FILTERS.map((filter) => {
          const isSelected = activeSmartFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onSelectSmartFilter(filter.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 flex-shrink-0 select-none ${
                isSelected
                  ? 'bg-ios-blue text-white shadow-sm font-semibold'
                  : 'bg-white dark:bg-ios-gray-900 text-ios-gray-600 dark:text-ios-gray-300 border border-ios-gray-200 dark:border-ios-gray-800'
              }`}
            >
              {filter.icon}
              <span>{filter.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Tag Pills */}
      <TagPills
        tags={tags}
        selectedTags={selectedTags}
        onToggleTag={onToggleTag}
        onClearTags={onClearTags}
      />

      {/* 4. Notes Stream Cards */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-14 h-14 rounded-full bg-ios-gray-100 dark:bg-ios-gray-800 flex items-center justify-center text-ios-gray-400 mb-3">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">No notes found</h3>
          <p className="text-xs text-ios-gray-500 max-w-xs mt-1">
            No notes match your current filters. Switch to the Home tab to capture one!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              topicsMap={topicsMap}
              onToggleComplete={onToggleComplete}
              onDeleteNote={onDeleteNote}
              onEditNote={onEditNote}
              onTagClick={onTagClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};
