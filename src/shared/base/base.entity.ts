import { BaseEntity, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * Base for all entities: uuid primary key + created/updated timestamps.
 * Extend this in every `*.entity.ts` so the table shape stays consistent.
 */
export abstract class MyEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @CreateDateColumn()
  created: Date

  @UpdateDateColumn()
  updated: Date

  /** Override to strip sensitive fields before serializing. */
  toResponseObject(): Record<string, unknown> {
    return { ...this } as Record<string, unknown>
  }
}
