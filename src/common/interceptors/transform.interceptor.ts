import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((responseData) => {
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
