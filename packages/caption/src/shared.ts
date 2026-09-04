import type {JsonObject} from "@nihon-zupzup/core";
import type {
  CaptionErrorContract,
  CaptionIssueCode,
  CaptionValidationIssue,
  CaptionIssueSeverity,
} from "./types.js";

export const DEFAULT_MAX_LINES = 2;
export const DEFAULT_MAX_CHARS_PER_LINE = 28;

export interface ParsedTimecodeLine {
  readonly startTimecode: string;
  readonly endTimecode: string;
  readonly startUs: number;
  readonly endUs: number;
}

const TIMECODE_LINE = /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})\s*-->\s*(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})(?:\s+.*)?$/;

const partsToUs = (hours: string, minutes: string, seconds: string, millis: string): number =>
  (((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1_000 + Number(millis)) * 1_000;

export const parseTimecodeLine = (line: string): ParsedTimecodeLine | null => {
  const match = TIMECODE_LINE.exec(line);
  if (!match) return null;
  const [hoursStart, minutesStart, secondsStart, millisStart, hoursEnd, minutesEnd, secondsEnd, millisEnd] = match.slice(1, 9);
  if (
    hoursStart === undefined || minutesStart === undefined || secondsStart === undefined || millisStart === undefined ||
    hoursEnd === undefined || minutesEnd === undefined || secondsEnd === undefined || millisEnd === undefined
  ) return null;
  return {
    startTimecode: `${hoursStart}:${minutesStart}:${secondsStart},${millisStart}`,
    endTimecode: `${hoursEnd}:${minutesEnd}:${secondsEnd},${millisEnd}`,
    startUs: partsToUs(hoursStart, minutesStart, secondsStart, millisStart),
    endUs: partsToUs(hoursEnd, minutesEnd, secondsEnd, millisEnd),
  };
};

export const countCharacters = (value: string): number => Array.from(value).length;

export const captionError = (
  code: CaptionIssueCode,
  message: string,
  details: JsonObject,
): CaptionErrorContract => ({code, message, retryable: false, details});

export const captionIssue = (
  severity: CaptionIssueSeverity,
  code: CaptionIssueCode,
  message: string,
  details: JsonObject,
): CaptionValidationIssue => ({severity, code, message, retryable: false, details});
