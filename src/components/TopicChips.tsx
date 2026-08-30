import React from 'react';
import { Layers, Plus, Settings } from 'lucide-react';
import { Topic } from '../types';

interface TopicChipsProps {
  topics: Topic[];
  selectedTopicId: string | null;
  onSelectTopic: (topicId: string | null) => void;
  onOpenTopicManager?: () => void;
}

export const TopicChips: React.FC<TopicChipsProps> = ({
  topics,
  selectedTopicId,
  onSelectTopic,
  onOpenTopicManager,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-none px-4 -mx-4">
      {/* "All Topics" Pill */}
      <button
        type="button"
        onClick={() => onSelectTopic(null)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 flex-shrink-0 select-none ${
          selectedTopicId === null
            ? 'bg-ios-gray-900 dark:bg-white text-white dark:text-black font-semibold shadow-sm'
            : 'bg-white dark:bg-ios-gray-900 text-ios-gray-600 dark:text-ios-gray-400 border border-ios-gray-200 dark:border-ios-gray-800'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        All Topics
      </button>

      {/* Individual Topic Pills */}
      {topics.map((topic) => {
        const isSelected = selectedTopicId === topic.id;
        return (
          <button
            key={topic.id}
            type="button"
            onClick={() => onSelectTopic(isSelected ? null : topic.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 flex-shrink-0 select-none ${
              isSelected
                ? 'text-white font-semibold shadow-sm'
                : 'bg-white dark:bg-ios-gray-900 text-ios-gray-700 dark:text-ios-gray-300 border border-ios-gray-200 dark:border-ios-gray-800'
            }`}
            style={{
              backgroundColor: isSelected ? topic.colorHex : undefined,
              borderColor: isSelected ? topic.colorHex : undefined,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: isSelected ? '#FFFFFF' : topic.colorHex }}
            />
            {topic.title}
          </button>
        );
      })}

      {/* "+ Add / Manage Topics" Pill */}
      {onOpenTopicManager && (
        <button
          type="button"
          onClick={onOpenTopicManager}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue border border-dashed border-ios-blue/40 hover:bg-ios-blue/20 transition-all active:scale-95 flex-shrink-0 select-none"
          title="Add or manage custom topics"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Topic</span>
          <Settings className="w-3 h-3 ml-0.5 opacity-60" />
        </button>
      )}
    </div>
  );
};
