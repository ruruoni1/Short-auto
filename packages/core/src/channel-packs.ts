import {CoreError} from "./errors.js";
import {
  isChannelPackId,
  isContentProfileId,
  type ChannelPackId,
  type ContentProfileId,
} from "./ids.js";
import type {JsonObject} from "./json.js";

export interface ChannelPackDefinition {
  readonly schemaVersion: 1;
  readonly id: ChannelPackId;
  readonly displayName: string;
  readonly contentTypes: readonly string[];
  readonly defaultLocale: string;
  readonly metadata?: JsonObject;
}

export interface ContentProfileDefinition {
  readonly schemaVersion: 1;
  readonly id: ContentProfileId;
  readonly channelPackId: ChannelPackId;
  readonly contentType: string;
  readonly allowedSceneTypes: readonly string[];
  readonly preferredSceneSequence?: readonly string[];
  readonly policies?: Readonly<{
    caption?: JsonObject;
    typography?: JsonObject;
    motion?: JsonObject;
    visual?: JsonObject;
    insert?: JsonObject;
    duration?: JsonObject;
    hook?: JsonObject;
    ending?: JsonObject;
    derivative?: JsonObject;
  }>;
}

export interface ChannelPackRegistration {
  readonly pack: ChannelPackDefinition;
  readonly profiles: readonly ContentProfileDefinition[];
}

export interface ChannelPackProvider {
  registration(): ChannelPackRegistration;
}

export class ChannelPackRegistry {
  private readonly packs = new Map<ChannelPackId, ChannelPackDefinition>();
  private readonly profiles = new Map<string, ContentProfileDefinition>();

  public register(registration: ChannelPackRegistration): void {
    this.validatePack(registration.pack);
    if (this.packs.has(registration.pack.id)) {
      throw new CoreError({
        code: "ALREADY_EXISTS",
        message: `Channel Pack '${registration.pack.id}' is already registered.`,
        retryable: false,
      });
    }
    const localIds = new Set<string>();
    for (const profile of registration.profiles) {
      this.validateProfile(registration.pack, profile);
      if (localIds.has(profile.id) || this.profiles.has(this.key(profile.channelPackId, profile.id))) {
        throw new CoreError({
          code: "ALREADY_EXISTS",
          message: `Content Profile '${profile.id}' is already registered.`,
          retryable: false,
        });
      }
      localIds.add(profile.id);
    }
    this.packs.set(registration.pack.id, registration.pack);
    for (const profile of registration.profiles) {
      this.profiles.set(this.key(profile.channelPackId, profile.id), profile);
    }
  }

  public getPack(id: ChannelPackId): ChannelPackDefinition | undefined {
    return this.packs.get(id);
  }

  public getProfile(
    channelPackId: ChannelPackId,
    profileId: ContentProfileId,
  ): ContentProfileDefinition | undefined {
    return this.profiles.get(this.key(channelPackId, profileId));
  }

  public listProfiles(channelPackId: ChannelPackId): readonly ContentProfileDefinition[] {
    return [...this.profiles.values()].filter((profile) => profile.channelPackId === channelPackId);
  }

  private key(packId: ChannelPackId, profileId: ContentProfileId): string {
    return `${packId}:${profileId}`;
  }

  private validatePack(pack: ChannelPackDefinition): void {
    if (
      pack.schemaVersion !== 1 ||
      !isChannelPackId(pack.id) ||
      pack.displayName.trim().length === 0 ||
      pack.defaultLocale.trim().length === 0 ||
      pack.contentTypes.length === 0 ||
      new Set(pack.contentTypes).size !== pack.contentTypes.length ||
      pack.contentTypes.some((type) => !/^[a-z][a-z0-9_]{1,63}$/.test(type))
    ) {
      throw new CoreError({
        code: "VALIDATION_ERROR",
        message: "The Channel Pack definition is invalid.",
        retryable: false,
      });
    }
  }

  private validateProfile(
    pack: ChannelPackDefinition,
    profile: ContentProfileDefinition,
  ): void {
    if (
      profile.schemaVersion !== 1 ||
      profile.channelPackId !== pack.id ||
      !isContentProfileId(profile.id) ||
      !pack.contentTypes.includes(profile.contentType) ||
      profile.allowedSceneTypes.length === 0
    ) {
      throw new CoreError({
        code: "VALIDATION_ERROR",
        message: `Content Profile '${profile.id}' is invalid for Channel Pack '${pack.id}'.`,
        retryable: false,
      });
    }
  }
}
