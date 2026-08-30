import React from 'react';
import { Tag as TagIcon, X } from 'lucide-react';
import { Tag } from '../types';

interface TagPillsProps {
  tags: Tag[];
  selectedTags: string[];
  onToggleTag: (tagName: string) => void;
  onClearTags?: () => void;
}

export const TagPills: React.FC<TagPillsProps> = ({
  tags,
  selectedTags,
  onToggleTag,
  onClearTags,
}) => {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 scrollbar-none px-4 -mx-4">
      {selectedTags.length > 0 && onClearTags && (
        <button
          type="button"
          onClick={onClearTags}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-200 transition-colors flex-shrink-0"
        >
          <X className="w-3 h-3" />
          Clear ({selectedTags.length})
        </button>
      )}

      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag.name);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggleTag(tag.name)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95 flex-shrink-0 select-none ${
              isSelected
                ? 'bg-ios-blue text-white shadow-sm font-semibold'
                : 'bg-white dark:bg-ios-gray-900 text-ios-gray-600 dark:text-ios-gray-300 border border-ios-gray-200 dark:border-ios-gray-800 hover:border-ios-blue/40'
            }`}
          >
            <TagIcon className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-ios-gray-400'}`} />
            #{tag.name}
          </button>
        );
      })}
    </div>
  );
};
