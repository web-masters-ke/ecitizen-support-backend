import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export interface ValidationPipeOptions {
  /**
   * If true, strips properties that do not have any decorators.
   * Defaults to true.
   */
  whitelist?: boolean;

  /**
   * If true, throws an error when non-whitelisted properties are present.
   * Defaults to true.
   */
  forbidNonWhitelisted?: boolean;

  /**
   * If true, attempts to transform plain objects to class instances.
   * Defaults to true.
   */
  transform?: boolean;

  /**
   * If true, skips validation entirely (useful for testing).
   * Defaults to false.
   */
  disableValidation?: boolean;
}

@Injectable()
export class GlobalValidationPipe implements PipeTransform<unknown> {
  private readonly logger = new Logger(GlobalValidationPipe.name);
  private readonly options: Required<ValidationPipeOptions>;

  constructor(options?: ValidationPipeOptions) {
    this.options = {
      whitelist: options?.whitelist ?? true,
      forbidNonWhitelisted: options?.forbidNonWhitelisted ?? true,
      transform: options?.transform ?? true,
      disableValidation: options?.disableValidation ?? false,
    };
  }

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    if (this.options.disableValidation) {
      return value;
    }

    const { metatype } = metadata;

    // Skip validation for native types and missing metatypes
    if (!metatype || this.isNativeType(metatype)) {
      return value;
    }

    // Transform the plain object into a class instance
    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: true,
    });

    const errors = await validate(object as object, {
      whitelist: this.options.whitelist,
      forbidNonWhitelisted: this.options.forbidNonWhitelisted,
    });

    if (errors.length > 0) {
      const formattedErrors = this.formatErrors(errors);
      this.logger.debug(
        `Validation failed: ${JSON.stringify(formattedErrors)}`,
      );
      throw new BadRequestException({
        message: formattedErrors,
        error: 'Validation Error',
        details: this.buildDetailedErrors(errors),
      });
    }

    // Return the transformed object if transform is enabled
    return this.options.transform ? object : value;
  }

  /**
   * Flatten nested validation errors into a human-readable string array.
   */
  private formatErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        messages.push(...Object.values(error.constraints));
      }
      if (error.children && error.children.length > 0) {
        const childMessages = this.formatErrors(error.children);
        messages.push(
          ...childMessages.map((msg) => `${error.property}.${msg}`),
        );
      }
    }

    return messages;
  }

  /**
   * Build a structured error object mapping field names to their constraint violations.
   */
  private buildDetailedErrors(
    errors: ValidationError[],
    parentPath = '',
  ): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    for (const error of errors) {
      const path = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      if (error.constraints) {
        result[path] = Object.values(error.constraints);
      }

      if (error.children && error.children.length > 0) {
        const childErrors = this.buildDetailedErrors(error.children, path);
        Object.assign(result, childErrors);
      }
    }

    return result;
  }

  /**
   * Check whether a metatype is a native JavaScript type that should not be validated.
   */
  private isNativeType(
    metatype: new (...args: unknown[]) => unknown,
  ): boolean {
    const nativeTypes: Array<new (...args: unknown[]) => unknown> = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return nativeTypes.includes(metatype);
  }
}
