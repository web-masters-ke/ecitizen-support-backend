import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { ECitizenAuthService } from './ecitizen-auth.service';
import {
  ECitizenAuthorizeUrlDto,
  ECitizenExchangeDto,
  ECitizenIntrospectDto,
} from './ecitizen-auth.dto';

@ApiTags('Auth — eCitizen SSO')
@Controller('auth/ecitizen')
export class ECitizenAuthController {
  constructor(private readonly service: ECitizenAuthService) {}

  /**
   * Returns the eCitizen authorize URL the browser should navigate to.
   * Frontend generates the PKCE pair and the random state, sends both here, and
   * we return the full URL with the right query string.
   */
  @Get('authorize-url')
  @Public()
  @ApiOperation({
    summary: 'Build the eCitizen authorize URL with PKCE',
    description:
      'Frontend generates a code_verifier + code_challenge (S256) and a random state. POSTs them here. Returns the URL to navigate to.',
  })
  authorizeUrl(@Query() q: ECitizenAuthorizeUrlDto) {
    const url = this.service.buildAuthorizeUrl({
      state: q.state,
      codeChallenge: q.codeChallenge,
      redirectUri: q.redirectUri,
    });
    return { url };
  }

  /**
   * Exchange the OAuth code for our own JWT. Called by the callback page.
   */
  @Post('exchange')
  @Public()
  @ApiOperation({ summary: 'Exchange eCitizen authorization code for our JWT' })
  @ApiResponse({ status: 200, description: 'Authenticated' })
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() body: ECitizenExchangeDto, @Req() req: Request) {
    return this.service.exchangeAndSignIn(
      body.code,
      body.codeVerifier,
      body.redirectUri,
      {
        ip: (req.ip || (req.headers['x-forwarded-for'] as string)) ?? undefined,
        userAgent: req.headers['user-agent'] ?? undefined,
      },
    );
  }

  /**
   * Introspect an eCitizen access token (spec page 7). Optional. We do not use
   * this in the sign-in flow because we issue our own JWT after exchange and
   * discard the eCitizen access token. Exposed for completeness and for any
   * future code path that needs to verify a token at runtime.
   */
  @Post('introspect')
  @Public()
  @ApiOperation({ summary: 'Introspect an eCitizen access token' })
  @ApiResponse({ status: 200, description: 'Returns { active, scope, token_type, client_id }' })
  @HttpCode(HttpStatus.OK)
  async introspect(@Body() body: ECitizenIntrospectDto) {
    return this.service.introspectToken(body.token);
  }
}
