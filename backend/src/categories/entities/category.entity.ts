import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/database/base.entity';
import { money } from '../../common/database/numeric.transformer';
import { User } from '../../users/entities/user.entity';

export enum CategoryKind {
  Expense = 'expense',
  Income = 'income',
  Transfer = 'transfer',
}

@Entity('categories')
@Index('ix_categories_user', ['userId'])
export class Category extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: CategoryKind;

  @Column({ type: 'char', length: 7, nullable: true })
  color!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  icon!: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: Category | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({
    name: 'monthly_budget',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: money,
  })
  monthlyBudget!: number | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;
}
