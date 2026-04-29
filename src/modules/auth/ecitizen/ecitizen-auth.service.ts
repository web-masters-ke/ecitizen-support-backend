import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../config/prisma.service';

const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface ECitizenTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  id_token?: string;
}

interface ECitizenUserInfo {
  id: number;
  id_number: string;
  email: string;
  active: boolean;
  first_name?: string;
  last_name?: string;
  surname?: string;
  account_type: 'citizen' | 'alien' | 'visitor' | 'diplomat';
  mobile_number?: string;
  mobile_verified?: boolean;
  Gender?: string;
  Kra_pin_number?: string;
  dob?: string;
}

@Injectable()
export class ECitizenAuthService {
  private readonly logger = new Logger(ECitizenAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Introspect an eCitizen access token (spec page 7).
   * POSTs to /api/oauth/token/introspect and returns { active, scope, token_type, client_id }.
   * Useful if you want to verify a token before trusting any data derived from it.
   */
  async introspectToken(token: string) {
    const introspectUrl =
      this.config.get<string>('ECITIZEN_INTROSPECT_URL') ||
      'https://accounts.ecitizen.go.ke/api/oauth/token/introspect';
    try {
      const res = await axios.post(
        introspectUrl,
        new URLSearchParams({ token }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10_000,
        },
      );
      return res.data as {
        active: boolean;
        scope?: string | null;
        token_type?: string;
        client_id?: string;
      };
    } catch (err: any) {
      this.logger.warn(`eCitizen introspect failed: ${err?.message}`);
      return { active: false };
    }
  }

  /**
   * Returns the URL the browser should open so the citizen can authorize on eCitizen.
   * The frontend stores the code_verifier (PKCE) and the state, then navigates here.
   */
  buildAuthorizeUrl(opts: {
    state: string;
    codeChallenge: string;
    redirectUri?: string;
  }): string {
    const clientId = this.config.get<string>('ECITIZEN_CLIENT_ID') || '';
    const authorizeUrl =
      this.config.get<string>('ECITIZEN_AUTHORIZE_URL') ||
      'https://accounts.ecitizen.go.ke/oauth/authorize';
    const redirectUri =
      opts.redirectUri ||
      this.config.get<string>('ECITIZEN_REDIRECT_URI') ||
      '';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid',
      state: opts.state,
      code_challenge: opts.codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${authorizeUrl}?${params.toString()}`;
  }

  /**
   * Exchange the OAuth code (received on the redirect URI) for an access token,
   * fetch the user's eCitizen profile, upsert a User in our DB, and issue our own JWTs.
   *
   * @param code           The authorization code returned from eCitizen.
   * @param codeVerifier   PKCE verifier the frontend stored before the redirect.
   * @param redirectUri    Must match the one used in the authorize call.
   * @param meta           IP and user agent for the audit log + session.
   */
  async exchangeAndSignIn(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    meta: { ip?: string; userAgent?: string } = {},
  ) {
    const clientId = this.config.get<string>('ECITIZEN_CLIENT_ID');
    const clientSecret = this.config.get<string>('ECITIZEN_CLIENT_SECRET');
    const tokenUrl =
      this.config.get<string>('ECITIZEN_TOKEN_URL') ||
      'https://accounts.ecitizen.go.ke/oauth/access-token';
    const userInfoUrl =
      this.config.get<string>('ECITIZEN_USER_INFO_URL') ||
      'https://accounts.ecitizen.go.ke/api/user-info';

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'eCitizen OAuth is not configured. Set ECITIZEN_CLIENT_ID and ECITIZEN_CLIENT_SECRET on the backend.',
      );
    }

    // 1. Exchange code for access token (server-to-server)
    let tokenData: ECitizenTokenResponse;
    try {
      const tokenRes = await axios.post(
        tokenUrl,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10_000,
        },
      );
      tokenData = tokenRes.data;
    } catch (err: any) {
      this.logger.warn(`eCitizen token exchange failed: ${err?.message}`);
      throw new BadRequestException(
        'Could not exchange the authorization code with eCitizen',
      );
    }

    if (!tokenData?.access_token) {
      throw new BadRequestException('eCitizen did not return an access token');
    }

    // 2. Fetch user info
    let info: ECitizenUserInfo;
    try {
      const infoRes = await axios.get(userInfoUrl, {
        params: { access_token: tokenData.access_token },
        timeout: 10_000,
      });
      info = infoRes.data;
    } catch (err: any) {
      this.logger.warn(`eCitizen user-info failed: ${err?.message}`);
      throw new BadRequestException('Could not fetch user info from eCitizen');
    }

    if (!info?.id_number || !info?.email) {
      throw new BadRequestException('eCitizen user info is missing required fields');
    }

    // 3. Upsert user in our DB (look up by ecitizenUserId first, then email).
    //    eCitizen-sourced citizens never use a password; we set a random hash so the
    //    column is non-null and email/password login won't match.
    const ecitizenUserId = String(info.id);

    let user = await this.prisma.user.findUnique({
      where: { ecitizenUserId },
      include: { userRoles: { include: { role: true } }, agencyUsers: true },
    });

    if (!user) {
      // Try email next
      user = await this.prisma.user.findUnique({
        where: { email: info.email.toLowerCase() },
        include: { userRoles: { include: { role: true } }, agencyUsers: true },
      });
    }

    if (user) {
      // Existing user — link the eCitizen ID if not already linked, refresh profile data
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ecitizenUserId,
          firstName: info.first_name ?? user.firstName,
          lastName: info.last_name ?? user.lastName,
          phoneNumber: info.mobile_number ?? user.phoneNumber,
          nationalId: info.id_number ?? user.nationalId,
          isVerified: true,
          lastLoginAt: new Date(),
        },
        include: { userRoles: { include: { role: true } }, agencyUsers: true },
      });
    } else {
      // Brand new user — create as CITIZEN
      const placeholderPassword = await bcrypt.hash(
        `ecitizen-sso-${ecitizenUserId}-${Date.now()}`,
        10,
      );
      user = await this.prisma.user.create({
        data: {
          ecitizenUserId,
          email: info.email.toLowerCase(),
          firstName: info.first_name ?? null,
          lastName: info.last_name ?? null,
          phoneNumber: info.mobile_number ?? null,
          nationalId: info.id_number ?? null,
          userType: 'CITIZEN',
          passwordHash: placeholderPassword,
          isActive: true,
          isVerified: true,
          lastLoginAt: new Date(),
        },
        include: { userRoles: { include: { role: true } }, agencyUsers: true },
      });
    }

    // 4. Issue our own JWTs (same shape as email/password login)
    const roles = (user as any).userRoles.map((ur: any) => ur.role.name);
    const agencyId = (user as any).agencyUsers?.[0]?.agencyId || undefined;

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        userType: user.userType,
        roles,
        agencyId,
      },
      { expiresIn: '1h' },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '30d' },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ipAddress: meta.ip || null,
        userAgent: meta.userAgent || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    this.logger.log(
      `eCitizen sign-in success: user ${user.id} (${user.email}, ecitizenUserId=${ecitizenUserId})`,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        nationalId: user.nationalId,
        userType: user.userType,
        ecitizenUserId: user.ecitizenUserId,
        roles,
        agencyId,
      },
    };
  }
}
