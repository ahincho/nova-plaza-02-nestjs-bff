import { ApiProperty } from '@nestjs/swagger';
import type { BestSeller } from '../../../upstream/catalog/catalog.client';

/** Un producto del ranking de lo más vendido. */
export class BestSellerResponse {
  @ApiProperty({ example: 'MUG-001' })
  sku!: string;

  @ApiProperty({ example: 'Taza de cerámica' })
  name!: string;

  @ApiProperty({
    example: 12,
    description: 'Unidades vendidas en pedidos confirmados',
  })
  unitsSold!: number;
}

export function toBestSellerResponse(
  bestSeller: BestSeller,
): BestSellerResponse {
  return {
    sku: bestSeller.sku,
    name: bestSeller.name,
    unitsSold: bestSeller.unitsSold,
  };
}
