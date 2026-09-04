import {
  err,
  generateEntityId,
  timeRange,
  type TimeRange,
} from "@nihon-zupzup/core";
import {captionError, parseTimecodeLine} from "./shared.js";
import type {
  CaptionCue,
  CaptionDisplayUnit,
  CaptionDocument,
  CaptionIdFactory,
  CaptionResult,
  CaptionTextRole,
  CaptionTextSet,
  ParseSrtOptions,
} from "./types.js";

const defaultIdFactory: CaptionIdFactory = () => generateEntityId("cap");

const textSetForRole = (text: string, role: CaptionTextRole): CaptionTextSet => {
  if (role === "primary") return {primary: text};
  return {primary: text, [role]: text};
};

const sourceForDocument = (name: string | undefined): CaptionDocument["source"] =>
  name === undefined ? {format: "srt"} : {format: "srt", name};

export const parseSrt = (
  input: string,
  options: ParseSrtOptions = {},
): CaptionResult<CaptionDocument> => {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (normalized.trim().length === 0) {
    return err(captionError("CAPTION_INVALID_SRT", "SRT input is empty.", {}));
  }

  const blocks = normalized.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  const cues: CaptionCue[] = [];
  const displayUnits: CaptionDisplayUnit[] = [];
  const idFactory = options.idFactory ?? defaultIdFactory;
  const mode = options.defaultMode ?? "normal";
  const kind = options.defaultKind ?? "tts";
  const textRole = options.sourceTextRole ?? "primary";

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    if (block === undefined) continue;
    const lines = block.split("\n");
    const sourceId = lines[0] ?? "";
    const timecodeLine = lines[1] ?? "";
    if (!/^\d+$/.test(sourceId)) {
      return err(captionError(
        "CAPTION_INVALID_SRT",
        "Each SRT cue must start with a numeric identifier.",
        {block: blockIndex + 1, sourceId},
      ));
    }

    const parsedTimecode = parseTimecodeLine(timecodeLine);
    if (!parsedTimecode) {
      return err(captionError(
        "CAPTION_INVALID_TIMECODE",
        "SRT cue contains an invalid timecode.",
        {block: blockIndex + 1, sourceId, timecode: timecodeLine},
      ));
    }
    if (parsedTimecode.startUs >= parsedTimecode.endUs) {
      return err(captionError(
        "CAPTION_REVERSED_RANGE",
        "SRT cue must satisfy startUs < endUs.",
        {block: blockIndex + 1, sourceId, startUs: parsedTimecode.startUs, endUs: parsedTimecode.endUs},
      ));
    }

    let range: TimeRange;
    try {
      range = Object.freeze(timeRange(parsedTimecode.startUs, parsedTimecode.endUs));
    } catch {
      return err(captionError(
        "CAPTION_INVALID_TIMECODE",
        "SRT cue time is outside the supported TimeUs range.",
        {block: blockIndex + 1, sourceId, timecode: timecodeLine},
      ));
    }

    const sourceText = lines.slice(2).join("\n");
    const cueId = idFactory("cue", blockIndex);
    const source = Object.freeze({
      id: sourceId,
      order: blockIndex,
      startTimecode: parsedTimecode.startTimecode,
      endTimecode: parsedTimecode.endTimecode,
      range,
      text: sourceText,
    });
    const cue: CaptionCue = {
      id: cueId,
      kind,
      mode,
      text: textSetForRole(sourceText, textRole),
      source,
    };
    cues.push(cue);
    displayUnits.push({
      id: idFactory("display-unit", blockIndex),
      kind,
      mode,
      range,
      text: cue.text,
      source: {
        cueId,
        cueRange: range,
        textRange: {start: 0, end: sourceText.length},
        sourceText,
      },
    });
  }

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      source: sourceForDocument(options.sourceName),
      cues,
      displayUnits,
    },
  };
};
