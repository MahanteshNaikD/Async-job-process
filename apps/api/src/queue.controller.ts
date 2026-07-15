import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  QueueActionRequestDto,
  QueueActionResponseDto,
  QueueStatusDto,
} from '@app/queue/dto/queue-action.dto';
import { QueueControlService } from '@app/queue';
import {
  ApiPauseQueue,
  ApiQueueController,
  ApiQueueStatus,
  ApiResumeQueue,
} from './swagger/queue.swagger';

@ApiQueueController()
@Controller({ path: 'queue', version: '1' })
export class QueueController {
  constructor(private readonly queueControl: QueueControlService) {}

  @Get('status')
  @ApiQueueStatus()
  async status(): Promise<QueueStatusDto> {
    const [paused, counts] = await Promise.all([
      this.queueControl.isPaused(),
      this.queueControl.getCounts(),
    ]);
    return { paused, counts };
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiPauseQueue()
  async pause(
    @Body() body: QueueActionRequestDto,
  ): Promise<QueueActionResponseDto> {
    await this.queueControl.pause(body?.reason);
    return { status: 'paused', reason: body?.reason ?? null };
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiResumeQueue()
  async resume(
    @Body() body: QueueActionRequestDto,
  ): Promise<QueueActionResponseDto> {
    await this.queueControl.resume(body?.reason);
    return { status: 'resumed', reason: body?.reason ?? null };
  }
}
