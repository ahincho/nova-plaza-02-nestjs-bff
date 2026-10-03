import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { HttpClientService } from '@ahincho/nova-nestjs';
import { forwardBusinessError } from '../../shared/upstream-errors';
import { audit } from './audit.config';

/** Un evento de la historia de un pedido, como lo guardó la auditoría. */
export type OrderEvent = {
  readonly id: string;
  readonly type: string;
  readonly time: string;
  readonly traceparent: string | null;
  readonly data: Record<string, unknown>;
};

type Envelope<T> = { readonly data: T };

/**
 * La auditoría de Plaza, en Spring Boot. No sabe de quién es un pedido: el BFF
 * lo comprueba contra pedidos antes de llamarla.
 */
@Injectable()
export class AuditClient {
  constructor(
    private readonly http: HttpClientService,
    @Inject(audit.KEY)
    private readonly config: ConfigType<typeof audit>,
  ) {}

  async history(orderId: string): Promise<OrderEvent[]> {
    try {
      const response = await this.http.get<Envelope<OrderEvent[]>>(
        `${this.config.url}/v1/orders/${encodeURIComponent(orderId)}/events`,
        { timeoutMs: this.config.timeoutMs, forwardError: true },
      );
      return response.data;
    } catch (error) {
      return forwardBusinessError(error);
    }
  }
}
