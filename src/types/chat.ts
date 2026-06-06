export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  files?: FileRef[];
  usage?: { prompt: number; completion: number; cacheHit: number; cacheMiss: number };
}

export interface FileRef {
  path: string;
  type: 'read' | 'write' | 'edit' | 'diff';
}

export interface Conversation {
  id: string;
  title: string;
  project: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export type Mode = 'yolo' | 'ask' | 'plan';
