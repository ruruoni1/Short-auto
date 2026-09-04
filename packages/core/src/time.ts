export type TimeUs = number & {readonly __timeUs: unique symbol};

export interface TimeRange {
  readonly startUs: TimeUs;
  readonly endUs: TimeUs;
}

export interface FrameRate {
  readonly numerator: number;
  readonly denominator: number;
}

export const timeUs = (value: number): TimeUs => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("TimeUs must be a non-negative safe integer.");
  }
  return value as TimeUs;
};

export const timeRange = (startUs: number, endUs: number): TimeRange => {
  const start = timeUs(startUs);
  const end = timeUs(endUs);
  if (start >= end) throw new RangeError("A time range must satisfy startUs < endUs.");
  return {startUs: start, endUs: end};
};

export const containsTime = (range: TimeRange, atUs: TimeUs): boolean =>
  range.startUs <= atUs && atUs < range.endUs;

export const durationUs = (range: TimeRange): TimeUs =>
  timeUs(range.endUs - range.startUs);

export const secondsToUs = (seconds: number): TimeUs => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError("Seconds must be finite and non-negative.");
  }
  return timeUs(Math.round(seconds * 1_000_000));
};

export const usToSeconds = (value: TimeUs): number => value / 1_000_000;

const assertFrameRate = (rate: FrameRate): void => {
  if (
    !Number.isSafeInteger(rate.numerator) ||
    !Number.isSafeInteger(rate.denominator) ||
    rate.numerator <= 0 ||
    rate.denominator <= 0
  ) {
    throw new RangeError("Frame rate numerator and denominator must be positive integers.");
  }
};

export const frameToUs = (frame: number, rate: FrameRate): TimeUs => {
  assertFrameRate(rate);
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new RangeError("Frame must be a non-negative integer.");
  }
  return timeUs(Math.round((frame * 1_000_000 * rate.denominator) / rate.numerator));
};

export const usToFrame = (value: TimeUs, rate: FrameRate): number => {
  assertFrameRate(rate);
  return Math.round((value * rate.numerator) / (1_000_000 * rate.denominator));
};
