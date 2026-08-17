import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { Recurrence } from '../../recurrences/entities/recurrence.entity';
import { Transaction, TransactionType } from '../../transactions/entities/transaction.entity';
import { Category, CategoryKind } from '../entities/category.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(trim)
  name!: string;

  @IsEnum(CategoryKind, { message: 'kind deve ser expense, income ou transfer.' })
  kind!: CategoryKind;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Cor em #RRGGBB.' })
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Orcamento com no maximo 2 casas decimais.' })
  @IsPositive({ message: 'Orcamento precisa ser maior que zero.' })
  monthlyBudget?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(trim)
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Cor em #RRGGBB.' })
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Orcamento com no maximo 2 casas decimais.' })
  @IsPositive({ message: 'Orcamento precisa ser maior que zero.' })
  monthlyBudget?: number | null;
}

export class ArchiveCategoryDto {
  @IsOptional()
  @IsUUID()
  reassignToId?: string;
}

export class DeleteCategoryDto {
  @IsOptional()
  @IsUUID()
  reassignToId?: string | null;
}

export class ListCategoriesQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;
}

export class CategoryResponseDto {
  id!: string;
  name!: string;
  kind!: CategoryKind;
  color!: string | null;
  icon!: string | null;
  parentId!: string | null;
  isDefault!: boolean;
  monthlyBudget!: number | null;
  archivedAt!: string | null;

  static from(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      kind: category.kind,
      color: category.color,
      icon: category.icon,
      parentId: category.parentId,
      isDefault: category.isDefault,
      monthlyBudget: category.monthlyBudget,
      archivedAt: category.archivedAt?.toISOString() ?? null,
    };
  }
}

export class CategoryUsageTransactionDto {
  id!: string;
  description!: string;
  amount!: number;
  currency!: string;
  type!: TransactionType;
  occurredAt!: string;
  categoryId!: string | null;
  categoryName!: string | null;

  static from(transaction: Transaction, categoryName: string | null): CategoryUsageTransactionDto {
    return {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      currency: transaction.currency,
      type: transaction.type,
      occurredAt: transaction.occurredAt.toISOString(),
      categoryId: transaction.categoryId,
      categoryName,
    };
  }
}

export class CategoryUsageRecurrenceDto {
  id!: string;
  description!: string;
  type!: TransactionType;
  categoryId!: string | null;
  categoryName!: string | null;

  static from(recurrence: Recurrence, categoryName: string | null): CategoryUsageRecurrenceDto {
    return {
      id: recurrence.id,
      description: recurrence.description,
      type: recurrence.type,
      categoryId: recurrence.categoryId,
      categoryName,
    };
  }
}

export class CategoryUsageDto {
  categoryIds!: string[];
  children!: CategoryResponseDto[];

  transactionCount!: number;
  recurrenceCount!: number;

  transactions!: CategoryUsageTransactionDto[];
  recurrences!: CategoryUsageRecurrenceDto[];
}
