import {describe, expect, it} from "vitest";
import {
  parseSrt,
  splitCaptionDisplayUnits,
  type CaptionDocument,
  type CaptionId,
} from "@nihon-zupzup/caption";
import {timeUs, type TimeUs} from "@nihon-zupzup/core";
import {
  getActiveSegments,
  outputTimeToSourceTime,
  resolveTimeline,
  sourceTimeToOutputTime,
  validateTimelineInput,
  type ResolveTimelineInput,
  type TimelineAssetResolver,
  type TimelineOperation,
} from "./index.js";

const us = (seconds: number): TimeUs => timeUs(seconds * 1_000_000);

const idFactory = (entity: "cue" | "display-unit", order: number): CaptionId =>
  `cap_${entity}_${order}` as CaptionId;

const parseCaptions = (srt: string): CaptionDocument => {
  const parsed = parseSrt(srt, {idFactory});
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
};

const captions = parseCaptions(`1
00:00:01,000 --> 00:00:03,000
첫 번째 자막

2
00:00:05,000 --> 00:00:07,000
두 번째 자막
`);

const assets = new Map<string, TimeUs>([
  ["ast_insert", us(2)],
  ["ast_overlay", us(4)],
  ["ast_short", us(1)],
]);

const resolveAsset: TimelineAssetResolver = (assetId) => {
  const durationUs = assets.get(assetId);
  return durationUs === undefined ? undefined : {durationUs};
};

const input = (
  operations: readonly TimelineOperation[],
  overrides: Partial<ResolveTimelineInput> = {},
): ResolveTimelineInput => ({
  timelineId: "tln_test",
  sourceDurationUs: us(10),
  captions,
  operations,
  resolveAsset,
  ...overrides,
});

