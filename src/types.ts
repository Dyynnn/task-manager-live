export interface User {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  ownerId: string;
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'pending' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  subtasks: Subtask[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface ApiError {
  error: string;
  field?: string;
}
