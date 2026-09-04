import {validateCaptionDocument} from "@nihon-zupzup/caption";
import type {JsonObject, TimeRange, TimeUs} from "@nihon-zupzup/core";
import type {
  ResolveTimelineInput,
  TimelineIssueCode,
  TimelineValidationIssue,
  TimelineValidationResult,
  ValidatedTimelineInput,
  ValidatedTimelineOperation,
} from "./types.js";

interface CaptionBoundary {
  readonly beforeUs: TimeUs;
  readonly afterUs: TimeUs;
}

interface PositionedOperation {
  readonly operationId: string;
  readonly mode: "insert" | "pause" | "overlay";
  readonly outputStartUs: number;
  readonly outputEndUs: number;
}

const issue = (
  code: TimelineIssueCode,
  message: string,
  details: JsonObject,
  operationId?: string,
  severity: "error" | "warning" = "error",
): TimelineValidationIssue => ({
  code,
  message,
  retryable: false,
  details,
  severity,
  ...(operationId === undefined ? {} : {operationId}),
});

const isNonNegativeTime = (value: unknown): value is TimeUs =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isPositiveTime = (value: unknown): value is TimeUs =>
  isNonNegativeTime(value) && value > 0;

const buildCaptionIndex = (input: ResolveTimelineInput): Map<string, CaptionBoundary> => {
  const result = new Map<string, CaptionBoundary>();
  for (const cue of input.captions.cues) {
    result.set(cue.id, {beforeUs: cue.source.range.startUs, afterUs: cue.source.range.endUs});
  }
  for (const unit of input.captions.displayUnits) {
    result.set(unit.id, {beforeUs: unit.range.startUs, afterUs: unit.range.endUs});
  }
  return result;
};

const isStrictlyInside = (range: TimeRange, atUs: TimeUs): boolean =>
  range.startUs < atUs && atUs < range.endUs;

