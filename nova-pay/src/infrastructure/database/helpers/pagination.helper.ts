/**
 * Generic pagination math for repositories and query handlers.
 * No domain rules.
 */

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export type PaginationSlice = {
  page: number;
  limit: number;
  skip: number;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type NormalizePaginationInput = {
  defaultLimit?: number;
  maxLimit?: number;
};

function toPositiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const n =
    typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }
  return Math.floor(n);
}

/**
 * 1-based `page`, bounded `limit`, and derived `skip`.
 */
export function normalizePagination(
  page?: unknown,
  limit?: unknown,
  input?: NormalizePaginationInput,
): PaginationSlice {
  const defaultLimit =
    input?.defaultLimit ?? PAGINATION_DEFAULT_LIMIT;
  const maxLimit = input?.maxLimit ?? PAGINATION_MAX_LIMIT;
  const safeDefault = Math.min(
    PAGINATION_MAX_LIMIT,
    Math.max(1, defaultLimit),
  );
  const safeMax = Math.min(PAGINATION_MAX_LIMIT, Math.max(1, maxLimit));

  const p = toPositiveInt(page, 1);
  const rawLimit = toPositiveInt(limit, safeDefault);
  const lim = Math.min(safeMax, Math.max(1, rawLimit));
  const skip = (p - 1) * lim;
  return { page: p, limit: lim, skip };
}

export function totalPages(total: number, limit: number): number {
  if (limit < 1) {
    return 0;
  }
  return Math.ceil(total / limit);
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const pages = totalPages(total, limit);
  return {
    total,
    page,
    limit,
    totalPages: pages,
    hasNextPage: page < pages,
    hasPreviousPage: page > 1,
  };
}
