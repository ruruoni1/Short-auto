import {CoreError} from "./errors.js";
import {isEntityId, type ProjectId} from "./ids.js";
import type {JsonObject, JsonValue} from "./json.js";
import {
  YOUTUBE_REMOTE_PUBLISH_STATUSES,
  YOUTUBE_UPLOAD_STATUSES,
  isContentStatus,
  isProductionStatus,
  type OwnedStatusState,
} from "./status.js";

export const CURRENT_PROJECT_SCHEMA_VERSION = 1 as const;
export type ProjectSchemaVersion = number;

export interface ProjectIdentity {
  readonly id: ProjectId;
  readonly title: string;
  readonly channelPackId: string;
  readonly contentType: string;
  readonly contentProfileId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectDocument extends JsonObject {
  schemaVersion: ProjectSchemaVersion;
  revision: number;
  project: ProjectIdentity & JsonObject;
  status: OwnedStatusState & JsonObject;
  data: JsonObject;
}

export interface ProjectMigration {
  readonly fromVersion: ProjectSchemaVersion;
  readonly toVersion: ProjectSchemaVersion;
  migrate(document: JsonObject): JsonObject;
}

export class ProjectMigrationRegistry {
  private readonly migrations = new Map<ProjectSchemaVersion, ProjectMigration>();

  public constructor(
    public readonly currentVersion: ProjectSchemaVersion,
    migrations: readonly ProjectMigration[] = [],
  ) {
    for (const migration of migrations) {
      if (migration.toVersion <= migration.fromVersion || this.migrations.has(migration.fromVersion)) {
        throw new CoreError({
          code: "VALIDATION_ERROR",
          message: "Project migrations must form unique, forward-only steps.",
          retryable: false,
        });
      }
      this.migrations.set(migration.fromVersion, migration);
    }
  }

  public migrate(raw: JsonObject): ProjectDocument {
    let document = structuredClone(raw);
    let version = readSchemaVersion(document);
    while (version < this.currentVersion) {
      const migration = this.migrations.get(version);
      if (!migration) {
        throw new CoreError({
          code: "MIGRATION_NOT_FOUND",
          message: `No project migration is registered from schema version ${version}.`,
          retryable: false,
          details: {fromVersion: version, targetVersion: this.currentVersion},
        });
      }
      try {
        document = migration.migrate(structuredClone(document));
      } catch (error) {
        throw new CoreError({
          code: "MIGRATION_FAILED",
          message: `Project migration ${migration.fromVersion} -> ${migration.toVersion} failed.`,
          retryable: false,
          details: {reason: error instanceof Error ? error.message : "unknown"},
        });
      }
      version = readSchemaVersion(document);
      if (version !== migration.toVersion) {
        throw new CoreError({
          code: "MIGRATION_FAILED",
          message: "A migration did not write its declared schema version.",
          retryable: false,
        });
      }
    }
    if (version !== this.currentVersion) {
      throw new CoreError({
        code: "VALIDATION_ERROR",
        message: `Project schema version ${version} is newer than supported version ${this.currentVersion}.`,
        retryable: false,
      });
    }
    assertProjectDocument(document);
    return document;
  }
}

export interface ProjectStorageAdapter {
  read(projectId: ProjectId): Promise<JsonObject | null>;
  write(
    projectId: ProjectId,
    document: ProjectDocument,
    expectedRevision: number,
  ): Promise<void>;
}

export class ProjectRepository {
  public constructor(
    private readonly storage: ProjectStorageAdapter,
    private readonly migrations = new ProjectMigrationRegistry(CURRENT_PROJECT_SCHEMA_VERSION),
  ) {}

  public async load(projectId: ProjectId): Promise<ProjectDocument | null> {
    const raw = await this.storage.read(projectId);
    return raw === null ? null : this.migrations.migrate(raw);
  }

  public async save(
    document: ProjectDocument,
    expectedRevision: number,
  ): Promise<ProjectDocument> {
    assertProjectDocument(document);
    if (document.revision !== expectedRevision) {
      throw revisionConflict(expectedRevision, document.revision);
    }
    assertPortableDocument(document);
    const next: ProjectDocument = structuredClone({
      ...document,
      revision: expectedRevision + 1,
      project: {...document.project, updatedAt: new Date().toISOString()},
    });
    await this.storage.write(document.project.id, next, expectedRevision);
    return structuredClone(next);
  }
}

export class InMemoryProjectStorage implements ProjectStorageAdapter {
  private readonly documents = new Map<ProjectId, ProjectDocument>();

