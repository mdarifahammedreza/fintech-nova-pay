import { Injectable } from '@nestjs/common';
import {
  FindManyOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

export type PageRequest = {
  page: number;
  limit: number;
};

export type PageMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PageResult<T> = {
  items: T[];
  meta: PageMeta;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class PaginationRepository {
  /**
   * Normalizes page/limit (1-based page, capped limit).
   */
  normalize(req: PageRequest): { page: number; limit: number; skip: number } {
    const page = Number.isFinite(req.page) && req.page > 0
      ? Math.floor(req.page)
      : 1;
    const raw = Number.isFinite(req.limit) && req.limit > 0
      ? Math.floor(req.limit)
      : DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, raw));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  buildMeta(total: number, page: number, limit: number): PageMeta {
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    return {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * `find` + `count` via repository (simple filters).
   */
  async paginate<T extends ObjectLiteral>(
    repository: Repository<T>,
    where: FindOptionsWhere<T>,
    req: PageRequest,
    extra?: Omit<FindManyOptions<T>, 'skip' | 'take' | 'where'>,
  ): Promise<PageResult<T>> {
    const { page, limit, skip } = this.normalize(req);
    const [items, total] = await repository.findAndCount({
      ...extra,
      where,
      skip,
      take: limit,
    });
    return { items, meta: this.buildMeta(total, page, limit) };
  }

  /**
   * Query builder: count on a clone without skip/take, then page the original.
   */
  async paginateQueryBuilder<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    req: PageRequest,
  ): Promise<PageResult<T>> {
    const { page, limit, skip } = this.normalize(req);
    const total = await qb.clone().getCount();
    const items = await qb.clone().skip(skip).take(limit).getMany();
    return { items, meta: this.buildMeta(total, page, limit) };
  }
}
