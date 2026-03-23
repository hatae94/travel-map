import { Injectable, OnModuleInit, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';

export interface JwtPayload {
  sub: string;
  email: string;
  nickname: string;
}

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private readonly jwtService: JwtService) {}

  onModuleInit() {
    this.pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'travel_map',
      user: process.env.PGUSER || 'travel',
      password: process.env.PGPASSWORD || 'travel',
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async mockLogin(email: string): Promise<{ access_token: string }> {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.nickname, u.email
       FROM users u
       JOIN user_auth_providers p ON u.id = p.user_id
       WHERE p.provider = 'email' AND p.provider_uid = $1`,
      [email],
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('등록되지 않은 이메일입니다.');
    }

    const user = rows[0];
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      nickname: user.nickname,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
