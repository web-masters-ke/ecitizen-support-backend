import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../config/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationChannelDto } from '../notifications/dto/notifications.dto';
import {
  RegisterDto,
  LoginDto,
  RefreshDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h in milliseconds

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ============================================
  // REGISTER
  // ============================================
  async register(dto: RegisterDto, ip?: string, userAgent?: string) {
    // Check if email is already taken
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Find or verify the CITIZEN role exists
    let citizenRole = await this.prisma.role.findUnique({
      where: { name: 'CITIZEN' },
    });

    if (!citizenRole) {
      // Auto-create the CITIZEN system role if it does not exist yet
      citizenRole = await this.prisma.role.create({
        data: {
          name: 'CITIZEN',
          description: 'Default role for citizen users',
          isSystemRole: true,
        },
      });
    }

    // Create the user and assign the CITIZEN role in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phoneNumber: dto.phoneNumber,
          nationalId: dto.nationalId,
          userType: 'CITIZEN',
          isActive: true,
          isVerified: false,
        },
      });

      // Assign CITIZEN role
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: citizenRole.id,
        },
      });

      return newUser;
    });

    // Log the registration attempt
    await this.logAuthAttempt({
      userId: user.id,
      emailAttempted: dto.email,
      success: true,
      ip,
      userAgent,
    });

    this.logger.log(`New citizen registered: ${user.email} (${user.id})`);

    // Send welcome email (fire-and-forget, don't block registration response)
    const appName = this.configService.get<string>('APP_NAME', 'eCitizen SCC');
    const clientUrl = this.configService.get<string>('CLIENT_URL', 'http://localhost:3001');
    this.notificationsService.sendNotification({
      channel: NotificationChannelDto.EMAIL,
      subject: `Welcome to ${appName}`,
      body: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <h2 style="color:#1a1a2e">Welcome to ${appName}, ${user.firstName}!</h2>
          <p style="color:#555;line-height:1.6">
            Your account has been created successfully. You can now access government services
            and submit service requests.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${clientUrl}/login"
               style="background:#E87722;color:#fff;padding:14px 32px;border-radius:8px;
                      text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
              Get Started
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin-top:24px">
          <p style="color:#bbb;font-size:11px;text-align:center">&copy; ${new Date().getFullYear()} ${appName}</p>
        </div>
      `,
      recipients: [{ recipientEmail: user.email }],
      triggerEvent: 'REGISTRATION',
    }).catch((err) => this.logger.error(`Welcome email failed for ${user.email}: ${err}`));

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }

  // ============================================
  // LOGIN
  // ============================================
  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const email = dto.email.toLowerCase().trim();

    // Find the user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        agencyUsers: {
          where: { employmentStatus: 'active' },
          select: { agencyId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      await this.logAuthAttempt({
        emailAttempted: email,
        success: false,
        failureReason: 'User not found',
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      await this.logAuthAttempt({
        userId: user.id,
        emailAttempted: email,
        success: false,
        failureReason: 'Account deactivated',
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Your account has been deactivated. Please contact support.');
    }

    if (user.deletedAt) {
      await this.logAuthAttempt({
        userId: user.id,
        emailAttempted: email,
        success: false,
        failureReason: 'Account deleted',
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      await this.logAuthAttempt({
        userId: user.id,
        emailAttempted: email,
        success: false,
        failureReason: 'No password set (external auth user)',
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.logAuthAttempt({
        userId: user.id,
        emailAttempted: email,
        success: false,
        failureReason: 'Invalid password',
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Extract roles and permissions
    const roles = user.userRoles.map((ur) => ur.role.name);
    const agencyId = user.agencyUsers[0]?.agencyId || undefined;

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens({
      sub: user.id,
      email: user.email,
      userType: user.userType,
      roles,
      agencyId,
    });

    // Hash the refresh token and store as a session
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ipAddress: ip || null,
        userAgent: userAgent || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log the successful login
    await this.logAuthAttempt({
      userId: user.id,
      emailAttempted: email,
      success: true,
      ip,
      userAgent,
    });

    this.logger.log(`User logged in: ${user.email} (${user.id})`);

    // Build permissions list
    const permissions = this.extractPermissions(user.userRoles);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        isVerified: user.isVerified,
        roles,
        permissions,
        agencyId,
      },
    };
  }

  // ============================================
  // REFRESH TOKEN
  // ============================================
  async refresh(dto: RefreshDto, ip?: string, userAgent?: string) {
    // Decode the refresh token (without verification -- we verify via hash lookup)
    let decoded: any;
    try {
      decoded = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'ecitizen-scc-refresh-secret',
        ),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = decoded.sub;

    // Find all active (non-revoked, non-expired) sessions for this user
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    // Find the matching session by comparing the refresh token hash
    let matchedSession: typeof sessions[0] | null = null;
    for (const session of sessions) {
      const isMatch = await bcrypt.compare(dto.refreshToken, session.refreshTokenHash);
      if (isMatch) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      // Possible token reuse attack -- revoke ALL sessions for this user
      this.logger.warn(
        `Refresh token reuse detected for user ${userId}. Revoking all sessions.`,
      );
      await this.prisma.session.updateMany({
        where: { userId },
        data: { revoked: true },
      });

      await this.logAuthAttempt({
        userId,
        success: false,
        failureReason: 'Refresh token reuse detected -- all sessions revoked',
        ip,
        userAgent,
      });

      throw new UnauthorizedException(
        'Refresh token has been revoked. Please log in again.',
      );
    }

    // Revoke the old session (rotation)
    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { revoked: true },
    });

    // Fetch the user with roles for the new token
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        agencyUsers: {
          where: { employmentStatus: 'active' },
          select: { agencyId: true },
          take: 1,
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User account is no longer active');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const agencyId = user.agencyUsers[0]?.agencyId || undefined;

    // Generate new token pair
    const { accessToken, refreshToken: newRefreshToken } =
      await this.generateTokens({
        sub: user.id,
        email: user.email,
        userType: user.userType,
        roles,
        agencyId,
      });

    // Store the new refresh token hash
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: newRefreshTokenHash,
        ipAddress: ip || null,
        userAgent: userAgent || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    this.logger.log(`Token refreshed for user: ${user.email}`);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ============================================
  // LOGOUT
  // ============================================
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      // Revoke only the session matching this specific refresh token
      const sessions = await this.prisma.session.findMany({
        where: {
          userId,
          revoked: false,
        },
      });

      for (const session of sessions) {
        const isMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
        if (isMatch) {
          await this.prisma.session.update({
            where: { id: session.id },
            data: { revoked: true },
          });
          break;
        }
      }
    } else {
      // Revoke all sessions for this user
      await this.prisma.session.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
    }

    this.logger.log(`User logged out: ${userId}`);

    return { message: 'Successfully logged out' };
  }

  // ============================================
  // ME (Current User Profile)
  // ============================================
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        ecitizenUserId: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        nationalId: true,
        userType: true,
        isActive: true,
        isVerified: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        agencyUsers: {
          where: { employmentStatus: 'active' },
          include: {
            agency: {
              select: {
                id: true,
                agencyCode: true,
                agencyName: true,
                agencyType: true,
              },
            },
            department: {
              select: {
                id: true,
                departmentName: true,
                departmentCode: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build roles and permissions
    const roles = user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
    }));

    const permissions = this.extractPermissions(user.userRoles);

    // Build agency info
    const agencies = user.agencyUsers.map((au) => ({
      agencyId: au.agency.id,
      agencyCode: au.agency.agencyCode,
      agencyName: au.agency.agencyName,
      agencyType: au.agency.agencyType,
      department: au.department
        ? {
            id: au.department.id,
            name: au.department.departmentName,
            code: au.department.departmentCode,
          }
        : null,
    }));

    return {
      id: user.id,
      ecitizenUserId: user.ecitizenUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      nationalId: user.nationalId,
      userType: user.userType,
      isActive: user.isActive,
      isVerified: user.isVerified,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles,
      permissions,
      agencies,
    };
  }

  // ============================================
  // FORGOT PASSWORD
  // ============================================
  async forgotPassword(dto: ForgotPasswordDto, ip?: string) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      this.logger.log(`Forgot password requested for non-existent email: ${email}`);
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Invalidate any existing unused tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });

    // Generate a reset token
    const rawToken = uuidv4();
    const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    this.logger.log(
      `Password reset token generated for ${email} (expires: ${expiresAt.toISOString()})`,
    );

    // Send the password-reset email via Brevo
    const appName = this.configService.get<string>('APP_NAME', 'eCitizen SCC');
    const clientUrl = this.configService.get<string>('CLIENT_URL', 'http://localhost:3001');
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#1a1a2e;margin-bottom:8px">${appName}</h2>
        <h3 style="color:#333;font-weight:600;margin-bottom:16px">Reset Your Password</h3>
        <p style="color:#555;line-height:1.6">
          We received a request to reset the password for your account associated with
          <strong>${email}</strong>.
        </p>
        <p style="color:#555;line-height:1.6">
          Click the button below to reset your password. This link expires in <strong>1 hour</strong>.
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${resetUrl}"
             style="background:#E87722;color:#fff;padding:14px 32px;border-radius:8px;
                    text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
            Reset Password
          </a>
        </div>
        <p style="color:#888;font-size:13px;line-height:1.6">
          Or copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color:#E87722;word-break:break-all">${resetUrl}</a>
        </p>
        <p style="color:#aaa;font-size:12px;margin-top:32px">
          If you did not request a password reset, please ignore this email. Your account is secure.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px">
        <p style="color:#bbb;font-size:11px;text-align:center">&copy; ${new Date().getFullYear()} ${appName}</p>
      </div>
    `;

    const textContent = `Reset Your Password\n\nWe received a request to reset the password for ${email}.\n\nReset link (expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;

    try {
      await this.notificationsService.sendNotification({
        channel: NotificationChannelDto.EMAIL,
        subject: `Reset your ${appName} password`,
        body: htmlContent,
        recipients: [{ recipientEmail: user.email }],
        triggerEvent: 'PASSWORD_RESET',
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (emailErr) {
      // Do not fail the request if email sending fails — token is still valid
      this.logger.error(`Failed to send password reset email to ${email}: ${emailErr}`);
    }

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
      // Include token only in development for testing purposes
      ...(this.configService.get('NODE_ENV') === 'development' && {
        _devToken: rawToken,
      }),
    };
  }

  // ============================================
  // RESET PASSWORD
  // ============================================
  async resetPassword(dto: ResetPasswordDto, ip?: string, userAgent?: string) {
    // Find all non-expired, unused tokens
    const resetTokens = await this.prisma.passwordResetToken.findMany({
      where: {
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, email: true, isActive: true },
        },
      },
    });

    // Find the matching token by comparing hashes
    let matchedToken: typeof resetTokens[0] | null = null;
    for (const token of resetTokens) {
      const isMatch = await bcrypt.compare(dto.token, token.tokenHash);
      if (isMatch) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!matchedToken.user.isActive) {
      throw new BadRequestException('User account is deactivated');
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    // Update the password and mark the token as used in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: matchedToken.user.id },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: matchedToken.id },
        data: { used: true },
      });

      // Revoke all existing sessions (force re-login)
      await tx.session.updateMany({
        where: { userId: matchedToken.user.id, revoked: false },
        data: { revoked: true },
      });
    });

    // Log the password reset
    await this.logAuthAttempt({
      userId: matchedToken.user.id,
      emailAttempted: matchedToken.user.email,
      success: true,
      failureReason: null,
      ip,
      userAgent,
    });

    this.logger.log(`Password reset successful for user: ${matchedToken.user.email}`);

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Generate an access token + refresh token pair.
   */
  private async generateTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(
      {
        sub: payload.sub,
        email: payload.email,
        userType: payload.userType,
        roles: payload.roles,
        agencyId: payload.agencyId,
      },
      {
        secret: this.configService.get<string>(
          'JWT_SECRET',
          'ecitizen-scc-jwt-secret',
        ),
        expiresIn: ACCESS_TOKEN_EXPIRY,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: payload.sub,
        type: 'refresh',
      },
      {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'ecitizen-scc-refresh-secret',
        ),
        expiresIn: '24h',
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Extract a unique list of permission strings from user roles.
   */
  private extractPermissions(
    userRoles: Array<{
      role: {
        rolePermissions?: Array<{
          permission: { resource: string; action: string };
        }>;
      };
    }>,
  ): string[] {
    const permissionSet = new Set<string>();

    for (const ur of userRoles) {
      if (ur.role.rolePermissions) {
        for (const rp of ur.role.rolePermissions) {
          permissionSet.add(`${rp.permission.resource}:${rp.permission.action}`);
        }
      }
    }

    return Array.from(permissionSet).sort();
  }

  /**
   * Log an authentication attempt to the authentication_logs table.
   */
  private async logAuthAttempt(params: {
    userId?: string;
    emailAttempted?: string;
    success: boolean;
    failureReason?: string | null;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.authenticationLog.create({
        data: {
          userId: params.userId || null,
          emailAttempted: params.emailAttempted || null,
          success: params.success,
          failureReason: params.failureReason || null,
          ipAddress: params.ip || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (error) {
      // Don't let logging failures break the auth flow
      this.logger.error('Failed to log authentication attempt', error);
    }
  }
}
