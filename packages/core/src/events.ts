import {CoreError, toErrorContract, type ErrorContract} from "./errors.js";
import {generateEntityId, isEntityId, type EntityId, type EventId} from "./ids.js";
import type {JsonObject} from "./json.js";

export interface AggregateReference {
  readonly type: string;
  readonly id: string;
}

export interface DomainEventEnvelope<
  TType extends string = string,
  TPayload extends JsonObject = JsonObject,
> {
  readonly schemaVersion: 1;
  readonly eventId: EventId;
  readonly eventType: TType;
  readonly aggregate: AggregateReference;
  readonly occurredAt: string;
  readonly producer: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly payload: TPayload;
}

export interface CreateDomainEventInput<
  TType extends string,
  TPayload extends JsonObject,
> extends Omit<DomainEventEnvelope<TType, TPayload>, "schemaVersion" | "eventId" | "occurredAt"> {
  readonly eventId?: EventId;
  readonly occurredAt?: string;
}

export const createDomainEvent = <TType extends string, TPayload extends JsonObject>(
  input: CreateDomainEventInput<TType, TPayload>,
): DomainEventEnvelope<TType, TPayload> => ({
  schemaVersion: 1,
  eventId: input.eventId ?? generateEntityId("evt"),
  eventType: input.eventType,
  aggregate: input.aggregate,
  occurredAt: input.occurredAt ?? new Date().toISOString(),
  producer: input.producer,
  ...(input.correlationId === undefined ? {} : {correlationId: input.correlationId}),
  ...(input.causationId === undefined ? {} : {causationId: input.causationId}),
  payload: input.payload,
});

export type DomainEventHandler<E extends DomainEventEnvelope = DomainEventEnvelope> = (
  event: E,
) => void | Promise<void>;

export type EventSubscription = {unsubscribe(): void};
export type EventPublishResult =
  | {readonly status: "delivered"; readonly handlerCount: number}
  | {readonly status: "duplicate"; readonly handlerCount: 0};

export interface DomainEventBus {
  publish(event: DomainEventEnvelope): Promise<EventPublishResult>;
  subscribe(eventType: string | "*", handler: DomainEventHandler): EventSubscription;
  hasProcessed(eventId: EventId): boolean;
}

export class InMemoryDomainEventBus implements DomainEventBus {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();
  private readonly processed = new Set<EventId>();
  private readonly inFlight = new Map<EventId, Promise<EventPublishResult>>();

  public subscribe(eventType: string | "*", handler: DomainEventHandler): EventSubscription {
    const handlers = this.handlers.get(eventType) ?? new Set<DomainEventHandler>();
    handlers.add(handler);
    this.handlers.set(eventType, handlers);
    return {unsubscribe: () => handlers.delete(handler)};
  }

  public hasProcessed(eventId: EventId): boolean {
    return this.processed.has(eventId);
  }

  public async publish(event: DomainEventEnvelope): Promise<EventPublishResult> {
    this.validate(event);
    if (this.processed.has(event.eventId)) return {status: "duplicate", handlerCount: 0};
    const pending = this.inFlight.get(event.eventId);
    if (pending) {
      await pending;
      return {status: "duplicate", handlerCount: 0};
    }
    const delivery = this.deliver(event);
    this.inFlight.set(event.eventId, delivery);
    try {
      return await delivery;
    } finally {
      this.inFlight.delete(event.eventId);
    }
  }

  private async deliver(event: DomainEventEnvelope): Promise<EventPublishResult> {
    const handlers = new Set([
      ...(this.handlers.get(event.eventType) ?? []),
      ...(this.handlers.get("*") ?? []),
    ]);
    try {
      for (const handler of handlers) await handler(event);
      this.processed.add(event.eventId);
      return {status: "delivered", handlerCount: handlers.size};
    } catch (error) {
      const cause: ErrorContract = toErrorContract(error);
      throw new CoreError({
        code: "EVENT_HANDLER_FAILED",
        message: `A handler failed for ${event.eventType}.`,
        retryable: true,
        details: {eventId: event.eventId, eventType: event.eventType},
        cause,
      });
    }
  }

  private validate(event: DomainEventEnvelope): void {
    if (
      event.schemaVersion !== 1 ||
      !isEntityId(event.eventId, "evt") ||
      event.eventType.length === 0 ||
      event.aggregate.type.length === 0 ||
      event.aggregate.id.length === 0 ||
      Number.isNaN(Date.parse(event.occurredAt))
    ) {
      throw new CoreError({
        code: "VALIDATION_ERROR",
        message: "The domain event envelope is invalid.",
        retryable: false,
      });
    }
  }
}

export type EventAggregateId = EntityId | string;