  public async read(projectId: ProjectId): Promise<JsonObject | null> {
    return structuredClone(this.documents.get(projectId) ?? null);
  }

  public async write(
    projectId: ProjectId,
    document: ProjectDocument,
    expectedRevision: number,
  ): Promise<void> {
    const currentRevision = this.documents.get(projectId)?.revision ?? 0;
    if (currentRevision !== expectedRevision) {
      throw revisionConflict(expectedRevision, currentRevision);
    }
    this.documents.set(projectId, structuredClone(document));
  }
}

export function assertProjectDocument(value: JsonObject): asserts value is ProjectDocument {
  const project = value.project;
  const status = value.status;
  if (
    !Number.isSafeInteger(value.schemaVersion) ||
    (value.schemaVersion as number) < 1 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !isJsonObject(project) ||
    !isEntityId(project.id, "prj") ||
    typeof project.title !== "string" ||
    !isIsoDate(project.createdAt) ||
    !isIsoDate(project.updatedAt) ||
    !isJsonObject(status) ||
    !isContentStatus(status.contentStatus) ||
    !isProductionStatus(status.productionStatus) ||
    !isValidYouTubeState(status.youtube) ||
    !isJsonObject(value.data)
  ) {
    throw new CoreError({
      code: "VALIDATION_ERROR",
      message: "The project document is invalid.",
      retryable: false,
    });
  }
}

export const assertPortableDocument = (document: JsonObject): void => {
  const location = findAbsoluteLocalPath(document);
  if (location) {
    throw new CoreError({
      code: "ABSOLUTE_PATH_FORBIDDEN",
      message: "Portable project documents cannot contain absolute local paths.",
      retryable: false,
      details: {jsonPath: location},
    });
  }
};

const findAbsoluteLocalPath = (value: JsonValue, path = "$"): string | null => {
  if (typeof value === "string") {
    return /^(?:[a-zA-Z]:[\\/]|\\\\|file:\/\/|\/(?:Users|home|var|tmp|opt|etc)\/)/.test(value)
      ? path
      : null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findAbsoluteLocalPath(value[index] as JsonValue, `${path}[${index}]`);
      if (match) return match;
    }
    return null;
  }
  if (isJsonObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const match = findAbsoluteLocalPath(child, `${path}.${key}`);
      if (match) return match;
    }
  }
  return null;
};

const readSchemaVersion = (value: JsonObject): number => {
  if (!Number.isSafeInteger(value.schemaVersion) || (value.schemaVersion as number) < 1) {
    throw new CoreError({
      code: "VALIDATION_ERROR",
      message: "schemaVersion must be a positive integer.",
      retryable: false,
    });
  }
  return value.schemaVersion as number;
};

const isIsoDate = (value: JsonValue | undefined): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidYouTubeState = (value: JsonValue | undefined): boolean => {
  if (!isJsonObject(value)) return false;
  return (
    typeof value.uploadStatus === "string" &&
    (YOUTUBE_UPLOAD_STATUSES as readonly string[]).includes(value.uploadStatus) &&
    typeof value.publishStatus === "string" &&
    (YOUTUBE_REMOTE_PUBLISH_STATUSES as readonly string[]).includes(value.publishStatus) &&
    (value.visibility === null ||
      value.visibility === "public" ||
      value.visibility === "unlisted" ||
      value.visibility === "private") &&
    (value.videoId === null || typeof value.videoId === "string") &&
    (value.scheduledPublishAt === null || isIsoDate(value.scheduledPublishAt)) &&
    (value.lastSyncedAt === null || isIsoDate(value.lastSyncedAt))
  );
};

const revisionConflict = (expected: number, actual: number): CoreError =>
  new CoreError({
    code: "REVISION_CONFLICT",
    message: `Expected revision ${expected}, but found ${actual}.`,
    retryable: true,
    details: {expectedRevision: expected, actualRevision: actual},
  });
