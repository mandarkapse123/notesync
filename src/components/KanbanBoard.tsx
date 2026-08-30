import React, { useState } from 'react';
import { 
  KanbanColumn, 
  NoteItem, 
  Topic, 
  Tag,
  KANBAN_COLUMNS 
} from '../types';
import { NoteCard } from './NoteCard';
import { db } from '../db';
import { syncService } from '../services/syncService';
import { Plus } from 'lucide-react';

interface KanbanBoardProps {
  notes: NoteItem[];
  topics: Topic[];
  topicsMap: Map<string, Topic>;
  tags: Tag[];
  onToggleComplete: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onEditNote: (note: NoteItem) => void;
  onTagClick?: (tag: string) => void;
  onQuickAddInColumn?: (column: KanbanColumn) => void;
}

const COLUMN_THEMES: Record<KanbanColumn, { title: string; color: string; badge: string }> = {
  'Backlog': { title: 'Backlog', color: '#8E8E93', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  'To-Do': { title: 'To-Do', color: '#007AFF', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  'In Progress': { title: 'In Progress', color: '#FF9500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  'Done': { title: 'Done', color: '#34C759', badge: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  notes,
  topics: _topics,
  topicsMap,
  tags: _tags,
  onToggleComplete,
  onDeleteNote,
  onEditNote,
  onTagClick,
  onQuickAddInColumn,
}) => {
  const [activeDropColumn, setActiveDropColumn] = useState<KanbanColumn | null>(null);

  const handleDragOver = (e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropColumn !== column) {
      setActiveDropColumn(column);
    }
  };

  const handleDragLeave = (e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    if (activeDropColumn === column) {
      setActiveDropColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: KanbanColumn) => {
    e.preventDefault();
    setActiveDropColumn(null);
    const noteId = e.dataTransfer.getData('text/plain');
    if (!noteId) return;

    const note = notes.find((n) => n.id === noteId);
    if (note && note.kanbanStatus !== targetColumn) {
      const updatedFields = {
        kanbanStatus: targetColumn,
        isCompleted: targetColumn === 'Done' ? true : note.isCompleted,
        updatedAt: Date.now(),
      };
      await db.notes.update(noteId, updatedFields);
      syncService.syncNote({ ...note, ...updatedFields });
    }
  };

  return (
    <div className="flex-1 overflow-x-auto p-4 sm:p-6 scrollbar-none">
      <div className="flex items-start gap-4 min-w-[1050px] pb-6">
        {KANBAN_COLUMNS.map((column) => {
          const theme = COLUMN_THEMES[column];
          const columnNotes = notes
            .filter((n) => (n.kanbanStatus || 'To-Do') === column)
            .sort((a, b) => b.updatedAt - a.updatedAt);
          const isTargeted = activeDropColumn === column;

          return (
            <div
              key={column}
              onDragOver={(e) => handleDragOver(e, column)}
              onDragLeave={(e) => handleDragLeave(e, column)}
              onDrop={(e) => handleDrop(e, column)}
              className={`w-[270px] sm:w-[300px] flex-shrink-0 rounded-2xl flex flex-col max-h-[calc(100vh-140px)] transition-all duration-150 ${
                isTargeted
                  ? 'bg-blue-50/80 dark:bg-blue-950/30 ring-2 ring-ios-blue shadow-lg'
                  : 'bg-ios-gray-100/70 dark:bg-ios-gray-900/60 border border-ios-gray-200/50 dark:border-ios-gray-800'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 flex items-center justify-between border-b border-ios-gray-200/50 dark:border-ios-gray-800/80">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: theme.color }}
                  />
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {theme.title}
                  </h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${theme.badge}`}>
                    {columnNotes.length}
                  </span>
                </div>

                {onQuickAddInColumn && (
                  <button
                    type="button"
                    onClick={() => onQuickAddInColumn(column)}
                    className="p-1 rounded-lg text-ios-gray-400 hover:text-ios-blue hover:bg-white dark:hover:bg-ios-gray-800 transition-colors"
                    title={`Add note to ${column}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Cards Container */}
              <div className="p-3 overflow-y-auto space-y-3 flex-1 scrollbar-none min-h-[150px]">
                {columnNotes.length === 0 ? (
                  <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-ios-gray-200 dark:border-ios-gray-800 rounded-xl text-xs text-ios-gray-400 select-none">
                    Drop notes here
                  </div>
                ) : (
                  columnNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      topicsMap={topicsMap}
                      onToggleComplete={onToggleComplete}
                      onDeleteNote={onDeleteNote}
                      onEditNote={onEditNote}
                      onTagClick={onTagClick}
                      isDraggable
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
