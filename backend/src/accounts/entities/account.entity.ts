import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/database/base.entity';
import { money } from '../../common/database/numeric.transformer';
import { User } from '../../users/entities/user.entity';

export enum AccountType {
  Checking = 'checking',
  Savings = 'savings',
  CreditCard = 'credit_card',
  Cash = 'cash',
  Investment = 'investment',
}

@Entity('accounts')
@Index('ix_accounts_user', ['userId'])
export class Account extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: AccountType;

  @Column({
    name: 'initial_balance',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: money,
  })
  initialBalance!: number;

  @Column({ name: 'initial_balance_at', type: 'date' })
  initialBalanceAt!: string;

  @Column({ type: 'char', length: 3, default: 'BRL' })
  currency!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  icon!: string | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;
}
