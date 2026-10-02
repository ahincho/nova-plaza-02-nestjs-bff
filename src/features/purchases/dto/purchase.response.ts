import { ApiProperty } from '@nestjs/swagger';
import type { Purchase } from '../port/in/place-purchase.use-case';

export class PurchaseItemResponse {
  @ApiProperty({ example: 'MUG-001' })
  sku!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 25.5 })
  unitPrice!: number;
}

/** La compra terminada: el pedido confirmado y su pago. */
export class PurchaseResponse {
  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty({ format: 'uuid' })
  paymentId!: string;

  @ApiProperty({ example: 'CONFIRMED' })
  status!: string;

  @ApiProperty({ example: 'PEN' })
  currency!: string;

  @ApiProperty({ example: 100.9 })
  total!: number;

  @ApiProperty({ type: [PurchaseItemResponse] })
  items!: PurchaseItemResponse[];
}

export function toPurchaseResponse(purchase: Purchase): PurchaseResponse {
  return {
    orderId: purchase.orderId,
    paymentId: purchase.paymentId,
    status: purchase.status,
    currency: purchase.currency,
    total: purchase.total,
    items: purchase.items.map((item) => ({ ...item })),
  };
}
