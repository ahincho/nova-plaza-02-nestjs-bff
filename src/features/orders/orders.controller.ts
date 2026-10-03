import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiEnvelope, ApiErrors } from '@ahincho/nova-nestjs';
import { AuditClient } from '../../upstream/audit/audit.client';
import { OrdersClient } from '../../upstream/orders/orders.client';
import { CursorQuery } from './dto/cursor.query';
import {
  OrderEventResponse,
  toOrderEventResponse,
} from './dto/order-event.response';
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
  constructor(
    private readonly orders: OrdersClient,
    private readonly audit: AuditClient,
  ) {}

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

  /**
   * Los eventos del pedido, de la auditoría. Primero se busca el pedido en
   * pedidos, con el cliente del token: el de otro cliente es un 404 y su
   * historia nunca se pide.
   */
  @Get(':id/history')
  @ApiEnvelope(OrderEventResponse, {
    isArray: true,
    description: 'La historia del pedido, del evento más viejo al más nuevo',
  })
  @ApiErrors(400, 401, 404)
  async history(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderEventResponse[]> {
    await this.orders.find(id);
    const events = await this.audit.history(id);
    return events.map(toOrderEventResponse);
  }
}
