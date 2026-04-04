import {
  FindManyOptions,
  FindOneOptions,
  FindOptionsOrder,
  ObjectLiteral,
} from 'typeorm';

/**
 * Generic TypeORM option helpers. No domain knowledge.
 */

export function mergeFindManyOptions<T extends ObjectLiteral>(
  base: FindManyOptions<T>,
  patch: FindManyOptions<T>,
): FindManyOptions<T> {
  return { ...base, ...patch };
}

export function mergeFindOneOptions<T extends ObjectLiteral>(
  base: FindOneOptions<T>,
  patch: FindOneOptions<T>,
): FindOneOptions<T> {
  return { ...base, ...patch };
}

/**
 * Returns new options with `skip` / `take` set (does not mutate input).
 */
export function withFindPagination<T extends ObjectLiteral>(
  options: FindManyOptions<T>,
  skip: number,
  take: number,
): FindManyOptions<T> {
  return { ...options, skip, take };
}

/**
 * Normalizes sort direction from query strings (`asc` / `DESC`, etc.).
 */
export function parseSortDirection(
  raw?: string | null,
): 'ASC' | 'DESC' {
  const u = raw?.trim().toUpperCase();
  return u === 'DESC' ? 'DESC' : 'ASC';
}

/**
 * Single-column `order` object for `FindManyOptions` / `FindOneOptions`.
 */
export function orderByColumn<T extends ObjectLiteral>(
  column: keyof T & string,
  direction: 'ASC' | 'DESC',
): FindOptionsOrder<T> {
  return { [column]: direction } as FindOptionsOrder<T>;
}

/**
 * Clamps `take` to [1, maxTake]; uses `defaultTake` when missing/invalid.
 */
export function clampTake(
  take: number | undefined,
  defaultTake: number,
  maxTake: number,
): number {
  const max = Math.max(1, maxTake);
  const def = Math.min(max, Math.max(1, defaultTake));
  if (take === undefined || !Number.isFinite(take)) {
    return def;
  }
  const n = Math.floor(take);
  if (n < 1) {
    return def;
  }
  return Math.min(max, n);
}
