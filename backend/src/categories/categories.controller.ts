import {
  Body,
  Controller,
  Delete,
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
import { CategoriesService } from './categories.service';
import {
  ArchiveCategoryDto,
  CategoryResponseDto,
  CategoryUsageDto,
  CreateCategoryDto,
  DeleteCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListCategoriesQueryDto,
  ): Promise<CategoryResponseDto[]> {
    const found = await this.categories.list(userId, query.includeArchived ?? false);
    return found.map((category) => CategoryResponseDto.from(category));
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return CategoryResponseDto.from(await this.categories.create(userId, dto));
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return CategoryResponseDto.from(await this.categories.update(userId, id, dto));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArchiveCategoryDto,
  ): Promise<CategoryResponseDto> {
    return CategoryResponseDto.from(await this.categories.archive(userId, id, dto));
  }

  @Get(':id/usage')
  async usage(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryUsageDto> {
    return this.categories.usage(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteCategoryDto,
  ): Promise<void> {
    await this.categories.remove(userId, id, dto);
  }
}
