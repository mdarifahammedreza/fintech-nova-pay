import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Metadata consumed by a roles guard (`Reflector.getAllAndOverride`).
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
