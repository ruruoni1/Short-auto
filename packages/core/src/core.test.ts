import {describe, expect, it, vi} from "vitest";
import {
  ChannelPackRegistry,
  CoreError,
  InMemoryDomainEventBus,
  InMemoryProjectStorage,
  ProjectMigrationRegistry,
  ProjectRepository,
  assertPortableDocument,
  containsTime,
  createDomainEvent,
  frameToUs,
  generateEntityId,
  isEntityId,
  timeRange,
  timeUs,
  usToFrame,
  type ChannelPackId,
  type ContentProfileId,
  type JsonObject,
  type ProjectDocument,
} from "./index.js";

const idSource = {
  now: () => 1_788_524_800_000,
  randomBytes: (length: number) => new Uint8Array(length).fill(7),
};

const projectDocument = (): ProjectDocument => ({
  schemaVersion: 1,
  revision: 0,
  project: {
    id: generateEntityId("prj", idSource),
    title: "Test",
    channelPackId: "test_pack",
    contentType: "test_long",
    contentProfileId: "test_profile",
    createdAt: "2026-09-04T12:00:00.000Z",
    updatedAt: "2026-09-04T12:00:00.000Z",
  },
  status: {
    contentStatus: "idea",
    productionStatus: "draft",
    youtube: {
      uploadStatus: "not_started",
      publishStatus: "unknown",
      visibility: null,
      videoId: null,
      scheduledPublishAt: null,
      lastSyncedAt: null,
    },
  },
  data: {},
});

describe("IDs", () => {
  it("generates schema-compatible prefixed ULIDs", () => {
    const assetId = generateEntityId("ast", idSource);
    expect(assetId).toMatch(/^ast_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(isEntityId(assetId, "ast")).toBe(true);
    expect(isEntityId(assetId, "prj")).toBe(false);
  });
});

describe("TimeUs", () => {
  it("uses half-open ranges", () => {
    const range = timeRange(10, 20);
    expect(containsTime(range, timeUs(10))).toBe(true);
    expect(containsTime(range, timeUs(19))).toBe(true);
    expect(containsTime(range, timeUs(20))).toBe(false);
  });

  it("round-trips representative 29.97fps frames", () => {
    const rate = {numerator: 30_000, denominator: 1_001};
    for (const frame of [0, 1, 30, 300, 3_003]) {
      expect(usToFrame(frameToUs(frame, rate), rate)).toBe(frame);
    }
  });
});

describe("domain events", () => {
  it("delivers a duplicated event only once, including concurrent receives", async () => {
    const bus = new InMemoryDomainEventBus();
    const handler = vi.fn(async () => Promise.resolve());
    bus.subscribe("project.created", handler);
    const event = createDomainEvent({
      eventId: generateEntityId("evt", idSource),
      eventType: "project.created",
      aggregate: {type: "project", id: "prj_test"},
      occurredAt: "2026-09-04T12:00:00.000Z",
      producer: "core-test",
      payload: {title: "Test"},
    });
    const results = await Promise.all([bus.publish(event), bus.publish(event)]);
    expect(results.map((result) => result.status).sort()).toEqual(["delivered", "duplicate"]);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("project storage", () => {
  it("increments revisions and rejects stale saves", async () => {
    const repository = new ProjectRepository(new InMemoryProjectStorage());
    const initial = projectDocument();
    const saved = await repository.save(initial, 0);
    expect(saved.revision).toBe(1);
    await expect(repository.save(initial, 0)).rejects.toMatchObject({
      contract: {code: "REVISION_CONFLICT"},
    });
  });

  it("rejects absolute local paths", () => {
    expect(() => assertPortableDocument({media: "C:\\Users\\me\\video.mp4"})).toThrow(CoreError);
    expect(() => assertPortableDocument({media: "assets/video.mp4"})).not.toThrow();
  });

  it("runs ordered schema migrations", () => {
    const registry = new ProjectMigrationRegistry(2, [
      {
        fromVersion: 1,
        toVersion: 2,
        migrate: (document: JsonObject) => ({...document, schemaVersion: 2}),
      },
    ]);
    const migrated = registry.migrate(projectDocument());
    expect(migrated.schemaVersion).toBe(2);
  });
});

describe("Channel Pack registry", () => {
  it("registers profiles without channel-specific Core conditions", () => {
    const registry = new ChannelPackRegistry();
    const packId = "test_pack" as ChannelPackId;
    const profileId = "test_profile" as ContentProfileId;
    registry.register({
      pack: {
        schemaVersion: 1,
        id: packId,
        displayName: "Test",
        contentTypes: ["test_long"],
        defaultLocale: "en-US",
      },
      profiles: [
        {
          schemaVersion: 1,
          id: profileId,
          channelPackId: packId,
          contentType: "test_long",
          allowedSceneTypes: ["EXPLAIN"],
        },
      ],
    });
    expect(registry.getProfile(packId, profileId)?.contentType).toBe("test_long");
  });
});
