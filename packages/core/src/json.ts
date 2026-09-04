export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {[key: string]: JsonValue};

export const cloneJson = <T extends JsonValue>(value: T): T =>
  structuredClone(value);
