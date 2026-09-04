export const CONTENT_STATUSES = [
  "idea",
  "planned",
  "script_ready",
  "media_ready",
  "auto_generated",
  "reviewing",
  "approved",
  "rendered",
  "upload_ready",
  "uploaded",
  "published",
  "archived",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const PRODUCTION_STATUSES = [
  "draft",
  "auto_generated",
  "reviewing",
  "approved",
  "rendered",
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const YOUTUBE_UPLOAD_STATUSES = [
  "not_started",
  "queued",
  "uploading",
  "uploaded",
  "failed",
] as const;
export type YouTubeUploadStatus = (typeof YOUTUBE_UPLOAD_STATUSES)[number];

export const YOUTUBE_REMOTE_PUBLISH_STATUSES = [
  "unknown",
  "processing",
  "scheduled",
  "published",
  "rejected",
  "deleted",
] as const;
export type YouTubeRemotePublishStatus =
  (typeof YOUTUBE_REMOTE_PUBLISH_STATUSES)[number];

export type YouTubeVisibility = "public" | "unlisted" | "private";

export interface YouTubeRemoteState {
  readonly uploadStatus: YouTubeUploadStatus;
  readonly publishStatus: YouTubeRemotePublishStatus;
  readonly visibility: YouTubeVisibility | null;
  readonly videoId: string | null;
  readonly scheduledPublishAt: string | null;
  readonly lastSyncedAt: string | null;
  readonly lastErrorCode?: string;
}

export interface OwnedStatusState {
  readonly contentStatus: ContentStatus;
  readonly productionStatus: ProductionStatus;
  readonly youtube: YouTubeRemoteState;
}

export const isContentStatus = (value: unknown): value is ContentStatus =>
  typeof value === "string" &&
  (CONTENT_STATUSES as readonly string[]).includes(value);

export const isProductionStatus = (value: unknown): value is ProductionStatus =>
  typeof value === "string" &&
  (PRODUCTION_STATUSES as readonly string[]).includes(value);
