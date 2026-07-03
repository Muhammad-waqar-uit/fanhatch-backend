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

  /**
   * SIWE find-or-create. Wallet addresses are stored lowercased so lookups are
   * case-insensitive regardless of the EIP-55 checksum the wallet sends.
   * A wallet-only account gets synthetic email/username and an unusable random
   * passwordHash (non-null column) — the user can never log in via password
   * until they set one through a dedicated flow.
   */
  async findOrCreateByWallet(address: string): Promise<User> {
    const walletAddress = address.toLowerCase()
    const existing = await this.users.findOne({ where: { walletAddress } })
    if (existing) return existing

    const short = walletAddress.slice(2, 14)
    const passwordHash = await bcrypt.hash(`siwe:${walletAddress}:${Date.now()}`, 10)
    const user = this.users.create({
      email: `${walletAddress}@wallet.fans.tech`,
      username: `wallet_${short}`,
      passwordHash,
      walletAddress,
    })
    return this.users.save(user)
  }

  async getProfile(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } })
    if (!user) throw new NotFoundException('User not found')
    return user
  }
}
