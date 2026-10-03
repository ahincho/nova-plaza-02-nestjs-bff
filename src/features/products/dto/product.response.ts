import { ApiProperty } from '@nestjs/swagger';
import type { CatalogProduct } from '../../../upstream/catalog/catalog.client';

/** Un producto, como lo ve quien compra. */
export class ProductResponse {
  @ApiProperty({ example: 'MUG-001' })
  sku!: string;

  @ApiProperty({ example: 'Taza de cerámica' })
  name!: string;

  @ApiProperty({ example: 25.5 })
  price!: number;

  @ApiProperty({ example: 'PEN' })
  currency!: string;

  @ApiProperty({ example: 100, description: 'Lo que se puede reservar ahora' })
  available!: number;
}

/** Una página de productos. */
export class ProductPageResponse {
  @ApiProperty({ type: [ProductResponse] })
  items!: ProductResponse[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasNext!: boolean;
}

export function toProductResponse(product: CatalogProduct): ProductResponse {
  return {
    sku: product.sku,
    name: product.name,
    price: product.price,
    currency: product.currency,
    available: product.available,
  };
}
