import { Module } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';

// Fallback-ul hotspot la boot e gestionat de systemd (smarthome-wifi.service),
// NU de API: PM2 repornește API-ul la orice crash, iar un autoHotspot() aici
// ar putea forța hotspotul peste un WiFi funcțional.
@Module({
  controllers: [SetupController],
  providers:   [SetupService],
  exports:     [SetupService],
})
export class SetupModule {}
