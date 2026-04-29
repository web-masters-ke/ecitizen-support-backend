import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class ECitizenAuthorizeUrlDto {
  @ApiProperty({ description: 'Random opaque string returned to the callback unchanged' })
  @IsString()
  state!: string;

  @ApiProperty({ description: 'PKCE code challenge (base64url(SHA-256(verifier)))' })
  @IsString()
  codeChallenge!: string;

  @ApiPropertyOptional({
    description:
      'Override the redirect_uri (must be one registered with eCitizen). Defaults to ECITIZEN_REDIRECT_URI from env.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectUri?: string;
}

export class ECitizenExchangeDto {
  @ApiProperty({ description: 'Authorization code returned by eCitizen on the redirect URI' })
  @IsString()
  code!: string;

  @ApiProperty({ description: 'PKCE code verifier the frontend stored before the redirect' })
  @IsString()
  codeVerifier!: string;

  @ApiProperty({ description: 'Redirect URI used in the authorize call (must match)' })
  @IsUrl({ require_tld: false })
  redirectUri!: string;
}
