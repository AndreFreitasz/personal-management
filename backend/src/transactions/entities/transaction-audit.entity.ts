import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AuditAction {
  Created = 'created',
  Updated = 'updated',
  Deleted = 'deleted',
}

@Entity('transaction_audits')
@Index('ix_transaction_audits_transaction', ['transactionId'])
@Index('ix_transaction_audits_user', ['userId', 'createdAt'])
export class TransactionAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 16 })
  action!: AuditAction;

  @Column({ type: 'jsonb' })
  changes!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
