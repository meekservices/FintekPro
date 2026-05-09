import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { TreasuryCopilotService } from './treasury-copilot.service';

@Controller('ai/copilot')
export class TreasuryCopilotController {
  constructor(private readonly copilotService: TreasuryCopilotService) {}

  @Post('query')
  async ask(@Body() body: { entityId: string; query: string }) {
    return this.copilotService.handleQuery(body.entityId, body.query);
  }
}
