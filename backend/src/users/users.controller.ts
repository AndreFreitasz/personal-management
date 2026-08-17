import { Body, Controller, Get, Patch } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.users.getById(userId));
  }

  @Patch('me')
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.users.updateProfile(userId, dto));
  }
}
