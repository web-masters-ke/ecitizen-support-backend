import { Controller, Post, Body, Headers, HttpCode, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from '../kafka/kafka.service';
import { KAFKA_TOPICS } from '../kafka/kafka.topics';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Email Ingest')
@Controller('email-ingest')
export class EmailIngestController {
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly kafkaService: KafkaService,
  ) {
    this.webhookSecret = this.config.get<string>('BREVO_INBOUND_SECRET', '');
  }

  // Brevo / Mailgun / Postmark / SendGrid inbound webhook
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-secret') headerSecret?: string,
  ) {
    if (this.webhookSecret && headerSecret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    // Brevo inbound: From is an object { Name, Address }
    const brevoFrom = body['From'] as { Name?: string; Address?: string } | undefined;
    const isBrevo = brevoFrom && typeof brevoFrom === 'object' && 'Address' in brevoFrom;

    const from: string = isBrevo
      ? (brevoFrom?.Address ?? '')
      : ((body['from'] as string) ?? (body['sender'] as string) ?? '');

    const fromName: string = isBrevo
      ? (brevoFrom?.Name ?? '')
      : ((body['fromName'] as string) ?? (body['from_name'] as string) ?? '');

    const subject: string =
      (body['Subject'] as string) ?? (body['subject'] as string) ?? '';

    // Brevo sends RawTextBody; others send body-plain / text / TextBody
    const bodyText: string =
      (body['RawTextBody'] as string) ??
      (body['body-plain'] as string) ??
      (body['text'] as string) ??
      (body['TextBody'] as string) ??
      (body['plain'] as string) ?? '';

    const messageId: string =
      (body['MessageId'] as string) ??
      (body['Message-Id'] as string) ??
      (body['MessageID'] as string) ?? '';

    if (!from || !subject) return { status: 'ignored', reason: 'Missing from or subject' };

    await this.kafkaService.publish({
      topic: KAFKA_TOPICS.EMAIL_INGEST,
      key: from,
      value: { from, fromName, subject, bodyText, messageId },
    });

    return { status: 'queued' };
  }
}
