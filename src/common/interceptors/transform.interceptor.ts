import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_RESPONSE_TRANSFORM_KEY } from '../decorators/skip-response-transform.decorator';

export interface ResponseMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  [key: string]: unknown;
}

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  meta: ResponseMeta | null;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  constructor(private readonly reflector?: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const skip = this.reflector?.getAllAndOverride<boolean>(
      SKIP_RESPONSE_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((responseData) => {
        // Defensive: if the controller writes the response directly (@Res())
        // we receive undefined or a Buffer — never try to wrap that.
        if (
          responseData === undefined ||
          Buffer.isBuffer(responseData) ||
          (typeof responseData === 'object' &&
            responseData !== null &&
            (responseData as { pipe?: unknown }).pipe instanceof Function)
        ) {
          return responseData as unknown as StandardResponse<T>;
        }
        // If the controller already returned a shaped object with data + meta,
        // extract them. Otherwise treat the whole response as data.
        let data: T;
        let meta: ResponseMeta | null = null;

        if (
          responseData &&
          typeof responseData === 'object' &&
          'data' in responseData &&
          'meta' in responseData
        ) {
          data = responseData.data;
          meta = responseData.meta;
        } else {
          data = responseData;
        }

        const serialized = JSON.parse(
          JSON.stringify(
            { success: true, data, meta, timestamp: new Date().toISOString() },
            (_key, value) =>
              typeof value === 'bigint' ? Number(value) : value,
          ),
        );
        return serialized;
      }),
    );
  }
}
