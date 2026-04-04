import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HitCounter } from './entities/hit-counter.entity';

@Injectable()
export class HitCounterService {
  private static readonly ROW_ID = 1;

  constructor(
    @InjectRepository(HitCounter)
    private readonly writeRepo: Repository<HitCounter>,
    @InjectDataSource('read')
    private readonly readDataSource: DataSource,
  ) {}

  async getHits(): Promise<{ hits: number; source: 'read' }> {
    const repo = this.readDataSource.getRepository(HitCounter);
    const row = await repo.findOne({
      where: { id: HitCounterService.ROW_ID },
    });
    return { hits: row?.hits ?? 0, source: 'read' };
  }

  async incrementHits(): Promise<{ hits: number; source: 'write' }> {
    const rows = await this.writeRepo.query(
      `INSERT INTO hit_counter (id, hits) VALUES ($1, 1)
       ON CONFLICT (id) DO UPDATE SET hits = hit_counter.hits + 1
       RETURNING hits`,
      [HitCounterService.ROW_ID],
    );
    const hits = Number(rows[0]?.hits ?? 0);
    return { hits, source: 'write' };
  }
}
