import {describe, expect, it} from "vitest";
import {timeRange} from "@nihon-zupzup/core";
import {
  parseSrt,
  splitCaptionDisplayUnits,
  validateCaptionDocument,
  type CaptionDocument,
  type CaptionId,
  type CaptionIdFactory,
} from "./index.js";

const idFactory: CaptionIdFactory = (entity, order) => {
  const discriminator = entity === "cue" ? 0 : 1;
  return `cap_${String(discriminator * 1_000 + order).padStart(26, "0")}` as CaptionId;
};

const parse = (source: string, options: Parameters<typeof parseSrt>[1] = {}): CaptionDocument => {
  const result = parseSrt(source, {idFactory, ...options});
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("parseSrt", () => {
  it("parses standard SRT into immutable source cues and half-open TimeUs ranges", () => {
    const document = parse("\uFEFF1\r\n00:00:01,250 --> 00:00:03,500\r\n첫째 줄\r\n둘째 줄\r\n\r\n2\r\n00:00:03,500 --> 00:00:04,000\r\n次です");
    expect(document.schemaVersion).toBe(1);
    expect(document.cues).toHaveLength(2);
    expect(document.cues[0]?.source).toEqual({
      id: "1",
      order: 0,
      startTimecode: "00:00:01,250",
      endTimecode: "00:00:03,500",
      range: timeRange(1_250_000, 3_500_000),
      text: "첫째 줄\n둘째 줄",
    });
    expect(document.displayUnits[0]?.source).toMatchObject({
      cueId: document.cues[0]?.id,
      cueRange: timeRange(1_250_000, 3_500_000),
      textRange: {start: 0, end: 9},
      sourceText: "첫째 줄\n둘째 줄",
    });
    expect(Object.isFrozen(document.cues[0]?.source)).toBe(true);
    expect(Object.isFrozen(document.cues[0]?.source.range)).toBe(true);
  });

  it("supports caption modes, language variants, and clip captions", () => {
    const document = parse("1\n00:00:00,000 --> 00:00:01,000\n貴様", {
      defaultMode: "subtle",
      defaultKind: "clip",
      sourceTextRole: "japanese",
    });
    expect(document.cues[0]).toMatchObject({
      kind: "clip",
      mode: "subtle",
      text: {primary: "貴様", japanese: "貴様"},
    });
  });

  it.each([
    ["invalid timecode", "1\n00:00:61,000 --> 00:00:02,000\ntext", "CAPTION_INVALID_TIMECODE"],
    ["reversed range", "1\n00:00:02,000 --> 00:00:01,000\ntext", "CAPTION_REVERSED_RANGE"],
  ])("returns a structured error for %s", (_name, source, code) => {
    const result = parseSrt(source, {idFactory});
    expect(result).toMatchObject({ok: false, error: {code, retryable: false}});
  });
});

describe("splitCaptionDisplayUnits", () => {
  it("splits long Korean and Japanese text while preserving the source cue", () => {
    const document = parse("1\n00:00:10,000 --> 00:00:14,000\n긴 한국어 문장과日本語の長い文章を함께 표시합니다");
    const originalSource = document.cues[0]?.source;
    const result = splitCaptionDisplayUnits(document, {maxLines: 1, maxCharsPerLine: 8, idFactory});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cues[0]?.source).toBe(originalSource);
    expect(result.value.displayUnits.length).toBeGreaterThan(2);
    expect(result.value.displayUnits[0]?.range.startUs).toBe(10_000_000);
    expect(result.value.displayUnits.at(-1)?.range.endUs).toBe(14_000_000);
    for (let index = 0; index < result.value.displayUnits.length; index += 1) {
      const unit = result.value.displayUnits[index];
      expect(unit?.source.cueId).toBe(document.cues[0]?.id);
      expect(unit?.source.cueRange).toEqual(timeRange(10_000_000, 14_000_000));
      expect(unit?.source.sourceText).toBe(
        originalSource?.text.slice(unit.source.textRange.start, unit.source.textRange.end),
      );
      if (index > 0) {
        expect(result.value.displayUnits[index - 1]?.range.endUs).toBe(unit?.range.startUs);
      }
    }
    expect(validateCaptionDocument(result.value, {maxLines: 1, maxCharsPerLine: 8}).valid).toBe(true);
  });

  it("reflows an over-line cue even when it fits in one display unit", () => {
    const document = parse("1\n00:00:00,000 --> 00:00:02,000\n하나\n둘\n셋");
    const result = splitCaptionDisplayUnits(document, {maxLines: 2, maxCharsPerLine: 4, idFactory});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cues[0]?.source.text).toBe("하나\n둘\n셋");
    expect(result.value.displayUnits[0]?.text.primary.split("\n").length).toBeLessThanOrEqual(2);
    expect(validateCaptionDocument(result.value, {maxLines: 2, maxCharsPerLine: 4}).warnings).toHaveLength(0);
  });
});

describe("validateCaptionDocument", () => {
  it("reports overlap as an error and excessive lines and length as warnings", () => {
    const document = parse("1\n00:00:00,000 --> 00:00:02,000\n12345\nsecond\nthird\n\n2\n00:00:01,500 --> 00:00:03,000\nok");
    const result = validateCaptionDocument(document, {maxLines: 2, maxCharsPerLine: 4});
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toContain("CAPTION_CUE_OVERLAP");
    expect(result.warnings.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "CAPTION_TOO_MANY_LINES",
      "CAPTION_LINE_TOO_LONG",
    ]));
  });

  it("reports empty text", () => {
    const document = parse("1\n00:00:00,000 --> 00:00:01,000\n");
    const result = validateCaptionDocument(document);
    expect(result.errors.map((issue) => issue.code)).toContain("CAPTION_EMPTY_TEXT");
  });

  it("reports an invalid source timecode and a missing source link", () => {
    const document = parse("1\n00:00:00,000 --> 00:00:01,000\ntext");
    const malformed = {
      ...document,
      cues: [{...document.cues[0]!, source: {...document.cues[0]!.source, startTimecode: "bad"}}],
      displayUnits: [{...document.displayUnits[0]!, source: undefined}],
    } as unknown as CaptionDocument;
    const result = validateCaptionDocument(malformed);
    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "CAPTION_INVALID_TIMECODE",
      "CAPTION_MISSING_SOURCE_LINK",
    ]));
  });

  it("reports a reversed source range in a structurally malformed document", () => {
    const document = parse("1\n00:00:00,000 --> 00:00:01,000\ntext");
    const malformed = {
      ...document,
      cues: [{...document.cues[0]!, source: {...document.cues[0]!.source, range: {startUs: 2, endUs: 1}}}],
    } as unknown as CaptionDocument;
    expect(validateCaptionDocument(malformed).errors.map((issue) => issue.code)).toContain("CAPTION_REVERSED_RANGE");
  });

  it("reports a source cue that has no linked display unit", () => {
    const document = parse("1\n00:00:00,000 --> 00:00:01,000\ntext");
    const result = validateCaptionDocument({...document, displayUnits: []});
    expect(result.errors.map((issue) => issue.code)).toContain("CAPTION_MISSING_SOURCE_LINK");
  });
});
