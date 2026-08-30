export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type KanbanColumn = 'Backlog' | 'To-Do' | 'In Progress' | 'Done';

export interface Topic {
  id: string;
  title: string;
  colorHex: string;
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  lastUsedAt: number;
}

export interface NoteItem {
  id: string;
  title: string;
  bodyText: string;
  createdAt: number;
  updatedAt: number;
  
  // Reminders & Task Status
  isReminder: boolean;
  reminderDate?: number | null;
  isCompleted: boolean;
  
  // Organization
  priority: TaskPriority;
  kanbanStatus: KanbanColumn;
  topicId?: string | null;
  tags: string[]; // array of tag names (lowercased)
  
  // Voice Recording
  audioBlob?: Blob;
  audioUrl?: string;
  audioDuration?: number;
}

export type SmartFilter = 'all' | 'today' | 'urgent' | 'untagged' | 'voice' | 'completed';

export const TOPIC_PALETTE_COLORS = [
  '#007AFF', // Blue
  '#5856D6', // Purple
  '#34C759', // Green
  '#FF9500', // Orange
  '#FF3B30', // Red
  '#5AC8FA', // Teal
  '#FF2D55', // Pink
  '#AF52DE', // Indigo
  '#FFCC00', // Yellow
  '#636366', // Slate Gray
];

export const PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string; dot: string }> = {
  Low: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', dot: '#007AFF' },
  Medium: { bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400', dot: '#FFCC00' },
  High: { bg: 'bg-orange-500/10 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400', dot: '#FF9500' },
  Urgent: { bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', dot: '#FF3B30' },
};

export const KANBAN_COLUMNS: KanbanColumn[] = ['Backlog', 'To-Do', 'In Progress', 'Done'];
