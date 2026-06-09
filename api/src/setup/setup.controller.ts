import { Controller, Get, Post, Body } from '@nestjs/common';
import { SetupService } from './setup.service';

@Controller('api/setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

  @Get('status')
  getStatus() {
    return this.setupService.getStatus();
  }

  @Get('networks')
  scanNetworks() {
    return this.setupService.scanNetworks();
  }

  @Post('connect')
  connectToNetwork(@Body() body: { ssid: string; password: string }) {
    return this.setupService.connectToNetwork(body.ssid, body.password);
  }

  @Post('hotspot')
  startHotspot() {
    return this.setupService.startHotspot();
  }
}
