import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** Un producto y cuántas unidades. El precio no viaja: lo pone el catálogo. */
export class PurchaseItemRequest {
  @ApiProperty({ example: 'MUG-001' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

/** El carrito, que vive en el cliente y llega entero al comprar (ADR-043). */
export class PurchaseRequest {
  @ApiProperty({ type: [PurchaseItemRequest] })
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemRequest)
  @ArrayMinSize(1)
  items!: PurchaseItemRequest[];
}
