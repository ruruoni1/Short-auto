import {
  err,
  generateEntityId,
  timeRange,
} from "@nihon-zupzup/core";
import {
  captionError,
  countCharacters,
  DEFAULT_MAX_CHARS_PER_LINE,
  DEFAULT_MAX_LINES,
} from "./shared.js";
import type {
  CaptionCue,
  CaptionDisplayUnit,
  CaptionIdFactory,
  CaptionResult,
  CaptionSourceTextRange,
  CaptionTextSet,
  SplitCaptionOptions,
  CaptionDocument,
} from "./types.js";

interface TextSegment extends CaptionSourceTextRange {
  readonly sourceText: string;
}

const defaultIdFactory: CaptionIdFactory = () => generateEntityId("cap");
const preferredBreak = /[\s、。！？!?.,;；:：]/u;

const segmentText = (text: string, capacity: number): TextSegment[] => {
  const characters = Array.from(text);
  const offsets: number[] = [];
  let utf16Offset = 0;
  for (const character of characters) {
    offsets.push(utf16Offset);
    utf16Offset += character.length;
  }
  offsets.push(utf16Offset);

  const segments: TextSegment[] = [];
  let cursor = 0;
  while (cursor < characters.length) {
    while (cursor < characters.length && /\s/u.test(characters[cursor] ?? "")) cursor += 1;
    if (cursor >= characters.length) break;

    const hardEnd = Math.min(cursor + capacity, characters.length);
    let end = hardEnd;
    if (hardEnd < characters.length) {
      const minimumPreferred = cursor + Math.max(1, Math.floor(capacity / 2));
      for (let candidate = hardEnd; candidate > minimumPreferred; candidate -= 1) {
        if (preferredBreak.test(characters[candidate - 1] ?? "")) {
          end = candidate;
          break;
        }
      }
    }
    while (end > cursor && /\s/u.test(characters[end - 1] ?? "")) end -= 1;
    if (end <= cursor) end = hardEnd;

    const startOffset = offsets[cursor] ?? 0;
    const endOffset = offsets[end] ?? text.length;
    segments.push({start: startOffset, end: endOffset, sourceText: text.slice(startOffset, endOffset)});
    cursor = end;
  }
  return segments;
};

const wrapDisplayText = (sourceText: string, maxCharsPerLine: number): string => {
  const normalized = sourceText.replace(/\s+/gu, " ").trim();
  const characters = Array.from(normalized);
  const lines: string[] = [];
  let cursor = 0;
  while (cursor < characters.length) {
    const hardEnd = Math.min(cursor + maxCharsPerLine, characters.length);
    let end = hardEnd;
    if (hardEnd < characters.length) {
      for (let candidate = hardEnd; candidate > cursor; candidate -= 1) {
        if (/\s/u.test(characters[candidate - 1] ?? "")) {
          end = candidate;
          break;
        }
      }
    }
    const line = characters.slice(cursor, end).join("").trim();
    if (line.length > 0) lines.push(line);
    cursor = end;
    while (cursor < characters.length && /\s/u.test(characters[cursor] ?? "")) cursor += 1;
  }
  return lines.join("\n");
};

const defaultResolvedText = (
  cue: CaptionCue,
  sourceRange: CaptionSourceTextRange,
  displayText: string,
  unitCount: number,
): CaptionTextSet => {
  if (unitCount === 1 && sourceRange.start === 0 && sourceRange.end === cue.source.text.length) {
    return {...cue.text, primary: displayText};
  }
  return {primary: displayText};
};

export const splitCaptionDisplayUnits = (
  document: CaptionDocument,
  options: SplitCaptionOptions = {},
): CaptionResult<CaptionDocument> => {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxCharsPerLine = options.maxCharsPerLine ?? DEFAULT_MAX_CHARS_PER_LINE;
  if (!Number.isSafeInteger(maxLines) || maxLines <= 0 || !Number.isSafeInteger(maxCharsPerLine) || maxCharsPerLine <= 0) {
    return err(captionError(
      "CAPTION_INVALID_SRT",
      "Caption split limits must be positive integers.",
      {maxLines, maxCharsPerLine},
    ));
  }

  const capacity = maxLines * maxCharsPerLine;
  const idFactory = options.idFactory ?? defaultIdFactory;
  const displayUnits: CaptionDisplayUnit[] = [];
  let displayOrder = 0;

  for (const cue of document.cues) {
    const segments = segmentText(cue.source.text, capacity).flatMap((segment) => {
      if (wrapDisplayText(segment.sourceText, maxCharsPerLine).split("\n").length <= maxLines) return [segment];
      // A character budget alone does not account for space left by word wrapping.
      return segmentText(segment.sourceText, maxCharsPerLine).map((part) => ({
        start: segment.start + part.start,
        end: segment.start + part.end,
        sourceText: part.sourceText,
      }));
    });
    if (segments.length === 0) {
      segments.push({start: 0, end: cue.source.text.length, sourceText: cue.source.text});
    }
    const duration = cue.source.range.endUs - cue.source.range.startUs;
    if (duration < segments.length) {
      return err(captionError(
        "CAPTION_SPLIT_RANGE_TOO_SHORT",
        "Cue duration is too short to assign a positive half-open range to every display unit.",
        {cueId: cue.id, durationUs: duration, displayUnitCount: segments.length},
      ));
    }

    const weights = segments.map((segment) => Math.max(1, countCharacters(segment.sourceText.replace(/\s/gu, ""))));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let cumulativeWeight = 0;
    let unitStart: number = cue.source.range.startUs;

    for (let unitIndex = 0; unitIndex < segments.length; unitIndex += 1) {
      const segment = segments[unitIndex];
      const weight = weights[unitIndex];
      if (segment === undefined || weight === undefined) continue;
      cumulativeWeight += weight;
      const remainingUnits = segments.length - unitIndex - 1;
      const proportionalEnd = cue.source.range.startUs + Math.round((duration * cumulativeWeight) / totalWeight);
      const unitEnd = unitIndex === segments.length - 1
        ? cue.source.range.endUs
        : Math.max(unitStart + 1, Math.min(proportionalEnd, cue.source.range.endUs - remainingUnits));
      const displayText = wrapDisplayText(segment.sourceText, maxCharsPerLine);
      const textRange = {start: segment.start, end: segment.end};
      const text = options.resolveText?.(cue, textRange, displayText, unitIndex, segments.length)
        ?? defaultResolvedText(cue, textRange, displayText, segments.length);
      displayUnits.push({
        id: idFactory("display-unit", displayOrder),
        kind: cue.kind,
        mode: cue.mode,
        range: timeRange(unitStart, unitEnd),
        text,
        source: {
          cueId: cue.id,
          cueRange: cue.source.range,
          textRange,
          sourceText: segment.sourceText,
        },
      });
      unitStart = unitEnd;
      displayOrder += 1;
    }
  }

  return {ok: true, value: {...document, displayUnits}};
};
