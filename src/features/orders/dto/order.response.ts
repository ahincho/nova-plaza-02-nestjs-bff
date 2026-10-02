import { ApiProperty } from '@nestjs/swagger';
import type { Order } from '../../../upstream/orders/orders.client';

/** Una línea del pedido, con el precio de la reserva. */
export class OrderItemResponse {
  @ApiProperty({ example: 'MUG-001' })
  sku!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 25.5 })
  unitPrice!: number;
}

/** Un pedido del cliente. */
export class OrderResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['PENDING', 'CONFIRMED', 'CANCELLED'] })
  status!: string;

  @ApiProperty({ example: 'PEN' })
  currency!: string;

  @ApiProperty({ example: 100.9 })
  total!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [OrderItemResponse] })
  items!: OrderItemResponse[];
}

/** Una página de pedidos. */
export class OrderPageResponse {
  @ApiProperty({ type: [OrderResponse] })
  items!: OrderResponse[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasNext!: boolean;
}

export function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    status: order.status,
    currency: order.currency,
    total: order.total,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}
