import {countCharacters, DEFAULT_MAX_CHARS_PER_LINE, DEFAULT_MAX_LINES, captionIssue, parseTimecodeLine} from "./shared.js";
import type {
  CaptionCue,
  CaptionDisplayUnit,
  CaptionDocument,
  CaptionId,
  CaptionValidationIssue,
  CaptionValidationOptions,
  CaptionValidationResult,
} from "./types.js";

const validRange = (range: {readonly startUs: number; readonly endUs: number}): boolean =>
  Number.isSafeInteger(range.startUs) &&
  Number.isSafeInteger(range.endUs) &&
  range.startUs >= 0 &&
  range.startUs < range.endUs;

const sameRange = (
  left: {readonly startUs: number; readonly endUs: number},
  right: {readonly startUs: number; readonly endUs: number},
): boolean => left.startUs === right.startUs && left.endUs === right.endUs;

const textIssues = (
  value: string,
  owner: "cue" | "display-unit",
  id: string,
  maxLines: number,
  maxCharsPerLine: number,
): CaptionValidationIssue[] => {
  const issues: CaptionValidationIssue[] = [];
  if (value.trim().length === 0) {
    issues.push(captionIssue("error", "CAPTION_EMPTY_TEXT", "Caption text must not be empty.", {owner, id}));
    return issues;
  }
  const lines = value.split(/\r?\n/);
  if (lines.length > maxLines) {
    issues.push(captionIssue(
      "warning",
      "CAPTION_TOO_MANY_LINES",
      `Caption has more than ${maxLines} lines.`,
      {owner, id, lineCount: lines.length, maxLines},
    ));
  }
  lines.forEach((line, index) => {
    const characterCount = countCharacters(line);
    if (characterCount > maxCharsPerLine) {
      issues.push(captionIssue(
        "warning",
        "CAPTION_LINE_TOO_LONG",
        `Caption line has more than ${maxCharsPerLine} characters.`,
        {owner, id, line: index + 1, characterCount, maxCharsPerLine},
      ));
    }
  });
  return issues;
};

const validateCue = (cue: CaptionCue): CaptionValidationIssue[] => {
  const issues: CaptionValidationIssue[] = [];
  if (cue.source.text.trim().length === 0) {
    issues.push(captionIssue("error", "CAPTION_EMPTY_TEXT", "Source cue text must not be empty.", {owner: "cue", id: cue.id}));
  }
  const parsed = parseTimecodeLine(`${cue.source.startTimecode} --> ${cue.source.endTimecode}`);
  if (!parsed) {
    issues.push(captionIssue(
      "error",
      "CAPTION_INVALID_TIMECODE",
      "Source cue contains an invalid SRT timecode.",
      {cueId: cue.id, startTimecode: cue.source.startTimecode, endTimecode: cue.source.endTimecode},
    ));
  }
  if (!validRange(cue.source.range)) {
    issues.push(captionIssue(
      "error",
      "CAPTION_REVERSED_RANGE",
      "Source cue range must satisfy startUs < endUs with non-negative safe integers.",
      {cueId: cue.id, startUs: cue.source.range.startUs, endUs: cue.source.range.endUs},
    ));
  } else if (parsed && (parsed.startUs !== cue.source.range.startUs || parsed.endUs !== cue.source.range.endUs)) {
    issues.push(captionIssue(
      "error",
      "CAPTION_SOURCE_RANGE_MISMATCH",
      "Source cue timecode and TimeUs range do not match.",
      {
        cueId: cue.id,
        timecodeStartUs: parsed.startUs,
        timecodeEndUs: parsed.endUs,
        rangeStartUs: cue.source.range.startUs,
        rangeEndUs: cue.source.range.endUs,
      },
    ));
  }
  return issues;
};

