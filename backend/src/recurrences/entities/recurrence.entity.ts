import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { Account } from '../../accounts/entities/account.entity';
import { Category } from '../../categories/entities/category.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { TransactionType } from '../../transactions/entities/transaction.entity';
import { User } from '../../users/entities/user.entity';
import { Adjustment, ScheduleType } from '../recurrence-schedule';

@Entity('recurrences')
@Index('ix_recurrences_user_active', ['userId', 'pausedAt'])
export class Recurrence extends BaseEntity {
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

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'char', length: 3, default: 'BRL' })
  currency!: string;

  @Column({ name: 'schedule_type', type: 'varchar', length: 24 })
  scheduleType!: ScheduleType;

  @Column({ name: 'day_of_month', type: 'smallint', nullable: true })
  dayOfMonth!: number | null;

  @Column({ type: 'varchar', length: 24 })
  adjustment!: Adjustment;

  @Column({ name: 'starts_on', type: 'date' })
  startsOn!: string;

  @Column({ name: 'ends_on', type: 'date', nullable: true })
  endsOn!: string | null;

  @Column({ type: 'smallint', nullable: true })
  installments!: number | null;

  @Column({ name: 'paused_at', type: 'timestamptz', nullable: true })
  pausedAt!: Date | null;
}
