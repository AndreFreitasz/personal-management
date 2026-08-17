import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import {
  BalanceSeriesResponseDto,
  ByAccountResponseDto,
  ByCategoryResponseDto,
  DashboardQueryDto,
  DayQueryDto,
  DayResponseDto,
  MonthlyComparisonResponseDto,
  ProjectionResponseDto,
  SummaryResponseDto,
  TopMerchantsResponseDto,
} from './dto/dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(
    @CurrentUser('id') userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<SummaryResponseDto> {
    return this.dashboard.summary(userId, query);
  }

  @Get('by-category')
  byCategory(
    @CurrentUser('id') userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<ByCategoryResponseDto> {
    return this.dashboard.byCategory(userId, query);
  }

  @Get('by-account')
  byAccount(
    @CurrentUser('id') userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<ByAccountResponseDto> {
    return this.dashboard.byAccount(userId, query);
  }

  @Get('balance-series')
  balanceSeries(
    @CurrentUser('id') userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<BalanceSeriesResponseDto> {
    return this.dashboard.balanceSeries(userId, query);
  }

  @Get('day')
  day(@CurrentUser('id') userId: string, @Query() query: DayQueryDto): Promise<DayResponseDto> {
    return this.dashboard.day(userId, query);
  }

  @Get('monthly-comparison')
  monthlyComparison(
    @CurrentUser('id') userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<MonthlyComparisonResponseDto> {
    return this.dashboard.monthlyComparison(userId, query);
  }

  @Get('top-merchants')
  topMerchants(
    @CurrentUser('id') userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<TopMerchantsResponseDto> {
    return this.dashboard.topMerchants(userId, query);
  }

  @Get('projection')
  projection(
    @CurrentUser('id') userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<ProjectionResponseDto> {
    return this.dashboard.projection(userId, query);
  }
}
