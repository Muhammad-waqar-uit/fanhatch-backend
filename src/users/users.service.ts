import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcryptjs'
import { Repository } from 'typeorm'
import { MyService } from '@app/shared/base'
import { CreateUserDto } from './dto'
import { User } from './user.entity'

@Injectable()
export class UsersService extends MyService<User> {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {
    super(users, ['email', 'username']) // searchable columns
  }

  /** Registration helper — hashes the password and enforces unique email/username. */
  async createWithPassword(dto: CreateUserDto): Promise<User> {
    const exists = await this.users.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    })
    if (exists) throw new ConflictException('Email or username already in use')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = this.users.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
    })
    return this.users.save(user)
  }

  /** Includes passwordHash (normally select:false) for credential checks. */
  findByEmailWithSecret(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne()
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash)
  }

  async getProfile(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } })
    if (!user) throw new NotFoundException('User not found')
    return user
  }
}
