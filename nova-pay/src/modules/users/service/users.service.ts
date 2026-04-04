import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, scryptSync } from 'node:crypto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

const SALT_BYTES = 16;
const SCRYPT_KEYLEN = 64;

function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(plain, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * User lifecycle and profile persistence. Uses {@link UserRepository} only.
 * No JWT/session logic — auth module can call these methods after validating
 * tokens separately.
 */
@Injectable()
export class UsersService {
  constructor(private readonly users: UserRepository) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    if (await this.users.existsByEmail(dto.email)) {
      throw new ConflictException('Email already registered');
    }
    return this.users.save({
      fullName: dto.fullName,
      email: dto.email,
      password: hashPassword(dto.password),
      role: dto.role,
      isActive: dto.isActive ?? true,
    });
  }

  /** Returns null if missing — callers (e.g. auth) decide how to respond. */
  getUserById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  getUserByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  /**
   * Loads by id or throws {@link NotFoundException}.
   */
  async requireUserById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Applies profile / status / credential updates. Password is re-hashed
   * when `password` is present in `dto`.
   */
  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.requireUserById(id);
    if (dto.email !== undefined && dto.email !== user.email) {
      if (await this.users.existsByEmail(dto.email)) {
        throw new ConflictException('Email already registered');
      }
    }
    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName;
    }
    if (dto.email !== undefined) {
      user.email = dto.email;
    }
    if (dto.password !== undefined) {
      user.password = hashPassword(dto.password);
    }
    if (dto.role !== undefined) {
      user.role = dto.role;
    }
    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }
    return this.users.save(user);
  }
}
