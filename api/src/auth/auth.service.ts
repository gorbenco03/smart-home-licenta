import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new UnauthorizedException('Credențiale invalide');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credențiale invalide');

    await this.usersService.updateLastLogin(user.id);

    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    return {
      access_token: token,
      user: { id: user.id, username: user.username },
    };
  }
}
