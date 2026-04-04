import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'hit_counter' })
export class HitCounter {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int', default: 0 })
  hits: number;
}
