import type {
  ChannelPackId,
  ChannelPackProvider,
  ChannelPackRegistration,
  ContentProfileDefinition,
  ContentProfileId,
} from "@nihon-zupzup/core";

export const NIHON_ZUPZUP_CHANNEL_PACK_ID = "nihon_zupzup" as ChannelPackId;

export const NIHON_ZUPZUP_CONTENT_TYPES = [
  "discovery_long",
  "training_long",
  "discovery_short",
  "learning_short",
] as const;

export type NihonZupZupContentType = (typeof NIHON_ZUPZUP_CONTENT_TYPES)[number];

const SCENES = [
  "HOOK",
  "KEYWORD",
  "QUESTION",
  "COMPARE",
  "EXPLAIN",
  "QUOTE_ANALYSIS",
  "RELATION",
  "CONCEPT",
  "RECAP",
] as const;

const profile = (
  id: string,
  contentType: NihonZupZupContentType,
): ContentProfileDefinition => ({
  schemaVersion: 1,
  id: id as ContentProfileId,
  channelPackId: NIHON_ZUPZUP_CHANNEL_PACK_ID,
  contentType,
  allowedSceneTypes: SCENES,
});

export const nihonZupZupRegistration: ChannelPackRegistration = {
  pack: {
    schemaVersion: 1,
    id: NIHON_ZUPZUP_CHANNEL_PACK_ID,
    displayName: "니혼줍줍",
    defaultLocale: "ko-KR",
    contentTypes: NIHON_ZUPZUP_CONTENT_TYPES,
  },
  profiles: [
    profile("anime_analysis", "discovery_long"),
    profile("drama_analysis", "discovery_long"),
    profile("practical_explainer", "discovery_long"),
    profile("wasei_eigo", "discovery_long"),
    profile("dialect", "discovery_long"),
    profile("trend", "discovery_long"),
    profile("shadowing_training", "training_long"),
    profile("repetition_training", "training_long"),
    profile("practical_dialogue_training", "training_long"),
    profile("anime_discovery_short", "discovery_short"),
    profile("drama_discovery_short", "discovery_short"),
    profile("dialect_discovery_short", "discovery_short"),
    profile("trend_discovery_short", "discovery_short"),
    profile("wasei_discovery_short", "discovery_short"),
    profile("phrase_learning_short", "learning_short"),
    profile("vocabulary_learning_short", "learning_short"),
    profile("pronunciation_learning_short", "learning_short"),
  ],
};

export const nihonZupZupChannelPack: ChannelPackProvider = {
  registration: () => nihonZupZupRegistration,
};
