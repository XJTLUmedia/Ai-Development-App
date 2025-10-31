
export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
}

export interface StoredFile {
  name: string;
  content: string;
}

export interface Citation {
  uri: string;
  title: string;
}

export interface TaskOutput {
  taskId: string;
  taskDescription: string;
  output: string;
  citations: Citation[];
}
