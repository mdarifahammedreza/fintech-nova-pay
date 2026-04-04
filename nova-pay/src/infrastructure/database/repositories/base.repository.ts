import {
  DeepPartial,
  DeleteResult,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  InsertResult,
  ObjectLiteral,
  Repository,
  UpdateResult,
} from 'typeorm';

/**
 * Generic persistence helpers only. No business rules.
 * Module repositories extend this and pass `Repository<T>` from Nest.
 */
export abstract class BaseRepository<T extends ObjectLiteral> {
  protected constructor(
    protected readonly repository: Repository<T>,
  ) {}

  /** Direct access when a raw TypeORM API is required (use sparingly). */
  protected get repo(): Repository<T> {
    return this.repository;
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  async findOneBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<T | null> {
    return this.repository.findOneBy(where);
  }

  async findBy(where: FindOptionsWhere<T>): Promise<T[]> {
    return this.repository.findBy(where);
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  async findAndCount(
    options?: FindManyOptions<T>,
  ): Promise<[T[], number]> {
    return this.repository.findAndCount(options);
  }

  async countBy(where: FindOptionsWhere<T>): Promise<number> {
    return this.repository.countBy(where);
  }

  async existsBy(where: FindOptionsWhere<T>): Promise<boolean> {
    return this.repository.existsBy(where);
  }

  async save(entity: DeepPartial<T>): Promise<T> {
    return this.repository.save(entity);
  }

  async saveMany(entities: DeepPartial<T>[]): Promise<T[]> {
    return this.repository.save(entities);
  }

  async insert(entity: DeepPartial<T>): Promise<InsertResult> {
    return this.repository.insert(entity as never);
  }

  async update(
    criteria: FindOptionsWhere<T>,
    partial: DeepPartial<T>,
  ): Promise<UpdateResult> {
    return this.repository.update(criteria, partial as never);
  }

  async delete(criteria: FindOptionsWhere<T>): Promise<DeleteResult> {
    return this.repository.delete(criteria);
  }

}
