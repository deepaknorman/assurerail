import { Global, Injectable, Module } from "@nestjs/common";
import { EventEmitter } from "node:events";

export interface VenueEvent {
  event: string; // note.minted | dvp.settled | note.closed | …
  payload: Record<string, unknown>;
  at: string;
}

// In-process event bus — the decoupling point between the lifecycle services (emit) and the sink
// (persist EventLog + meter billing + dispatch webhooks). Global + always available, so mint/dvp/close
// can emit in both DB and in-memory modes; the persistent sink only subscribes in DB mode.
@Injectable()
export class VenueEventBus {
  private readonly em = new EventEmitter();
  constructor() {
    this.em.setMaxListeners(50);
  }
  emit(event: string, payload: Record<string, unknown>): void {
    this.em.emit("evt", { event, payload, at: new Date().toISOString() } satisfies VenueEvent);
  }
  on(cb: (e: VenueEvent) => void): void {
    this.em.on("evt", cb);
  }
}

@Global()
@Module({ providers: [VenueEventBus], exports: [VenueEventBus] })
export class EventsModule {}
