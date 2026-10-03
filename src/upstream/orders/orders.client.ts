import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { HttpClientService } from '@ahincho/nova-nestjs';
import { forwardBusinessError } from '../../shared/upstream-errors';
import { orders } from './orders.config';

/** Un pedido, como lo devuelve el servicio de pedidos. */
export type Order = {
  readonly id: string;
  readonly customerId: string;
  readonly status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  readonly currency: string;
  readonly total: number;
  readonly reservationId: string;
  readonly createdAt: string;
  readonly items: readonly {
    readonly sku: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
};

/** Lo que pedidos necesita para crear un pedido: la reserva y sus precios. */
export type NewOrder = {
  readonly reservationId: string;
  readonly currency: string;
  readonly items: readonly {
    readonly sku: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
};

export type OrdersPage = {
  readonly items: readonly Order[];
  readonly nextCursor: string | null;
  readonly hasNext: boolean;
};

type Envelope<T> = { readonly data: T };

/** Los pedidos de Plaza, en Spring Boot. */
@Injectable()
export class OrdersClient {
  constructor(
    private readonly http: HttpClientService,
    @Inject(orders.KEY)
    private readonly config: ConfigType<typeof orders>,
  ) {}

  /**
   * Crea el pedido con la misma `Idempotency-Key` de la compra: repetir la
   * compra devuelve el mismo pedido, y nunca crea un segundo (ADR-047).
   */
  async place(idempotencyKey: string, order: NewOrder): Promise<Order> {
    return this.call(() =>
      this.http.post<Envelope<Order>>(`${this.config.url}/v1/orders`, order, {
        ...this.options(),
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    );
  }

  async confirm(id: string): Promise<Order> {
    return this.call(() =>
      this.http.post<Envelope<Order>>(
        `${this.config.url}/v1/orders/${id}/confirm`,
        undefined,
        this.options(),
      ),
    );
  }

  async cancel(id: string): Promise<Order> {
    return this.call(() =>
      this.http.post<Envelope<Order>>(
        `${this.config.url}/v1/orders/${id}/cancel`,
        undefined,
        this.options(),
      ),
    );
  }

  async list(limit?: number, cursor?: string): Promise<OrdersPage> {
    return this.call(() =>
      this.http.get<Envelope<OrdersPage>>(`${this.config.url}/v1/orders`, {
        query: { limit, cursor },
        ...this.options(),
      }),
    );
  }

  async find(id: string): Promise<Order> {
    return this.call(() =>
      this.http.get<Envelope<Order>>(
        `${this.config.url}/v1/orders/${encodeURIComponent(id)}`,
        this.options(),
      ),
    );
  }

  private options() {
    return { timeoutMs: this.config.timeoutMs, forwardError: true };
  }

  private async call<T>(request: () => Promise<Envelope<T>>): Promise<T> {
    try {
      return (await request()).data;
    } catch (error) {
      return forwardBusinessError(error);
    }
  }
}
