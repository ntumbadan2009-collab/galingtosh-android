export type ProjectType =
  | "documentary" | "fiction" | "short_film" | "music_video" | "ad"
  | "institutional" | "reportage" | "educational" | "social"
  | "photo_story" | "custom";

export interface Project {
  id: string;
  user_id: string;
  title: string;
  type: ProjectType;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RenderJob {
  id: string;
  project_id: string;
  film_version: number;
  status: "queued" | "running" | "done" | "failed" | "canceled";
  progress: number;
  output_path: string | null;
  error: string | null;
  warnings: unknown[];
  updated_at: string;
}

export interface FilmData {
  info?: { title?: string; synopsis?: string; type?: string };
  format?: { aspect?: string; width?: number; height?: number; fps?: number };
  scenes?: Array<{ id: string; title?: string; durationSec?: number; shots?: unknown[] }>;
}