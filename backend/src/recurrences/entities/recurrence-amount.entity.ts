import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/database/base.entity';
import { money } from '../../common/database/numeric.transformer';
import { Recurrence } from './recurrence.entity';

@Entity('recurrence_amounts')
@Index('uq_recurrence_amounts_period', ['recurrenceId', 'validFrom'], { unique: true })
export class RecurrenceAmount extends BaseEntity {
  @Column({ name: 'recurrence_id', type: 'uuid' })
  recurrenceId!: string;

  @ManyToOne(() => Recurrence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recurrence_id' })
  recurrence!: Recurrence;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: money })
  amount!: number;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom!: string;
}
