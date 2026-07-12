import { Controller, Header, Sse, MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { fromEvent, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CHANGE_EVENT, ChangeEvent } from './events.types';

@Controller('events')
export class EventsController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  // CORS + SSE headers. `EventSource` issues a simple GET so no preflight is
  // required, but the browser still enforces the same-origin policy on the
  // response — without `Access-Control-Allow-Origin` the client silently drops
  // every message. `Cache-Control`/`Connection`/`X-Accel-Buffering` keep
  // intermediaries (and Nest's default response handling) from buffering the
  // stream.
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  @Header('Access-Control-Allow-Headers', 'Cache-Control, Content-Type')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('Connection', 'keep-alive')
  @Header('X-Accel-Buffering', 'no')
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return fromEvent(this.eventEmitter, CHANGE_EVENT).pipe(
      map((event) => {
        console.log('Received event:', event);
        const change = event as ChangeEvent;
        return {
          type: 'change',
          data: change,
        } as MessageEvent;
      }),
    );
  }
}
