import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/database/base.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Recurrence } from './recurrence.entity';

@Entity('generated_transactions')
@Index('uq_generated_transactions_slot', ['recurrenceId', 'competence'], { unique: true })
export class GeneratedTransaction extends BaseEntity {
  @Column({ name: 'recurrence_id', type: 'uuid' })
  recurrenceId!: string;

  @ManyToOne(() => Recurrence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recurrence_id' })
  recurrence!: Recurrence;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId!: string | null;

  @ManyToOne(() => Transaction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Transaction | null;

  @Column({ type: 'date' })
  competence!: string;
}
