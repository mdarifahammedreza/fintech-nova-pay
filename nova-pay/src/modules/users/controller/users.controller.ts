import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { isEmail } from 'class-validator';
import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { GetUserByEmailHandler } from '../query/handlers/get-user-by-email.handler';
import { GetUserByIdHandler } from '../query/handlers/get-user-by-id.handler';
import { GetUserByEmailQuery } from '../query/impl/get-user-by-email.query';
import { GetUserByIdQuery } from '../query/impl/get-user-by-id.query';

/** API shape without `password` (defined here for Swagger only). */
export class UserPublicResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

function toPublicUser(user: User): UserPublicResponseDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Read-only admin-oriented HTTP surface. No login/register/refresh here.
 * TODO: `JwtAuthGuard` + `RolesGuard` (e.g. ADMIN) when auth infra is wired.
 */
@Controller('users')
@ApiTags('users')
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly getUserByIdHandler: GetUserByIdHandler,
    private readonly getUserByEmailHandler: GetUserByEmailHandler,
  ) {}

  @Get('lookup/by-email')
  @ApiOperation({ summary: 'Get user by email (admin)' })
  @ApiQuery({ name: 'email', required: true })
  @ApiOkResponse({ type: UserPublicResponseDto })
  async getByEmail(
    @Query('email') email?: string,
  ): Promise<UserPublicResponseDto> {
    const v = email?.trim();
    if (!v) {
      throw new BadRequestException('email is required');
    }
    if (!isEmail(v)) {
      throw new BadRequestException('email must be valid');
    }
    const user = await this.getUserByEmailHandler.execute(
      new GetUserByEmailQuery(v),
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toPublicUser(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserPublicResponseDto })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserPublicResponseDto> {
    const user = await this.getUserByIdHandler.execute(
      new GetUserByIdQuery(id),
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toPublicUser(user);
  }
}
