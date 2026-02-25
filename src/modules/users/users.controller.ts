import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateMyProfileDto,
  AssignRolesDto,
  ToggleUserStatusDto,
  UserFilterDto,
} from './dto/users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ──────────────────────────────────────────────
  // GET /api/v1/users
  // ──────────────────────────────────────────────

  @Get()
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({
    summary: 'List users (paginated)',
    description:
      'Returns a paginated list of users. Supports filtering by agencyId, userType, isActive, isVerified, and free-text search.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(@Query() filters: UserFilterDto) {
    return this.usersService.findAll(filters);
  }

  // ──────────────────────────────────────────────
  // GET /api/v1/users/:id
  // ──────────────────────────────────────────────

  @Get(':id')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({
    summary: 'Get user by ID',
    description:
      'Returns a single user with their roles, permissions, and agency associations.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // ──────────────────────────────────────────────
  // POST /api/v1/users
  // ──────────────────────────────────────────────

  @Post()
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Admin endpoint to create a user account. Optionally assigns agency and roles at creation.',
  })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Duplicate email or eCitizen ID' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.usersService.create(dto, currentUserId);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/v1/users/me  — self-profile update (any authenticated user)
  // Must be defined BEFORE :id to avoid route shadowing.
  // ──────────────────────────────────────────────

  @Patch('me')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT', 'CITIZEN', 'BUSINESS')
  @ApiOperation({
    summary: 'Update own profile',
    description: 'Allows any authenticated user to update their own firstName, lastName, phoneNumber, and nationalId.',
  })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateMe(
    @CurrentUser('sub') currentUserId: string,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMyProfile(currentUserId, dto);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/v1/users/:id
  // ──────────────────────────────────────────────

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user profile information. Partial updates supported.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email conflict' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/v1/users/:id/roles
  // ──────────────────────────────────────────────

  @Patch(':id/roles')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({
    summary: 'Assign roles to user',
    description:
      'Replace the user\'s roles within the given agency scope. Existing roles in that scope are removed and replaced.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Roles assigned' })
  @ApiResponse({ status: 400, description: 'Invalid role IDs' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.usersService.assignRoles(id, dto, currentUserId);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/v1/users/:id/status
  // ──────────────────────────────────────────────

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({
    summary: 'Toggle user active/inactive',
    description: 'Activate or deactivate a user account.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleUserStatusDto,
  ) {
    return this.usersService.toggleStatus(id, dto.isActive);
  }

  // ──────────────────────────────────────────────
  // DELETE /api/v1/users/:id
  // ──────────────────────────────────────────────

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete user',
    description:
      'Marks a user as deleted (sets deletedAt timestamp and deactivates). Data is preserved for audit purposes.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }
}
