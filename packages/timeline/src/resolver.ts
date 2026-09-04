import {containsTime, timeRange, timeUs} from "@nihon-zupzup/core";
import type {TimeUs} from "@nihon-zupzup/core";
import type {
  OutputTimeResolution,
  ResolveTimelineInput,
  ResolvedOperationSegment,
  ResolvedTimeline,
  ResolvedTimelineSegment,
  ResolvedTtsSegment,
  SourceBoundaryBias,
  TimelineResult,
  ValidatedTimelineOperation,
} from "./types.js";
import {timelineValidationError, validateTimelineInput} from "./validator.js";

const isBlocking = (
  operation: ValidatedTimelineOperation,
): boolean => operation.operation.mode !== "overlay";

const segmentStart = (segment: ResolvedTimelineSegment): number =>
  segment.outputRange.startUs;

const segmentOrder = (segment: ResolvedTimelineSegment): number =>
  segment.type === "tts" ? -1 : segment.operationIndex;

/**
 * Resolves immutable source timing into output timing. Operations are processed
 * chronologically; operations sharing one source anchor preserve input order.
 */
export const resolveTimeline = (
  input: ResolveTimelineInput,
): TimelineResult<ResolvedTimeline> => {
  const validated = validateTimelineInput(input);
  if (!validated.validation.valid) {
    return {ok: false, error: timelineValidationError(validated.validation)};
  }

  const byAnchor = new Map<number, ValidatedTimelineOperation[]>();
  for (const operation of validated.operations) {
    const atAnchor = byAnchor.get(operation.sourceAtUs) ?? [];
    atAnchor.push(operation);
    byAnchor.set(operation.sourceAtUs, atAnchor);
  }

  const sourceSegments: ResolvedTtsSegment[] = [];
  const resolvedOperations: ResolvedOperationSegment[] = [];
  let sourceCursor = 0;
  let blockingDelay = 0;

  for (const sourceAtUs of [...byAnchor.keys()].sort((left, right) => left - right)) {
    if (sourceCursor < sourceAtUs) {
      const sourceRange = timeRange(sourceCursor, sourceAtUs);
      const outputRange = timeRange(sourceCursor + blockingDelay, sourceAtUs + blockingDelay);
      sourceSegments.push({
        type: "tts",
        sourceRange,
        outputRange,
        sourceStartUs: sourceRange.startUs,
        sourceEndUs: sourceRange.endUs,
        outputStartUs: outputRange.startUs,
        outputEndUs: outputRange.endUs,
      });
    }

    const operations = byAnchor.get(sourceAtUs) ?? [];
    for (const item of operations) {
      const outputStartUs = sourceAtUs + blockingDelay;
      const outputEndUs = outputStartUs + item.durationUs;
      const outputRange = timeRange(outputStartUs, outputEndUs);
      resolvedOperations.push({
        type: item.operation.mode,
        operationId: item.operation.id,
        sourceAtUs: timeUs(sourceAtUs),
        outputRange,
        outputStartUs: outputRange.startUs,
        outputEndUs: outputRange.endUs,
        ...(item.operation.mode === "pause" ? {} : {assetId: item.operation.assetId}),
        ...(item.operation.mode === "insert" ? {insertId: item.operation.id} : {}),
        operationIndex: item.operationIndex,
      });
      if (isBlocking(item)) blockingDelay += item.durationUs;
    }
    sourceCursor = sourceAtUs;
  }

  if (sourceCursor < input.sourceDurationUs) {
    const sourceRange = timeRange(sourceCursor, input.sourceDurationUs);
    const outputRange = timeRange(
      sourceCursor + blockingDelay,
      input.sourceDurationUs + blockingDelay,
    );
    sourceSegments.push({
      type: "tts",
      sourceRange,
      outputRange,
      sourceStartUs: sourceRange.startUs,
      sourceEndUs: sourceRange.endUs,
      outputStartUs: outputRange.startUs,
      outputEndUs: outputRange.endUs,
    });
  }

  const durationUs = timeUs(input.sourceDurationUs + blockingDelay);
  const segments: ResolvedTimelineSegment[] = [...sourceSegments, ...resolvedOperations]
    .sort((left, right) =>
      segmentStart(left) - segmentStart(right) || segmentOrder(left) - segmentOrder(right),
    );

  return {ok: true, value: {
    schemaVersion: 1,
    timelineId: input.timelineId,
    sourceDurationUs: input.sourceDurationUs,
    durationUs,
    segments,
    operations: resolvedOperations,
    warnings: validated.validation.warnings,
  }};
};

export const getActiveSegments = (
  timeline: ResolvedTimeline,
  outputAtUs: TimeUs,
): readonly ResolvedTimelineSegment[] => {
  if (outputAtUs < 0 || outputAtUs >= timeline.durationUs) return [];
  return timeline.segments.filter(({outputRange}) => containsTime(outputRange, outputAtUs));
};

/**
 * `before` maps to the instant before blockers at that source point; `after`
 * maps to the instant where source playback resumes after all of them.
 */
export const sourceTimeToOutputTime = (
  timeline: ResolvedTimeline,
  sourceAtUs: TimeUs,
  bias: SourceBoundaryBias = "after",
): TimelineResult<TimeUs> => {
  if (!Number.isSafeInteger(sourceAtUs) || sourceAtUs < 0 || sourceAtUs > timeline.sourceDurationUs) {
    return {ok: false, error: {
      code: "TIMELINE_INVALID_ANCHOR",
      message: "Source time must be within the source timeline.",
      retryable: false,
      details: {sourceAtUs, sourceDurationUs: timeline.sourceDurationUs},
    }};
  }
  const delay = timeline.operations
    .filter(({type, sourceAtUs: anchor}) =>
      type !== "overlay" && (anchor < sourceAtUs || (bias === "after" && anchor === sourceAtUs)),
    )
    .reduce((sum, {outputRange}) => sum + outputRange.endUs - outputRange.startUs, 0);
  return {ok: true, value: timeUs(sourceAtUs + delay)};
};

export const outputTimeToSourceTime = (
  timeline: ResolvedTimeline,
  outputAtUs: TimeUs,
): TimelineResult<OutputTimeResolution> => {
  if (!Number.isSafeInteger(outputAtUs) || outputAtUs < 0 || outputAtUs > timeline.durationUs) {
    return {ok: false, error: {
      code: "TIMELINE_INVALID_ANCHOR",
      message: "Output time must be within the output timeline.",
      retryable: false,
      details: {outputAtUs, outputDurationUs: timeline.durationUs},
    }};
  }
  if (outputAtUs === timeline.durationUs) {
    return {ok: true, value: {kind: "end", sourceAtUs: timeline.sourceDurationUs}};
  }

  const blocker = timeline.operations.find(
    (operation) => operation.type !== "overlay" && containsTime(operation.outputRange, outputAtUs),
  );
  if (blocker && blocker.type !== "overlay") {
    return {ok: true, value: {
      kind: "blocked",
      sourceAtUs: blocker.sourceAtUs,
      operationId: blocker.operationId,
      mode: blocker.type,
    }};
  }

  const source = timeline.segments.find(
    (segment): segment is ResolvedTtsSegment =>
      segment.type === "tts" && containsTime(segment.outputRange, outputAtUs),
  );
  if (source) {
    return {ok: true, value: {
      kind: "source",
      sourceAtUs: timeUs(source.sourceRange.startUs + outputAtUs - source.outputRange.startUs),
    }};
  }

  return {ok: true, value: {kind: "end", sourceAtUs: timeline.sourceDurationUs}};
};
