import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../common/database/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'default_currency', type: 'char', length: 3, default: 'BRL' })
  defaultCurrency!: string;

  @Column({ type: 'varchar', length: 64, default: 'America/Sao_Paulo' })
  timezone!: string;
}
