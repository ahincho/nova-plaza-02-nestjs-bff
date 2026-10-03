import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { HttpClientService } from '@ahincho/nova-nestjs';
import { forwardBusinessError } from '../../shared/upstream-errors';
import { payments } from './payments.config';

/** Un pago simulado. */
export type Payment = {
  readonly id: string;
  readonly orderId: string;
  readonly status: 'AUTHORIZED' | 'REFUNDED';
  readonly amount: number;
  readonly currency: string;
};

type Envelope<T> = { readonly data: T };

/** Los pagos de Plaza, en NestJS. */
@Injectable()
export class PaymentsClient {
  constructor(
    private readonly http: HttpClientService,
    @Inject(payments.KEY)
    private readonly config: ConfigType<typeof payments>,
  ) {}

  /**
   * Cobra el pedido. Un pedido tiene un solo pago, así que repetir el cobro
   * devuelve el mismo: es lo que deja repetir la compra sin cobrar dos veces.
   */
  async authorize(charge: {
    orderId: string;
    amount: number;
    currency: string;
  }): Promise<Payment> {
    return this.call(() =>
      this.http.post<Envelope<Payment>>(
        `${this.config.url}/v1/payments`,
        charge,
        this.options(),
      ),
    );
  }

  async refund(id: string): Promise<Payment> {
    return this.call(() =>
      this.http.post<Envelope<Payment>>(
        `${this.config.url}/v1/payments/${id}/refund`,
        undefined,
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
