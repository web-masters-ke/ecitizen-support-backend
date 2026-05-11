import { SetMetadata } from '@nestjs/common';

// Marks a route as opting out of the global TransformInterceptor's
// { success, data, meta, timestamp } envelope. Use it for routes that
// stream binary data or write the response directly via @Res.
export const SKIP_RESPONSE_TRANSFORM_KEY = 'skipResponseTransform';
export const SkipResponseTransform = () =>
  SetMetadata(SKIP_RESPONSE_TRANSFORM_KEY, true);
