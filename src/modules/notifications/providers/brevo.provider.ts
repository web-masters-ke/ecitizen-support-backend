import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface BrevoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BrevoEmailPayload {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: { email: string; name?: string };
  tags?: string[];
}

@Injectable()
export class BrevoProvider {
  private readonly logger = new Logger(BrevoProvider.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('BREVO_API_KEY', '');
    this.fromEmail = this.config.get<string>(
      'BREVO_FROM_EMAIL',
      'noreply@ecitizen.go.ke',
    );
    this.fromName = this.config.get<string>(
      'BREVO_FROM_NAME',
      'eCitizen Service Command Center',
    );

    if (!this.apiKey) {
      this.logger.warn(
        'BREVO_API_KEY is not configured. Email sending will fail.',
      );
    }
  }

  async sendEmail(payload: BrevoEmailPayload): Promise<BrevoSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'BREVO_API_KEY is not configured',
      };
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          sender: {
            name: this.fromName,
            email: this.fromEmail,
          },
          to: payload.to,
          subject: payload.subject,
          htmlContent: payload.htmlContent,
          textContent: payload.textContent,
          replyTo: payload.replyTo,
          tags: payload.tags,
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 30000,
        },
      );

      const messageId = response.data?.messageId;
      this.logger.log(
        `Email sent successfully via Brevo. MessageId: ${messageId}`,
      );

      return {
        success: true,
        messageId,
      };
    } catch (err) {
      const axiosError = err as AxiosError;
      const errorMessage =
        axiosError.response?.data
          ? JSON.stringify(axiosError.response.data)
          : axiosError.message;

      this.logger.error(`Brevo email send failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
