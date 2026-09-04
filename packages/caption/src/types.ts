import type {
  EntityId,
  ErrorContract,
  JsonObject,
  Result,
  TimeRange,
} from "@nihon-zupzup/core";

export type CaptionId = EntityId<"cap">;
export type CaptionMode = "normal" | "subtle" | "hidden";
export type CaptionKind = "tts" | "clip";
export type CaptionTextRole = "primary" | "korean" | "japanese" | "reading";

export interface CaptionTextSet {
  readonly primary: string;
  readonly korean?: string;
  readonly japanese?: string;
  readonly reading?: string;
}

export interface SrtSourceCue {
  readonly id: string;
  readonly order: number;
  readonly startTimecode: string;
  readonly endTimecode: string;
  readonly range: TimeRange;
  readonly text: string;
}

export interface CaptionCue {
  readonly id: CaptionId;
  readonly kind: CaptionKind;
  readonly mode: CaptionMode;
  readonly text: CaptionTextSet;
  readonly source: SrtSourceCue;
}

export interface CaptionSourceTextRange {
  readonly start: number;
  readonly end: number;
}

export interface CaptionDisplaySourceLink {
  readonly cueId: CaptionId;
  readonly cueRange: TimeRange;
  readonly textRange: CaptionSourceTextRange;
  readonly sourceText: string;
}

export interface CaptionDisplayUnit {
  readonly id: CaptionId;
  readonly kind: CaptionKind;
  readonly mode: CaptionMode;
  readonly range: TimeRange;
  readonly text: CaptionTextSet;
  readonly source: CaptionDisplaySourceLink;
}

export interface CaptionDocumentSource {
  readonly format: "srt";
  readonly name?: string;
}

export interface CaptionDocument {
  readonly schemaVersion: 1;
  readonly source: CaptionDocumentSource;
  readonly cues: readonly CaptionCue[];
  readonly displayUnits: readonly CaptionDisplayUnit[];
}

export type CaptionIssueSeverity = "error" | "warning";

export type CaptionIssueCode =
  | "CAPTION_INVALID_SRT"
  | "CAPTION_INVALID_TIMECODE"
  | "CAPTION_REVERSED_RANGE"
  | "CAPTION_CUE_OVERLAP"
  | "CAPTION_DISPLAY_OVERLAP"
  | "CAPTION_EMPTY_TEXT"
  | "CAPTION_TOO_MANY_LINES"
  | "CAPTION_LINE_TOO_LONG"
  | "CAPTION_MISSING_SOURCE_LINK"
  | "CAPTION_SOURCE_RANGE_MISMATCH"
  | "CAPTION_SOURCE_TEXT_MISMATCH"
  | "CAPTION_DUPLICATE_ID"
  | "CAPTION_SPLIT_RANGE_TOO_SHORT";

export interface CaptionErrorContract extends ErrorContract {
  readonly code: CaptionIssueCode;
  readonly retryable: false;
  readonly details: JsonObject;
}

export interface CaptionValidationIssue extends CaptionErrorContract {
  readonly severity: CaptionIssueSeverity;
}

export interface CaptionValidationResult {
  readonly valid: boolean;
  readonly issues: readonly CaptionValidationIssue[];
  readonly errors: readonly CaptionValidationIssue[];
  readonly warnings: readonly CaptionValidationIssue[];
}

export type CaptionResult<T> = Result<T, CaptionErrorContract>;

export type CaptionIdFactory = (
  entity: "cue" | "display-unit",
  order: number,
) => CaptionId;

export interface ParseSrtOptions {
  readonly sourceName?: string;
  readonly defaultMode?: CaptionMode;
  readonly defaultKind?: CaptionKind;
  readonly sourceTextRole?: CaptionTextRole;
  readonly idFactory?: CaptionIdFactory;
}

export interface SplitCaptionOptions {
  readonly maxLines?: number;
  readonly maxCharsPerLine?: number;
  readonly idFactory?: CaptionIdFactory;
  readonly resolveText?: (
    cue: CaptionCue,
    sourceTextRange: CaptionSourceTextRange,
    displayText: string,
    unitIndex: number,
    unitCount: number,
  ) => CaptionTextSet;
}

export interface CaptionValidationOptions {
  readonly maxLines?: number;
  readonly maxCharsPerLine?: number;
}
