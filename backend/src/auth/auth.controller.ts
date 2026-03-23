import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('mock-login')
  async mockLogin(@Body('email') email: string) {
    if (!email || email.trim().length === 0) {
      throw new BadRequestException('이메일을 입력해주세요.');
    }
    return this.authService.mockLogin(email.trim());
  }
}
