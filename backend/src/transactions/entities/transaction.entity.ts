import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { Account } from '../../accounts/entities/account.entity';
import { Category } from '../../categories/entities/category.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { money } from '../../common/database/numeric.transformer';
import { User } from '../../users/entities/user.entity';

export enum TransactionType {
  Credit = 'credit',
  Debit = 'debit',
  Transfer = 'transfer',
}

export enum TransactionStatus {
  Pending = 'pending',
  Paid = 'paid',
}

export enum ClassificationSource {
  Rule = 'rule',
  Cache = 'cache',
  Llm = 'llm',
  Manual = 'manual',
}

@Entity('transactions')
@Index('ix_transactions_user_occurred', ['userId', 'occurredAt', 'id'])
@Index('ix_transactions_user_category_competence', ['userId', 'categoryId', 'competence'])
export class Transaction extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ name: 'destination_account_id', type: 'uuid', nullable: true })
  destinationAccountId!: string | null;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'destination_account_id' })
  destinationAccount!: Account | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category!: Category | null;

  @Column({ type: 'varchar', length: 16 })
  type!: TransactionType;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: money })
  amount!: number;

  @Column({ type: 'char', length: 3, default: 'BRL' })
  currency!: string;

  @Column({ type: 'varchar', length: 16, default: TransactionStatus.Paid })
  status!: TransactionStatus;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'date' })
  competence!: string;

  @Column({ name: 'classification_source', type: 'varchar', length: 16, nullable: true })
  classificationSource!: ClassificationSource | null;

  @Column({ name: 'classified_at', type: 'timestamptz', nullable: true })
  classifiedAt!: Date | null;
}
