
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

// Data for CalendarEvent module
export interface CalendarEventData {
  '@type': 'CalendarEvent';
  summary: string;
  description: string;
  start: string;
  end: string;
  location: string;
}

// Data for MapDisplay module
export interface MapData {
  '@type': 'Map';
  latitude: number;
  longitude: number;
  label: string;
  zoom?: number;
}

// Data for ChartDisplay module (expects an SVG string)
export interface ChartData {
  '@type': 'Chart';
  title: string;
  svg: string;
}

// Data for HtmlPreview module
export interface HtmlSnippetData {
  '@type': 'HtmlSnippet';
  html: string;
  css?: string;
  js?: string;
}

// Data for DataTable module
export interface DataTableData {
  headers: string[];
  rows: (string | number | null)[][];
}

// Data for chunk prioritization
export interface ChunkPriority {
  chunk_index: number;
  score: number;
}
