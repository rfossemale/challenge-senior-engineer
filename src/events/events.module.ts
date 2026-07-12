import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { ChangePublisher } from './events.publisher';

@Module({
  controllers: [EventsController],
  providers: [ChangePublisher],
  exports: [ChangePublisher],
})
export class EventsModule {}
