import type {
  ErrorContract,
  JsonObject,
  Result,
  TimeRange,
  TimeUs,
} from "@nihon-zupzup/core";
import type {CaptionDocument} from "@nihon-zupzup/caption";

export type TimelineTimingMode = "insert" | "pause" | "overlay";

export type TimelineAnchor =
  | {readonly type: "caption_before"; readonly captionId: string}
  | {readonly type: "caption_after"; readonly captionId: string}
  | {readonly type: "source_time"; readonly atUs: TimeUs};

interface TimelineOperationBase {
  readonly id: string;
  readonly anchor: TimelineAnchor;
}

export interface InsertOperation extends TimelineOperationBase {
  readonly mode: "insert";
  readonly assetId: string;
}

export interface OverlayOperation extends TimelineOperationBase {
  readonly mode: "overlay";
  readonly assetId: string;
}

export interface PauseOperation extends TimelineOperationBase {
  readonly mode: "pause";
  readonly durationUs: TimeUs;
}

export type TimelineOperation = InsertOperation | OverlayOperation | PauseOperation;

export interface TimelineAssetTiming {
  readonly durationUs: TimeUs;
}

export type TimelineAssetResolver = (
  assetId: string,
) => TimelineAssetTiming | undefined;

export interface ResolveTimelineInput {
  readonly timelineId: string;
  readonly sourceDurationUs: TimeUs;
  readonly captions: CaptionDocument;
  readonly operations: readonly TimelineOperation[];
  readonly resolveAsset: TimelineAssetResolver;
}

export interface ResolvedTtsSegment {
  readonly type: "tts";
  readonly sourceRange: TimeRange;
  readonly outputRange: TimeRange;
  readonly sourceStartUs: TimeUs;
  readonly sourceEndUs: TimeUs;
  readonly outputStartUs: TimeUs;
  readonly outputEndUs: TimeUs;
}

export interface ResolvedOperationSegment {
  readonly type: "insert" | "pause" | "overlay";
  readonly operationId: string;
  readonly sourceAtUs: TimeUs;
  readonly outputRange: TimeRange;
  readonly outputStartUs: TimeUs;
  readonly outputEndUs: TimeUs;
  readonly assetId?: string;
  readonly insertId?: string;
  readonly operationIndex: number;
}

export type ResolvedTimelineSegment = ResolvedTtsSegment | ResolvedOperationSegment;

export interface ResolvedTimeline {
  readonly schemaVersion: 1;
  readonly timelineId: string;
  readonly sourceDurationUs: TimeUs;
  readonly durationUs: TimeUs;
  readonly segments: readonly ResolvedTimelineSegment[];
  readonly operations: readonly ResolvedOperationSegment[];
  readonly warnings: readonly TimelineValidationIssue[];
}

export type TimelineIssueSeverity = "error" | "warning";

export type TimelineIssueCode =
  | "TIMELINE_INVALID_SOURCE_DURATION"
  | "TIMELINE_INVALID_CAPTIONS"
  | "TIMELINE_DUPLICATE_OPERATION_ID"
  | "TIMELINE_INVALID_OPERATION_ID"
  | "TIMELINE_CAPTION_NOT_FOUND"
  | "TIMELINE_ASSET_NOT_FOUND"
  | "TIMELINE_INVALID_ASSET_DURATION"
  | "TIMELINE_INVALID_PAUSE_DURATION"
  | "TIMELINE_INVALID_ANCHOR"
  | "TIMELINE_CAPTION_MIDDLE_INSERT"
  | "TIMELINE_DURATION_OVERFLOW"
  | "TIMELINE_OVERLAY_TRUNCATED";

export interface TimelineErrorContract extends ErrorContract {
  readonly code: TimelineIssueCode;
  readonly retryable: false;
  readonly details: JsonObject;
}

export interface TimelineValidationIssue extends TimelineErrorContract {
  readonly severity: TimelineIssueSeverity;
  readonly operationId?: string;
}

export interface TimelineValidationResult {
  readonly valid: boolean;
  readonly issues: readonly TimelineValidationIssue[];
  readonly errors: readonly TimelineValidationIssue[];
  readonly warnings: readonly TimelineValidationIssue[];
}

export interface ValidatedTimelineOperation {
  readonly operation: TimelineOperation;
  readonly operationIndex: number;
  readonly sourceAtUs: TimeUs;
  readonly durationUs: TimeUs;
}

export interface ValidatedTimelineInput {
  readonly input: ResolveTimelineInput;
  readonly operations: readonly ValidatedTimelineOperation[];
  readonly validation: TimelineValidationResult;
}

export type TimelineResult<T> = Result<T, TimelineErrorContract>;

export type SourceBoundaryBias = "before" | "after";

export type OutputTimeResolution =
  | {readonly kind: "source"; readonly sourceAtUs: TimeUs}
  | {
      readonly kind: "blocked";
      readonly sourceAtUs: TimeUs;
      readonly operationId: string;
      readonly mode: "insert" | "pause";
    }
  | {readonly kind: "end"; readonly sourceAtUs: TimeUs};
