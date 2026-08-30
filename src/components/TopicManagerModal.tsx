import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, Layers } from 'lucide-react';
import { Topic, TOPIC_PALETTE_COLORS } from '../types';
import { db } from '../db';
import { syncService } from '../services/syncService';

interface TopicManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  topics: Topic[];
}

export const TopicManagerModal: React.FC<TopicManagerModalProps> = ({
  isOpen,
  onClose,
  topics,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState(TOPIC_PALETTE_COLORS[0]);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editColor, setEditColor] = useState(TOPIC_PALETTE_COLORS[0]);

  if (!isOpen) return null;

  const handleAddTopic = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    const topic: Topic = {
      id: 'topic-' + Math.random().toString(36).substring(2, 9),
      title: newTitle.trim(),
      colorHex: newColor,
      createdAt: Date.now(),
    };

    await db.topics.add(topic);
    await syncService.syncTopic(topic);

    setNewTitle('');
    setNewColor(TOPIC_PALETTE_COLORS[0]);
  };

  const handleStartEdit = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setEditTitle(topic.title);
    setEditColor(topic.colorHex);
  };

  const handleSaveEdit = async () => {
    if (!editingTopicId || !editTitle.trim()) return;

    const updated = {
      title: editTitle.trim(),
      colorHex: editColor,
    };

    await db.topics.update(editingTopicId, updated);
    const fullTopic = await db.topics.get(editingTopicId);
    if (fullTopic) {
      await syncService.syncTopic(fullTopic);
    }

    setEditingTopicId(null);
  };

  const handleDeleteTopic = async (id: string) => {
    if (confirm('Delete this topic? Notes in this topic will become unassigned.')) {
      await db.topics.delete(id);
      await syncService.deleteTopic(id);

      // Reassign notes with this topic to null
      const notesWithTopic = await db.notes.where('topicId').equals(id).toArray();
      for (const n of notesWithTopic) {
        await db.notes.update(n.id, { topicId: null });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md rounded-3xl bg-white dark:bg-ios-gray-900 border border-ios-gray-200 dark:border-ios-gray-800 p-5 shadow-ios-modal space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ios-gray-100 dark:border-ios-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                Manage Topics
              </h3>
              <p className="text-xs text-ios-gray-500">
                Create & customize categories for your notes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-ios-gray-400 hover:text-ios-gray-600 dark:hover:text-ios-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New Topic Input */}
        <form onSubmit={handleAddTopic} className="space-y-2.5 p-3 rounded-2xl bg-ios-gray-50 dark:bg-ios-gray-800/40 border border-ios-gray-200 dark:border-ios-gray-700/50">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Add New Topic
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Fitness, Finance, Travel..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 text-xs rounded-xl px-3 py-2 bg-white dark:bg-ios-gray-900 border border-ios-gray-200 dark:border-ios-gray-700 focus:outline-none focus:ring-2 focus:ring-ios-blue"
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="flex items-center gap-1 px-4 py-2 text-xs font-semibold bg-ios-blue text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all shadow-sm flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-[11px] text-ios-gray-400">Color:</span>
            {TOPIC_PALETTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full transition-transform ${
                  newColor === c ? 'scale-125 ring-2 ring-offset-1 ring-ios-blue shadow-sm' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </form>

        {/* Existing Topics List */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          <span className="text-xs font-medium text-ios-gray-400 px-1">
            Current Topics ({topics.length})
          </span>

          {topics.length === 0 ? (
            <p className="text-xs text-ios-gray-400 py-3 text-center">No topics yet.</p>
          ) : (
            topics.map((t) => {
              const isEditing = editingTopicId === t.id;
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-ios-gray-800/80 border border-ios-gray-100 dark:border-ios-gray-700/60 shadow-sm"
                >
                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-2 pr-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 text-xs rounded-lg px-2 py-1 bg-ios-gray-100 dark:bg-ios-gray-900 border border-ios-gray-300 dark:border-ios-gray-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="p-1 rounded-lg bg-green-500 text-white"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {TOPIC_PALETTE_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className={`w-4 h-4 rounded-full ${
                              editColor === c ? 'ring-2 ring-offset-1 ring-ios-blue scale-110' : ''
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: t.colorHex }}
                        />
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {t.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(t)}
                          className="p-1 rounded-lg text-ios-gray-400 hover:text-ios-blue hover:bg-ios-gray-100 dark:hover:bg-ios-gray-700 transition-colors"
                          title="Edit Topic"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTopic(t.id)}
                          className="p-1 rounded-lg text-ios-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Delete Topic"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-ios-gray-100 dark:border-ios-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-ios-gray-100 dark:bg-ios-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-ios-gray-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
