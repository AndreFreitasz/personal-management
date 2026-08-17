import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AdjustAmountDto,
  CreateRecurrenceDto,
  ListRecurrencesQueryDto,
  OccurrenceDto,
  PauseRecurrenceDto,
  RecurrenceResponseDto,
  UpdateRecurrenceDto,
} from './dto/recurrence.dto';
import { RecurrencesService } from './recurrences.service';

@Controller('recurrences')
export class RecurrencesController {
  constructor(private readonly recurrences: RecurrencesService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListRecurrencesQueryDto,
  ): Promise<RecurrenceResponseDto[]> {
    const found = await this.recurrences.list(userId, query.includePaused ?? false);
    const ids = found.map((recurrence) => recurrence.id);

    const [amounts, counts] = await Promise.all([
      this.recurrences.currentAmounts(ids),
      this.recurrences.materializedCounts(ids),
    ]);

    return found.map((recurrence) =>
      RecurrenceResponseDto.from(
        recurrence,
        amounts.get(recurrence.id) ?? 0,
        counts.get(recurrence.id) ?? 0,
      ),
    );
  }

  @Get(':id')
  async get(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecurrenceResponseDto> {
    const recurrence = await this.recurrences.getOwned(userId, id);
    return this.present(recurrence.id, userId);
  }

  @Get(':id/preview')
  async preview(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OccurrenceDto[]> {
    return this.recurrences.preview(userId, id);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRecurrenceDto,
  ): Promise<RecurrenceResponseDto> {
    const recurrence = await this.recurrences.create(userId, dto);
    return this.present(recurrence.id, userId);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurrenceDto,
  ): Promise<RecurrenceResponseDto> {
    await this.recurrences.update(userId, id, dto);
    return this.present(id, userId);
  }

  @Post(':id/pause')
  async pause(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PauseRecurrenceDto,
  ): Promise<RecurrenceResponseDto> {
    await this.recurrences.setPaused(userId, id, dto.paused ?? true);
    return this.present(id, userId);
  }

  @Post(':id/adjust')
  async adjust(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustAmountDto,
  ): Promise<RecurrenceResponseDto> {
    await this.recurrences.adjustAmount(userId, id, dto);
    return this.present(id, userId);
  }

  @Post(':id/backfill')
  @HttpCode(HttpStatus.OK)
  async backfill(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ created: number }> {
    return { created: await this.recurrences.backfill(userId, id) };
  }

  private async present(id: string, userId: string): Promise<RecurrenceResponseDto> {
    const recurrence = await this.recurrences.getOwned(userId, id);
    const [amounts, counts] = await Promise.all([
      this.recurrences.currentAmounts([id]),
      this.recurrences.materializedCounts([id]),
    ]);

    return RecurrenceResponseDto.from(recurrence, amounts.get(id) ?? 0, counts.get(id) ?? 0);
  }
}
