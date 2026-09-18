import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class PositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[1-9]\d*$/.test(value)) {
      throw new BadRequestException(
        'Validation failed (positive integer is expected)',
      );
    }

    const parsedValue = Number(value);

    if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
      throw new BadRequestException(
        'Validation failed (positive integer is expected)',
      );
    }

    return parsedValue;
  }
}
