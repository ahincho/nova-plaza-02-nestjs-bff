import { ApiProperty } from '@nestjs/swagger';
import type { OrderEvent } from '../../../upstream/audit/audit.client';

/** Un evento de la historia de un pedido. */
export class OrderEventResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'pe.edu.nova.plaza.order.confirmed.v1' })
  type!: string;

  @ApiProperty({ format: 'date-time' })
  time!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'La traza en que pasó, para buscarla en Grafana',
  })
  traceparent!: string | null;

  @ApiProperty({ type: Object, description: 'El payload del evento' })
  data!: Record<string, unknown>;
}

export function toOrderEventResponse(event: OrderEvent): OrderEventResponse {
  return {
    id: event.id,
    type: event.type,
    time: event.time,
    traceparent: event.traceparent,
    data: event.data,
  };
}
