import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiEnvelope, ApiErrors } from '@ahincho/nova-nestjs';
import { OrdersClient } from '../../upstream/orders/orders.client';
import { CursorQuery } from './dto/cursor.query';
import {
  OrderPageResponse,
  OrderResponse,
  toOrderResponse,
} from './dto/order.response';

/**
 * Los pedidos del cliente que inició sesión. El cliente sale del token y viaja
 * solo a pedidos en `X-Customer-Id`, así que nadie ve los pedidos de otro.
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersClient) {}

  @Get()
  @ApiEnvelope(OrderPageResponse, { description: 'Una página de pedidos' })
  @ApiErrors(400, 401)
  async list(@Query() query: CursorQuery): Promise<OrderPageResponse> {
    const page = await this.orders.list(query.limit, query.cursor);
    return {
      items: page.items.map(toOrderResponse),
      nextCursor: page.nextCursor,
      hasNext: page.hasNext,
    };
  }

  @Get(':id')
  @ApiEnvelope(OrderResponse, { description: 'Un pedido' })
  @ApiErrors(400, 401, 404)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderResponse> {
    return toOrderResponse(await this.orders.find(id));
  }
}
