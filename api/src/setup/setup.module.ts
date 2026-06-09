import { Module, OnModuleInit } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  controllers: [SetupController],
  providers:   [SetupService],
  exports:     [SetupService],
})
export class SetupModule implements OnModuleInit {
  constructor(private setupService: SetupService) {}

  onModuleInit() {
    // Auto-hotspot la pornire (non-blocking)
    this.setupService.autoHotspot().catch(() => {});
  }
}
