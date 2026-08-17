import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './entities/user.entity';

const UNIQUE_VIOLATION = '23505';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(input: CreateUserInput, manager?: EntityManager): Promise<User> {
    const repo = manager ? manager.getRepository(User) : this.users;
    const user = repo.create({
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name.trim(),
    });

    try {
      return await repo.save(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('E-mail ja cadastrado.');
      }
      throw error;
    }
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  async getById(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.getById(id);

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.defaultCurrency !== undefined) user.defaultCurrency = dto.defaultCurrency;
    if (dto.timezone !== undefined) user.timezone = dto.timezone;

    return this.users.save(user);
  }

  async updatePassword(id: string, passwordHash: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(User) : this.users;
    await repo.update({ id }, { passwordHash });
  }
}
