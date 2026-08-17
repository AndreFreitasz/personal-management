import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  user!: UserResponseDto;
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  tokenType = 'Bearer' as const;
}
