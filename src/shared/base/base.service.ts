import { NotFoundException } from '@nestjs/common'
import { DeepPartial, FindOptionsWhere, ILike, Repository } from 'typeorm'
import { PaginateDto, PaginateRO } from '../dto'
import { MyEntity } from './base.entity'

/**
 * Generic CRUD + pagination service. Extend per module:
 *
 *   @Injectable()
 *   export class UsersService extends MyService<User> {
 *     constructor(@InjectRepository(User) repo: Repository<User>) {
 *       super(repo, ['email', 'username']) // searchable columns
 *     }
 *   }
 */
export abstract class MyService<E extends MyEntity> {
  protected constructor(
    protected readonly repo: Repository<E>,
    /** Columns matched by `?search=` (ILIKE). */
    protected readonly searchableFields: string[] = [],
  ) {}

  create(dto: DeepPartial<E>): Promise<E> {
    return this.repo.save(this.repo.create(dto))
  }

  findAll(): Promise<E[]> {
    return this.repo.find()
  }

  async findOne(id: string): Promise<E> {
    const entity = await this.repo.findOne({ where: { id } as FindOptionsWhere<E> })
    if (!entity) throw new NotFoundException('Resource not found')
    return entity
  }

  async update(id: string, dto: DeepPartial<E>): Promise<E> {
    const entity = await this.findOne(id)
    Object.assign(entity, dto)
    return this.repo.save(entity)
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id)
    await this.repo.remove(entity)
  }

  /** Paginated list with optional ILIKE search across `searchableFields`. */
  async paginate(query: PaginateDto): Promise<PaginateRO<E>> {
    const { page, limit, search, orderBy, order } = query
    const qb = this.repo.createQueryBuilder('e')

    if (search && this.searchableFields.length) {
      this.searchableFields.forEach((field, i) => {
        const param = { [`search${i}`]: `%${search}%` }
        if (i === 0) qb.where(`e.${field} ILIKE :search${i}`, param)
        else qb.orWhere(`e.${field} ILIKE :search${i}`, param)
      })
    }

    qb.orderBy(`e.${orderBy || 'created'}`, order)
      .skip((page - 1) * limit)
      .take(limit)

    const [items, total] = await qb.getManyAndCount()
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  // ILike is exported here so module services can build custom where-clauses without
  // re-importing from typeorm.
  protected ilike = ILike
}