describe("resolveTimeline", () => {
  it("accumulates insert and pause delays while preserving same-anchor input order", () => {
    const operations: TimelineOperation[] = [
      {
        id: "pause_first",
        mode: "pause",
        anchor: {type: "caption_after", captionId: "cap_cue_0"},
        durationUs: us(1),
      },
      {
        id: "overlay_second",
        mode: "overlay",
        anchor: {type: "caption_after", captionId: "cap_cue_0"},
        assetId: "ast_overlay",
      },
      {
        id: "insert_third",
        mode: "insert",
        anchor: {type: "caption_after", captionId: "cap_cue_0"},
        assetId: "ast_insert",
      },
      {
        id: "pause_later",
        mode: "pause",
        anchor: {type: "caption_before", captionId: "cap_cue_1"},
        durationUs: timeUs(500_000),
      },
    ];

    const result = resolveTimeline(input(operations));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.durationUs).toBe(us(13.5));
    expect(result.value.operations.map(({operationId, outputRange}) => ({
      operationId,
      startUs: outputRange.startUs,
      endUs: outputRange.endUs,
    }))).toEqual([
      {operationId: "pause_first", startUs: us(3), endUs: us(4)},
      {operationId: "overlay_second", startUs: us(4), endUs: us(8)},
      {operationId: "insert_third", startUs: us(4), endUs: us(6)},
      {operationId: "pause_later", startUs: us(8), endUs: us(8.5)},
    ]);

    const before = sourceTimeToOutputTime(result.value, us(3), "before");
    const after = sourceTimeToOutputTime(result.value, us(3));
    expect(before.ok && before.value).toBe(us(3));
    expect(after.ok && after.value).toBe(us(6));
  });

  it("keeps overlay time non-blocking and does not change output duration", () => {
    const result = resolveTimeline(input([{
      id: "overlay",
      mode: "overlay",
      anchor: {type: "source_time", atUs: us(2)},
      assetId: "ast_overlay",
    }]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.durationUs).toBe(us(10));
    const mapped = sourceTimeToOutputTime(result.value, us(9));
    expect(mapped.ok && mapped.value).toBe(us(9));
    expect(result.value.operations[0]?.outputRange).toEqual({startUs: us(2), endUs: us(6)});
  });

  it("uses exact half-open boundaries for active segments and reverse mapping", () => {
    const result = resolveTimeline(input([{
      id: "insert",
      mode: "insert",
      anchor: {type: "caption_after", captionId: "cap_cue_0"},
      assetId: "ast_insert",
    }]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getActiveSegments(result.value, timeUs(us(5) - 1)).map(({type}) => type)).toEqual(["insert"]);
    expect(getActiveSegments(result.value, us(5)).map(({type}) => type)).toEqual(["tts"]);

    const blocked = outputTimeToSourceTime(result.value, timeUs(us(4)));
    expect(blocked.ok && blocked.value).toEqual({
      kind: "blocked",
      sourceAtUs: us(3),
      operationId: "insert",
      mode: "insert",
    });
    const resumed = outputTimeToSourceTime(result.value, us(5));
    expect(resumed.ok && resumed.value).toEqual({kind: "source", sourceAtUs: us(3)});
  });

  it("does not mutate source Caption cues, display units, or operations", () => {
    const operation: TimelineOperation = {
      id: "pause",
      mode: "pause",
      anchor: {type: "caption_before", captionId: "cap_cue_0"},
      durationUs: us(1),
    };
    const originalCaptions = structuredClone(captions);
    const originalOperation = structuredClone(operation);
    const result = resolveTimeline(input([operation]));
    expect(result.ok).toBe(true);
    expect(captions).toEqual(originalCaptions);
    expect(operation).toEqual(originalOperation);
  });
});

describe("Caption split integration", () => {
  it("accepts split display-unit boundaries but rejects source_time inside a unit", () => {
    const parsed = parseCaptions(`1
00:00:00,000 --> 00:00:04,000
길이가 아주 긴 자막 문장을 여러 화면 단위로 안전하게 분할합니다
`);
    const split = splitCaptionDisplayUnits(parsed, {
      maxLines: 1,
      maxCharsPerLine: 8,
      idFactory,
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    expect(split.value.displayUnits.length).toBeGreaterThan(1);

    const first = split.value.displayUnits[0];
    if (!first) throw new Error("Expected a display unit.");
    const snapshot = structuredClone(split.value);
    const atBoundary = resolveTimeline(input([{
      id: "insert_after_unit",
      mode: "insert",
      anchor: {type: "caption_after", captionId: first.id},
      assetId: "ast_short",
    }], {
      captions: split.value,
      sourceDurationUs: us(4),
    }));
    expect(atBoundary.ok).toBe(true);

    const insideUs = timeUs(first.range.startUs + 1);
    const inside = validateTimelineInput(input([{
      id: "insert_inside_unit",
      mode: "insert",
      anchor: {type: "source_time", atUs: insideUs},
      assetId: "ast_short",
    }], {
      captions: split.value,
      sourceDurationUs: us(4),
    }));
    expect(inside.validation.errors.map(({code}) => code)).toContain("TIMELINE_CAPTION_MIDDLE_INSERT");
    expect(split.value).toEqual(snapshot);
  });
});

describe("validateTimelineInput", () => {
  it("returns structured errors for missing captions, assets, invalid durations, and invalid anchors", () => {
    const validation = validateTimelineInput(input([
      {
        id: "missing_caption",
        mode: "pause",
        anchor: {type: "caption_after", captionId: "cap_missing"},
        durationUs: us(1),
      },
      {
        id: "missing_asset",
        mode: "insert",
        anchor: {type: "source_time", atUs: us(4)},
        assetId: "ast_missing",
      },
      {
        id: "negative_pause",
        mode: "pause",
        anchor: {type: "source_time", atUs: us(4)},
        durationUs: -1 as TimeUs,
      },
      {
        id: "outside_source",
        mode: "overlay",
        anchor: {type: "source_time", atUs: us(11)},
        assetId: "ast_short",
      },
    ]));

    expect(validation.validation.valid).toBe(false);
    expect(validation.validation.errors.map(({code}) => code)).toEqual(expect.arrayContaining([
      "TIMELINE_CAPTION_NOT_FOUND",
      "TIMELINE_ASSET_NOT_FOUND",
      "TIMELINE_INVALID_PAUSE_DURATION",
      "TIMELINE_INVALID_ANCHOR",
    ]));
  });

  it("rejects blocking source_time anchors in the middle of a caption", () => {
    const validation = validateTimelineInput(input([{
      id: "middle",
      mode: "insert",
      anchor: {type: "source_time", atUs: us(2)},
      assetId: "ast_short",
    }]));
    expect(validation.validation.errors.map(({code}) => code)).toContain("TIMELINE_CAPTION_MIDDLE_INSERT");
  });

  it("returns an overflow Result error instead of throwing for an overlay near MAX_SAFE_INTEGER", () => {
    const emptyCaptions: CaptionDocument = {
      schemaVersion: 1,
      source: {format: "srt"},
      cues: [],
      displayUnits: [],
    };
    const max = timeUs(Number.MAX_SAFE_INTEGER);
    const nearMax = timeUs(Number.MAX_SAFE_INTEGER - 1);
    const overflowInput: ResolveTimelineInput = {
      timelineId: "tln_overflow",
      sourceDurationUs: max,
      captions: emptyCaptions,
      operations: [{
        id: "overflow_overlay",
        mode: "overlay",
        anchor: {type: "source_time", atUs: nearMax},
        assetId: "ast_overflow",
      }],
      resolveAsset: () => ({durationUs: timeUs(10)}),
    };

    const validation = validateTimelineInput(overflowInput);
    expect(validation.validation.errors.map(({code}) => code)).toContain("TIMELINE_DURATION_OVERFLOW");
    expect(() => resolveTimeline(overflowInput)).not.toThrow();
    const resolved = resolveTimeline(overflowInput);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error.code).toBe("TIMELINE_DURATION_OVERFLOW");
  });

  it("warns and clips active lookup when an overlay extends beyond final video duration", () => {
    const overlayInput = input([{
      id: "late_overlay",
      mode: "overlay",
      anchor: {type: "source_time", atUs: us(9)},
      assetId: "ast_overlay",
    }]);
    const validation = validateTimelineInput(overlayInput);
    expect(validation.validation.valid).toBe(true);
    expect(validation.validation.warnings.map(({code}) => code)).toContain("TIMELINE_OVERLAY_TRUNCATED");

    const resolved = resolveTimeline(overlayInput);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.durationUs).toBe(us(10));
    expect(resolved.value.warnings.map(({code}) => code)).toContain("TIMELINE_OVERLAY_TRUNCATED");
    expect(resolved.value.operations[0]?.outputEndUs).toBe(us(13));
    expect(getActiveSegments(resolved.value, timeUs(us(10) - 1)).map(({type}) => type)).toEqual([
      "tts",
      "overlay",
    ]);
    expect(getActiveSegments(resolved.value, us(10))).toEqual([]);
  });

  it("rejects captions outside source duration even when there are no operations", () => {
    const outsideCaptions = parseCaptions(`1
00:00:00,000 --> 00:00:02,000
소스보다 긴 자막
`);
    const validation = validateTimelineInput(input([], {
      captions: outsideCaptions,
      sourceDurationUs: us(1),
    }));
    expect(validation.validation.errors.filter(({code}) => code === "TIMELINE_INVALID_CAPTIONS")).toHaveLength(2);

    const resolved = resolveTimeline(input([], {
      captions: outsideCaptions,
      sourceDurationUs: us(1),
    }));
    expect(resolved.ok).toBe(false);
  });
});
