import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Single-row indexer cursor. `id` is pinned to 1; `lastBlock` is the last fully
 * indexed block (numeric → stringified, bigint-safe). Null before the first sync.
 */
@Entity('indexer_state')
export class IndexerState {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number

  @Column({ type: 'numeric', nullable: true })
  lastBlock: string | null
}