const validateDisplayUnit = (
  unit: CaptionDisplayUnit,
  cueById: ReadonlyMap<string, CaptionCue>,
  maxLines: number,
  maxCharsPerLine: number,
): CaptionValidationIssue[] => {
  const issues = textIssues(unit.text.primary, "display-unit", unit.id, maxLines, maxCharsPerLine);
  if (!validRange(unit.range)) {
    issues.push(captionIssue(
      "error",
      "CAPTION_REVERSED_RANGE",
      "Display unit range must satisfy startUs < endUs with non-negative safe integers.",
      {displayUnitId: unit.id, startUs: unit.range.startUs, endUs: unit.range.endUs},
    ));
  }

  const source = unit.source;
  if (!source || typeof source.cueId !== "string") {
    issues.push(captionIssue(
      "error",
      "CAPTION_MISSING_SOURCE_LINK",
      "Display unit must link to an original source cue.",
      {displayUnitId: unit.id},
    ));
    return issues;
  }
  const cue = cueById.get(source.cueId);
  if (!cue) {
    issues.push(captionIssue(
      "error",
      "CAPTION_MISSING_SOURCE_LINK",
      "Display unit links to a source cue that does not exist.",
      {displayUnitId: unit.id, cueId: source.cueId},
    ));
    return issues;
  }
  if (!sameRange(source.cueRange, cue.source.range)) {
    issues.push(captionIssue(
      "error",
      "CAPTION_SOURCE_RANGE_MISMATCH",
      "Display unit must preserve its original cue range.",
      {displayUnitId: unit.id, cueId: cue.id},
    ));
  }
  if (validRange(unit.range) && (unit.range.startUs < cue.source.range.startUs || unit.range.endUs > cue.source.range.endUs)) {
    issues.push(captionIssue(
      "error",
      "CAPTION_SOURCE_RANGE_MISMATCH",
      "Display unit range must be contained by its original cue range.",
      {displayUnitId: unit.id, cueId: cue.id},
    ));
  }
  const {start, end} = source.textRange;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || end > cue.source.text.length) {
    issues.push(captionIssue(
      "error",
      "CAPTION_SOURCE_TEXT_MISMATCH",
      "Display unit source text range is invalid.",
      {displayUnitId: unit.id, cueId: cue.id, start, end, sourceLength: cue.source.text.length},
    ));
  } else if (cue.source.text.slice(start, end) !== source.sourceText) {
    issues.push(captionIssue(
      "error",
      "CAPTION_SOURCE_TEXT_MISMATCH",
      "Display unit source text does not match the original cue slice.",
      {displayUnitId: unit.id, cueId: cue.id, start, end},
    ));
  }
  return issues;
};

const addDuplicateIssues = (
  items: readonly {readonly id: string}[],
  owner: "cue" | "display-unit",
  issues: CaptionValidationIssue[],
): void => {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      issues.push(captionIssue(
        "error",
        "CAPTION_DUPLICATE_ID",
        "Caption IDs must be unique within their collection.",
        {owner, id: item.id},
      ));
    }
    seen.add(item.id);
  }
};

const addOverlapIssues = (
  items: readonly {readonly id: string; readonly range: {readonly startUs: number; readonly endUs: number}}[],
  code: "CAPTION_CUE_OVERLAP" | "CAPTION_DISPLAY_OVERLAP",
  issues: CaptionValidationIssue[],
): void => {
  const sorted = [...items.filter((item) => validRange(item.range))].sort(
    (left, right) => left.range.startUs - right.range.startUs || left.range.endUs - right.range.endUs || left.id.localeCompare(right.id),
  );
  let previous = sorted[0];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (previous && current && current.range.startUs < previous.range.endUs) {
      issues.push(captionIssue(
        "error",
        code,
        "Caption ranges must not overlap.",
        {previousId: previous.id, currentId: current.id},
      ));
    }
    if (current && (!previous || current.range.endUs > previous.range.endUs)) previous = current;
  }
};

export const validateCaptionDocument = (
  document: CaptionDocument,
  options: CaptionValidationOptions = {},
): CaptionValidationResult => {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxCharsPerLine = options.maxCharsPerLine ?? DEFAULT_MAX_CHARS_PER_LINE;
  const issues: CaptionValidationIssue[] = [];
  const cueById = new Map(document.cues.map((cue) => [cue.id, cue]));

  document.cues.forEach((cue) => issues.push(...validateCue(cue)));
  document.displayUnits.forEach((unit) => issues.push(...validateDisplayUnit(unit, cueById, maxLines, maxCharsPerLine)));
  const linkedCueIds = new Set(
    document.displayUnits
      .map((unit) => unit.source?.cueId)
      .filter((cueId): cueId is CaptionId => typeof cueId === "string"),
  );
  document.cues.forEach((cue) => {
    if (!linkedCueIds.has(cue.id)) {
      issues.push(captionIssue(
        "error",
        "CAPTION_MISSING_SOURCE_LINK",
        "Every source cue must be represented by at least one linked display unit.",
        {cueId: cue.id},
      ));
    }
  });
  addDuplicateIssues(document.cues, "cue", issues);
  addDuplicateIssues(document.displayUnits, "display-unit", issues);
  addOverlapIssues(
    document.cues.map((cue) => ({id: cue.id, range: cue.source.range})),
    "CAPTION_CUE_OVERLAP",
    issues,
  );
  addOverlapIssues(document.displayUnits, "CAPTION_DISPLAY_OVERLAP", issues);

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return {valid: errors.length === 0, issues, errors, warnings};
};
