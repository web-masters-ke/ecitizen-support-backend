import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface BongaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rawResponse?: any;
}

export interface BongaSmsPayload {
  phoneNumber: string; // MSISDN format (e.g. 254712345678)
  message: string;
}

@Injectable()
export class BongaProvider {
  private readonly logger = new Logger(BongaProvider.name);
  private readonly smsUrl: string;
  private readonly clientId: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly serviceId: string;

  constructor(private readonly config: ConfigService) {
    this.smsUrl = this.config.get<string>(
      'BONGA_SMS_URL',
      'https://api.bongasms.co.ke/api/send-sms',
    );
    this.clientId = this.config.get<string>('BONGA_CLIENT_ID', '');
    this.apiKey = this.config.get<string>('BONGA_API_KEY', '');
    this.apiSecret = this.config.get<string>('BONGA_API_SECRET', '');
    this.serviceId = this.config.get<string>('BONGA_SERVICE_ID', '');

    if (!this.clientId || !this.apiKey || !this.apiSecret) {
      this.logger.warn(
        'Bonga SMS credentials are not fully configured. SMS sending will fail.',
      );
    }
  }

  async sendSms(payload: BongaSmsPayload): Promise<BongaSendResult> {
    if (!this.clientId || !this.apiKey || !this.apiSecret) {
      return {
        success: false,
        error: 'Bonga SMS credentials are not configured',
      };
    }

    try {
      const response = await axios.post(
        this.smsUrl,
        {
          apiClientID: this.clientId,
          key: this.apiKey,
          secret: this.apiSecret,
          txtMessage: payload.message,
          MSISDN: payload.phoneNumber,
          serviceID: this.serviceId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 30000,
        },
      );

      // Bonga typically returns a response with status and messageId
      const data = response.data;
      const isSuccess =
        data?.status === 'success' ||
        data?.status === '200' ||
        response.status === 200;

      if (isSuccess) {
        this.logger.log(
          `SMS sent successfully via Bonga to ${payload.phoneNumber}. Response: ${JSON.stringify(data)}`,
        );
        return {
          success: true,
          messageId: data?.messageId || data?.message_id || String(data?.id),
          rawResponse: data,
        };
      }

      this.logger.error(
        `Bonga SMS returned non-success: ${JSON.stringify(data)}`,
      );
      return {
        success: false,
        error: data?.message || JSON.stringify(data),
        rawResponse: data,
      };
    } catch (err) {
      const axiosError = err as AxiosError;
      const errorMessage =
        axiosError.response?.data
          ? JSON.stringify(axiosError.response.data)
          : axiosError.message;

      this.logger.error(`Bonga SMS send failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Normalize a Kenyan phone number to MSISDN format (254XXXXXXXXX).
   */
  static normalizeMsisdn(phone: string): string {
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = '254' + cleaned;
    }
    return cleaned;
  }
}
