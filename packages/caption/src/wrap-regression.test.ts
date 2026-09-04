import {expect, it} from "vitest";
import {parseSrt, splitCaptionDisplayUnits, validateCaptionDocument} from "./index.js";

it("respects line limits when word wrapping leaves unused character capacity", () => {
  const parsed = parseSrt("1\n00:00:00,000 --> 00:00:02,000\naa bbbb cc");
  if (!parsed.ok) throw new Error(parsed.error.message);
  const limits = {maxLines: 2, maxCharsPerLine: 5};
  const split = splitCaptionDisplayUnits(parsed.value, limits);
  if (!split.ok) throw new Error(split.error.message);
  expect(validateCaptionDocument(split.value, limits).issues).toEqual([]);
  expect(split.value.cues).toEqual(parsed.value.cues);
  expect(split.value.displayUnits[0]?.range.startUs).toBe(0);
  expect(split.value.displayUnits.at(-1)?.range.endUs).toBe(2_000_000);
});
