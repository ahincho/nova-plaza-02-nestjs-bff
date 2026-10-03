import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { HttpClientService } from '@ahincho/nova-nestjs';
import { forwardBusinessError } from '../../shared/upstream-errors';
import { catalog } from './catalog.config';

/** Un producto del catálogo, con lo que se puede reservar ahora. */
export type CatalogProduct = {
  readonly sku: string;
  readonly name: string;
  readonly price: number;
  readonly currency: string;
  readonly available: number;
};

/** Una página por cursor, el mismo contrato en los tres servicios (ADR-054). */
export type CatalogPage<T> = {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasNext: boolean;
};

/** Un producto del ranking de lo más vendido. */
export type BestSeller = {
  readonly sku: string;
  readonly name: string;
  readonly unitsSold: number;
};

/** El stock apartado para una compra, con los precios del momento. */
export type Reservation = {
  readonly id: string;
  readonly status: 'HELD' | 'CONFIRMED' | 'RELEASED';
  readonly currency: string;
  readonly total: number;
  readonly expiresAt: string;
  readonly items: readonly {
    readonly sku: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
};

type Envelope<T> = { readonly data: T };

/**
 * El catálogo de Plaza, en Quarkus. El cliente que compra viaja solo en
 * `X-Customer-Id`, desde el token: no se pasa por acá.
 */
@Injectable()
export class CatalogClient {
  constructor(
    private readonly http: HttpClientService,
    @Inject(catalog.KEY)
    private readonly config: ConfigType<typeof catalog>,
  ) {}

  async listProducts(
    limit?: number,
    cursor?: string,
  ): Promise<CatalogPage<CatalogProduct>> {
    return this.call(() =>
      this.http.get<Envelope<CatalogPage<CatalogProduct>>>(
        `${this.config.url}/v1/products`,
        { query: { limit, cursor }, ...this.options() },
      ),
    );
  }

  /** Lo más vendido, que el catálogo lleva con los pedidos confirmados. */
  async bestSellers(limit?: number): Promise<BestSeller[]> {
    return this.call(() =>
      this.http.get<Envelope<BestSeller[]>>(
        `${this.config.url}/v1/products/best-sellers`,
        { query: { limit }, ...this.options() },
      ),
    );
  }

  async findProduct(sku: string): Promise<CatalogProduct> {
    return this.call(() =>
      this.http.get<Envelope<CatalogProduct>>(
        `${this.config.url}/v1/products/${encodeURIComponent(sku)}`,
        this.options(),
      ),
    );
  }

  /**
   * Aparta el stock y devuelve los precios: el precio lo pone el catálogo. Con
   * la `Idempotency-Key` de la compra, repetirla devuelve la misma reserva.
   */
  async reserve(
    idempotencyKey: string,
    items: readonly { sku: string; quantity: number }[],
  ): Promise<Reservation> {
    return this.call(() =>
      this.http.post<Envelope<Reservation>>(
        `${this.config.url}/v1/reservations`,
        { items },
        { ...this.options(), headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    );
  }

  async confirm(id: string): Promise<Reservation> {
    return this.call(() =>
      this.http.post<Envelope<Reservation>>(
        `${this.config.url}/v1/reservations/${id}/confirm`,
        undefined,
        this.options(),
      ),
    );
  }

  async release(id: string): Promise<Reservation> {
    return this.call(() =>
      this.http.post<Envelope<Reservation>>(
        `${this.config.url}/v1/reservations/${id}/release`,
        undefined,
        this.options(),
      ),
    );
  }

  private options() {
    // forwardError: el 409 de OUT_OF_STOCK tiene que llegar como 409, no como
    // el 502 genérico de un upstream que falla.
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
