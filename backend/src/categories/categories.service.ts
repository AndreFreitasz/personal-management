import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';

import { Recurrence } from '../recurrences/entities/recurrence.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import {
  ArchiveCategoryDto,
  CategoryResponseDto,
  CategoryUsageDto,
  CategoryUsageRecurrenceDto,
  CategoryUsageTransactionDto,
  CreateCategoryDto,
  DeleteCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';
import { Category, CategoryKind } from './entities/category.entity';

const USAGE_SAMPLE = 50;

export const DEFAULT_CATEGORIES: ReadonlyArray<{
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
}> = [
  { name: 'Alimentação', kind: CategoryKind.Expense, color: '#C4362F', icon: 'utensils' },
  { name: 'Transporte', kind: CategoryKind.Expense, color: '#E0A21A', icon: 'bus' },
  { name: 'Moradia', kind: CategoryKind.Expense, color: '#2E7D5B', icon: 'home' },
  { name: 'Lazer', kind: CategoryKind.Expense, color: '#6E4C9A', icon: 'sparkles' },
  { name: 'Investimento', kind: CategoryKind.Expense, color: '#1F6FB2', icon: 'piggy-bank' },
  { name: 'Salário', kind: CategoryKind.Income, color: '#00875A', icon: 'wallet' },
];

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Recurrence)
    private readonly recurrences: Repository<Recurrence>,
    private readonly dataSource: DataSource,
  ) {}

  async seedDefaults(userId: string, manager: EntityManager): Promise<Category[]> {
    const repo = manager.getRepository(Category);
    return repo.save(
      DEFAULT_CATEGORIES.map((seed) =>
        repo.create({
          userId,
          name: seed.name,
          kind: seed.kind,
          color: seed.color,
          icon: seed.icon,
          isDefault: true,
          parentId: null,
          monthlyBudget: null,
          archivedAt: null,
        }),
      ),
    );
  }

  async list(userId: string, includeArchived = false): Promise<Category[]> {
    return this.categories.find({
      where: includeArchived ? { userId } : { userId, archivedAt: IsNull() },
      order: { parentId: { direction: 'ASC', nulls: 'FIRST' }, name: 'ASC' },
    });
  }

  async getOwned(userId: string, id: string): Promise<Category> {
    const category = await this.categories.findOne({ where: { id, userId } });
    if (!category) {
      throw new NotFoundException('Categoria nao encontrada.');
    }
    return category;
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    let parent: Category | null = null;

    if (dto.parentId) {
      parent = await this.getOwned(userId, dto.parentId);

      if (parent.parentId !== null) {
        throw new BadRequestException('Subcategoria aceita apenas um nivel de profundidade.');
      }
      if (parent.archivedAt !== null) {
        throw new BadRequestException('Nao e possivel criar subcategoria em categoria arquivada.');
      }
      if (parent.kind !== dto.kind) {
        throw new BadRequestException(
          `Subcategoria precisa ter o mesmo tipo do pai (${parent.kind}).`,
        );
      }
    }

    await this.assertNameIsFree(userId, dto.name, dto.parentId ?? null);

    return this.categories.save(
      this.categories.create({
        userId,
        name: dto.name,
        kind: dto.kind,
        color: dto.color ?? null,
        icon: dto.icon ?? null,
        parentId: dto.parentId ?? null,
        monthlyBudget: dto.monthlyBudget ?? null,
        isDefault: false,
        archivedAt: null,
      }),
    );
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.getOwned(userId, id);

    if (dto.name !== undefined && dto.name !== category.name) {
      await this.assertNameIsFree(userId, dto.name, category.parentId, id);
      category.name = dto.name;
    }
    if (dto.color !== undefined) category.color = dto.color;
    if (dto.icon !== undefined) category.icon = dto.icon;
    if (dto.monthlyBudget !== undefined) category.monthlyBudget = dto.monthlyBudget;

    return this.categories.save(category);
  }

  async archive(userId: string, id: string, dto: ArchiveCategoryDto): Promise<Category> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Category);
      const category = await repo.findOne({ where: { id, userId } });

      if (!category) {
        throw new NotFoundException('Categoria nao encontrada.');
      }
      if (category.archivedAt !== null) {
        throw new ConflictException('Categoria ja arquivada.');
      }

      const children = await repo.find({ where: { userId, parentId: id, archivedAt: IsNull() } });
      const affectedIds = [category.id, ...children.map((c) => c.id)];

      const transactions = manager.getRepository(Transaction);
      const inUse = await transactions.countBy({ userId, categoryId: In(affectedIds) });

      if (inUse > 0) {
        if (!dto.reassignToId) {
          throw new BadRequestException(
            `Categoria tem ${inUse} lancamento(s). Informe reassignToId para realoca-los.`,
          );
        }

        const destination = await repo.findOne({ where: { id: dto.reassignToId, userId } });

        if (!destination) {
          throw new BadRequestException('Categoria de destino nao encontrada.');
        }
        if (affectedIds.includes(destination.id)) {
          throw new BadRequestException(
            'A categoria de destino nao pode ser a que esta sendo arquivada.',
          );
        }
        if (destination.archivedAt !== null) {
          throw new BadRequestException('A categoria de destino esta arquivada.');
        }
        if (destination.kind !== category.kind) {
          throw new BadRequestException(
            `A categoria de destino precisa ser do tipo ${category.kind}.`,
          );
        }

        await transactions.update(
          { userId, categoryId: In(affectedIds) },
          { categoryId: destination.id },
        );
      }

      const now = new Date();
      await repo.update({ userId, id: In(affectedIds), archivedAt: IsNull() }, { archivedAt: now });

      category.archivedAt = now;
      return category;
    });
  }

  async usage(userId: string, id: string): Promise<CategoryUsageDto> {
    const category = await this.getOwned(userId, id);
    const children = await this.categories.find({
      where: { userId, parentId: id },
      order: { name: 'ASC' },
    });

    const affectedIds = [category.id, ...children.map((c) => c.id)];
    const nameOf = new Map([category, ...children].map((c) => [c.id, c.name]));

    const [transactions, transactionCount] = await this.transactions.findAndCount({
      where: { userId, categoryId: In(affectedIds) },
      order: { occurredAt: 'DESC', id: 'DESC' },
      take: USAGE_SAMPLE,
    });

    const [recurrences, recurrenceCount] = await this.recurrences.findAndCount({
      where: { userId, categoryId: In(affectedIds) },
      order: { description: 'ASC' },
      take: USAGE_SAMPLE,
    });

    return {
      categoryIds: affectedIds,
      children: children.map((child) => CategoryResponseDto.from(child)),
      transactionCount,
      recurrenceCount,
      transactions: transactions.map((t) =>
        CategoryUsageTransactionDto.from(t, nameOf.get(t.categoryId ?? '') ?? null),
      ),
      recurrences: recurrences.map((r) =>
        CategoryUsageRecurrenceDto.from(r, nameOf.get(r.categoryId ?? '') ?? null),
      ),
    };
  }

  async remove(userId: string, id: string, dto: DeleteCategoryDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Category);
      const category = await repo.findOne({ where: { id, userId } });

      if (!category) {
        throw new NotFoundException('Categoria nao encontrada.');
      }

      const children = await repo.find({ where: { userId, parentId: id } });
      const affectedIds = [category.id, ...children.map((c) => c.id)];

      const transactions = manager.getRepository(Transaction);
      const recurrences = manager.getRepository(Recurrence);
      const scope = { userId, categoryId: In(affectedIds) };

      const [inUse, recurring] = await Promise.all([
        transactions.countBy(scope),
        recurrences.countBy(scope),
      ]);

      if (inUse > 0 || recurring > 0) {
        if (dto.reassignToId === undefined) {
          throw new ConflictException(
            `Categoria tem ${inUse} lancamento(s) e ${recurring} recorrencia(s). ` +
              'Informe reassignToId para realoca-los, ou null para deixa-los sem categoria.',
          );
        }

        if (dto.reassignToId === null) {
          await transactions.update(scope, {
            categoryId: null,
            classificationSource: null,
            classifiedAt: null,
          });
          await recurrences.update(scope, { categoryId: null });
        } else {
          const destination = await repo.findOne({ where: { id: dto.reassignToId, userId } });

          if (!destination) {
            throw new BadRequestException('Categoria de destino nao encontrada.');
          }
          if (affectedIds.includes(destination.id)) {
            throw new BadRequestException(
              'A categoria de destino nao pode ser a que esta sendo excluida.',
            );
          }
          if (destination.archivedAt !== null) {
            throw new BadRequestException('A categoria de destino esta arquivada.');
          }
          if (destination.kind !== category.kind) {
            throw new BadRequestException(
              `A categoria de destino precisa ser do tipo ${category.kind}.`,
            );
          }

          await transactions.update(scope, { categoryId: destination.id });
          await recurrences.update(scope, { categoryId: destination.id });
        }
      }

      if (children.length > 0) {
        await repo.delete({ userId, id: In(children.map((c) => c.id)) });
      }
      await repo.delete({ userId, id: category.id });
    });
  }

  private async assertNameIsFree(
    userId: string,
    name: string,
    parentId: string | null,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.categories.findOne({
      where: {
        userId,
        name,
        parentId: parentId === null ? IsNull() : parentId,
        archivedAt: IsNull(),
        ...(exceptId ? { id: Not(exceptId) } : {}),
      },
    });

    if (clash) {
      throw new ConflictException('Ja existe uma categoria ativa com esse nome nesse nivel.');
    }
  }
}
