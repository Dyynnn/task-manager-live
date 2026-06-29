import { User, Project, Task, ApiError } from './types';

const SESSION_KEY = 'tasksync_session_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(SESSION_KEY, token);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: 'Request failed.' }))) as ApiError;
    throw new Error(body.error || 'Request failed.');
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authApi = {
  register(data: {
    fullName: string;
    username: string;
    email?: string;
    password: string;
    confirmPassword: string;
  }) {
    return request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login(username: string, password: string) {
    return request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  logout() {
    return request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  },

  me() {
    return request<{ user: User }>('/auth/me');
  },

  checkUsername(username: string) {
    return request<{ available: boolean; error?: string }>(
      `/auth/check-username?username=${encodeURIComponent(username)}`
    );
  },
};

export const projectsApi = {
  list() {
    return request<Project[]>('/projects');
  },

  create(name: string, color: string) {
    return request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
  },

  delete(id: string) {
    return request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' });
  },
};

export const tasksApi = {
  list() {
    return request<Task[]>('/tasks');
  },

  create(data: {
    projectId: string;
    title: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    subtasks?: Task['subtasks'];
  }) {
    return request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<Task>) {
    return request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        subtasks: data.subtasks,
      }),
    });
  },

  delete(id: string) {
    return request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
  },
};

export async function loadUserData() {
  const [projects, tasks] = await Promise.all([
    projectsApi.list(),
    tasksApi.list(),
  ]);
  return { projects, tasks };
}
