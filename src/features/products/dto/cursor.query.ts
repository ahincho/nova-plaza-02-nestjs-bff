import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * El scroll por cursor de ADR-054, el mismo que en el catálogo y en pedidos: el
 * BFF lo valida antes de llamar, así que un límite fuera de rango es un 400 sin
 * salir del BFF.
 */
export class CursorQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'El nextCursor de la página anterior' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
