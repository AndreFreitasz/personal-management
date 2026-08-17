import { User } from '../entities/user.entity';

export class UserResponseDto {
  id!: string;
  email!: string;
  name!: string;
  defaultCurrency!: string;
  timezone!: string;
  createdAt!: string;

  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      defaultCurrency: user.defaultCurrency,
      timezone: user.timezone,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