export const validateTimelineInput = (
  input: ResolveTimelineInput,
): ValidatedTimelineInput => {
  const issues: TimelineValidationIssue[] = [];
  const validated: ValidatedTimelineOperation[] = [];

  if (!isNonNegativeTime(input.sourceDurationUs)) {
    issues.push(issue(
      "TIMELINE_INVALID_SOURCE_DURATION",
      "Source duration must be a non-negative safe integer TimeUs.",
      {sourceDurationUs: input.sourceDurationUs},
    ));
  }

  const captionValidation = validateCaptionDocument(input.captions);
  if (!captionValidation.valid) {
    issues.push(issue(
      "TIMELINE_INVALID_CAPTIONS",
      "Caption document must pass Caption validation before timeline resolution.",
      {captionErrorCodes: captionValidation.errors.map(({code}) => code)},
    ));
  }

  if (isNonNegativeTime(input.sourceDurationUs)) {
    for (const cue of input.captions.cues) {
      if (cue.source.range.endUs > input.sourceDurationUs) {
        issues.push(issue(
          "TIMELINE_INVALID_CAPTIONS",
          "Caption cue range must be contained by the source timeline.",
          {
            owner: "cue",
            captionId: cue.id,
            startUs: cue.source.range.startUs,
            endUs: cue.source.range.endUs,
            sourceDurationUs: input.sourceDurationUs,
          },
        ));
      }
    }
    for (const unit of input.captions.displayUnits) {
      if (unit.range.endUs > input.sourceDurationUs) {
        issues.push(issue(
          "TIMELINE_INVALID_CAPTIONS",
          "Caption display unit range must be contained by the source timeline.",
          {
            owner: "display-unit",
            captionId: unit.id,
            startUs: unit.range.startUs,
            endUs: unit.range.endUs,
            sourceDurationUs: input.sourceDurationUs,
          },
        ));
      }
    }
  }

  const captions = buildCaptionIndex(input);
  const operationIds = new Set<string>();

  input.operations.forEach((operation, operationIndex) => {
    if (operation.id.trim().length === 0) {
      issues.push(issue(
        "TIMELINE_INVALID_OPERATION_ID",
        "Timeline operation id must not be empty.",
        {operationIndex},
        operation.id,
      ));
    } else if (operationIds.has(operation.id)) {
      issues.push(issue(
        "TIMELINE_DUPLICATE_OPERATION_ID",
        "Timeline operation ids must be unique.",
        {operationIndex},
        operation.id,
      ));
    }
    operationIds.add(operation.id);

    let sourceAtUs: TimeUs | undefined;
    if (operation.anchor.type === "source_time") {
      if (
        !isNonNegativeTime(operation.anchor.atUs) ||
        (isNonNegativeTime(input.sourceDurationUs) && operation.anchor.atUs > input.sourceDurationUs)
      ) {
        issues.push(issue(
          "TIMELINE_INVALID_ANCHOR",
          "source_time anchor must be within the source timeline.",
          {atUs: operation.anchor.atUs, sourceDurationUs: input.sourceDurationUs},
          operation.id,
        ));
      } else {
        sourceAtUs = operation.anchor.atUs;
      }
    } else {
      const caption = captions.get(operation.anchor.captionId);
      if (!caption) {
        issues.push(issue(
          "TIMELINE_CAPTION_NOT_FOUND",
          "Caption anchor does not reference an existing cue or display unit.",
          {captionId: operation.anchor.captionId, anchorType: operation.anchor.type},
          operation.id,
        ));
      } else {
        sourceAtUs = operation.anchor.type === "caption_before"
          ? caption.beforeUs
          : caption.afterUs;
        if (
          isNonNegativeTime(input.sourceDurationUs) &&
          sourceAtUs > input.sourceDurationUs
        ) {
          issues.push(issue(
            "TIMELINE_INVALID_ANCHOR",
            "Caption anchor must be within the source timeline.",
            {
              captionId: operation.anchor.captionId,
              anchorType: operation.anchor.type,
              atUs: sourceAtUs,
              sourceDurationUs: input.sourceDurationUs,
            },
            operation.id,
          ));
          sourceAtUs = undefined;
        }
      }
    }

    if (
      sourceAtUs !== undefined &&
      operation.mode !== "overlay" &&
      operation.anchor.type === "source_time" &&
      input.captions.displayUnits.some(({range}) => isStrictlyInside(range, sourceAtUs))
    ) {
      issues.push(issue(
        "TIMELINE_CAPTION_MIDDLE_INSERT",
        "Insert and pause operations cannot split a caption display unit.",
        {atUs: sourceAtUs},
        operation.id,
      ));
    }

    let operationDurationUs: TimeUs | undefined;
    if (operation.mode === "pause") {
      if (!isPositiveTime(operation.durationUs)) {
        issues.push(issue(
          "TIMELINE_INVALID_PAUSE_DURATION",
          "Pause duration must be a positive safe integer TimeUs.",
          {durationUs: operation.durationUs},
          operation.id,
        ));
      } else {
        operationDurationUs = operation.durationUs;
      }
    } else {
      const asset = input.resolveAsset(operation.assetId);
      if (!asset) {
        issues.push(issue(
          "TIMELINE_ASSET_NOT_FOUND",
          "Timeline operation references an asset that cannot be resolved.",
          {assetId: operation.assetId},
          operation.id,
        ));
      } else if (!isPositiveTime(asset.durationUs)) {
        issues.push(issue(
          "TIMELINE_INVALID_ASSET_DURATION",
          "Resolved asset duration must be a positive safe integer TimeUs.",
          {assetId: operation.assetId, durationUs: asset.durationUs},
          operation.id,
        ));
      } else {
        operationDurationUs = asset.durationUs;
      }
    }

    if (sourceAtUs !== undefined && operationDurationUs !== undefined) {
      validated.push({
        operation,
        operationIndex,
        sourceAtUs,
        durationUs: operationDurationUs,
      });
    }
  });

  if (isNonNegativeTime(input.sourceDurationUs)) {
    const positioned: PositionedOperation[] = [];
    let blockingDelayUs = 0;
    let positioningFailed = false;
    const chronological = [...validated].sort(
      (left, right) => left.sourceAtUs - right.sourceAtUs || left.operationIndex - right.operationIndex,
    );

    for (const item of chronological) {
      const outputStartUs = item.sourceAtUs + blockingDelayUs;
      const outputEndUs = outputStartUs + item.durationUs;
      if (!Number.isSafeInteger(outputStartUs) || !Number.isSafeInteger(outputEndUs)) {
        positioningFailed = true;
        issues.push(issue(
          "TIMELINE_DURATION_OVERFLOW",
          "Timeline operation output range exceeds the safe integer TimeUs range.",
          {
            sourceAtUs: item.sourceAtUs,
            blockingDelayUs,
            durationUs: item.durationUs,
          },
          item.operation.id,
        ));
      } else {
        positioned.push({
          operationId: item.operation.id,
          mode: item.operation.mode,
          outputStartUs,
          outputEndUs,
        });
      }

      if (item.operation.mode !== "overlay") {
        const nextDelayUs = blockingDelayUs + item.durationUs;
        if (!Number.isSafeInteger(nextDelayUs)) {
          positioningFailed = true;
        } else {
          blockingDelayUs = nextDelayUs;
        }
      }
    }

    const outputDurationUs = input.sourceDurationUs + blockingDelayUs;
    if (!Number.isSafeInteger(outputDurationUs)) {
      positioningFailed = true;
      issues.push(issue(
        "TIMELINE_DURATION_OVERFLOW",
        "Resolved output duration exceeds the safe integer TimeUs range.",
        {sourceDurationUs: input.sourceDurationUs, totalBlockingDurationUs: blockingDelayUs},
      ));
    }

    if (!positioningFailed) {
      for (const operation of positioned) {
        if (operation.mode === "overlay" && operation.outputEndUs > outputDurationUs) {
          issues.push(issue(
            "TIMELINE_OVERLAY_TRUNCATED",
            "Overlay extends beyond the output timeline and will be clipped at playback end.",
            {
              outputStartUs: operation.outputStartUs,
              requestedOutputEndUs: operation.outputEndUs,
              clippedAtUs: outputDurationUs,
            },
            operation.operationId,
            "warning",
          ));
        }
      }
    }
  }

  const errors = issues.filter(({severity}) => severity === "error");
  const warnings = issues.filter(({severity}) => severity === "warning");
  return {
    input,
    operations: validated,
    validation: {
      valid: errors.length === 0,
      issues,
      errors,
      warnings,
    },
  };
};

export const timelineValidationError = (
  validation: TimelineValidationResult,
) => issue(
  validation.errors[0]?.code ?? "TIMELINE_INVALID_ANCHOR",
  "Timeline input failed validation.",
  {
    issueCodes: validation.issues.map(({code}) => code),
    issues: validation.issues.map(({code, message, operationId, severity, details}) => ({
      code,
      message,
      severity,
      details,
      ...(operationId === undefined ? {} : {operationId}),
    })),
  },
);
