import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(username: string, email: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.repo.create({ username, email, passwordHash });
    return this.repo.save(user);
  }

  async exists(): Promise<boolean> {
    const count = await this.repo.count();
    return count > 0;
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.repo.update(id, { lastLogin: new Date() });
  }
}
