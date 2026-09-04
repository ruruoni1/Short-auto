import type {JsonObject} from "./json.js";

export type CoreErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "REVISION_CONFLICT"
  | "MIGRATION_NOT_FOUND"
  | "MIGRATION_FAILED"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "ABSOLUTE_PATH_FORBIDDEN"
  | "EVENT_HANDLER_FAILED"
  | "INTERNAL_ERROR";

export interface ErrorContract {
  readonly code: CoreErrorCode | (string & {});
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: JsonObject;
  readonly cause?: ErrorContract;
}

export class CoreError extends Error {
  public readonly contract: ErrorContract;

  public constructor(contract: ErrorContract) {
    super(contract.message);
    this.name = "CoreError";
    this.contract = contract;
  }
}

export type Result<T, E extends ErrorContract = ErrorContract> =
  | {readonly ok: true; readonly value: T}
  | {readonly ok: false; readonly error: E};

export const ok = <T>(value: T): Result<T> => ({ok: true, value});
export const err = <E extends ErrorContract>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export const toErrorContract = (error: unknown): ErrorContract => {
  if (error instanceof CoreError) return error.contract;
  if (error instanceof Error) {
    return {code: "INTERNAL_ERROR", message: error.message, retryable: false};
  }
  return {
    code: "INTERNAL_ERROR",
    message: "An unknown error occurred.",
    retryable: false,
  };
};
