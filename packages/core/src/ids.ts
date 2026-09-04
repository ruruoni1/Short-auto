const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BODY_PATTERN = "[0-9A-HJKMNP-TV-Z]{26}";

export type IdPrefix =
  | "prj"
  | "evt"
  | "chn"
  | "cpf"
  | "cnt"
  | "tln"
  | "trk"
  | "clp"
  | "scn"
  | "cap"
  | "ast";

export type EntityId<P extends string = IdPrefix> = `${P}_${string}`;
export type ProjectId = EntityId<"prj">;
export type EventId = EntityId<"evt">;
export type ChannelPackId = string & {readonly __channelPackId: unique symbol};
export type ContentProfileId = string & {readonly __contentProfileId: unique symbol};

export interface IdSource {
  now(): number;
  randomBytes(length: number): Uint8Array;
}

const defaultSource: IdSource = {
  now: () => Date.now(),
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
};

const encodeTime = (value: number): string => {
  let remaining = Math.trunc(value);
  const chars = Array.from({length: 10}, () => "0");
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    chars[index] = CROCKFORD[remaining % 32] ?? "0";
    remaining = Math.floor(remaining / 32);
  }
  return chars.join("");
};

const encodeRandom = (bytes: Uint8Array): string => {
  let buffer = 0;
  let bits = 0;
  let output = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += CROCKFORD[(buffer >>> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits > 0) output += CROCKFORD[(buffer << (5 - bits)) & 31];
  return output.padEnd(16, "0").slice(0, 16);
};

export const generateEntityId = <P extends IdPrefix>(
  prefix: P,
  source: IdSource = defaultSource,
): EntityId<P> => {
  const now = source.now();
  if (!Number.isSafeInteger(now) || now < 0 || now > 281_474_976_710_655) {
    throw new RangeError("ID timestamp must be a non-negative 48-bit integer.");
  }
  return `${prefix}_${encodeTime(now)}${encodeRandom(source.randomBytes(10))}`;
};

export const isEntityId = <P extends IdPrefix>(
  value: unknown,
  prefix: P,
): value is EntityId<P> =>
  typeof value === "string" &&
  new RegExp(`^${prefix}_${BODY_PATTERN}$`).test(value);

export const isChannelPackId = (value: unknown): value is ChannelPackId =>
  typeof value === "string" && /^[a-z][a-z0-9_]{1,63}$/.test(value);

export const isContentProfileId = (value: unknown): value is ContentProfileId =>
  typeof value === "string" && /^[a-z][a-z0-9_]{1,63}$/.test(value);
