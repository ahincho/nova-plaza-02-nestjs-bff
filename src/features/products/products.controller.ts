import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiEnvelope, ApiErrors, Public } from '@ahincho/nova-nestjs';
import { CatalogClient } from '../../upstream/catalog/catalog.client';
import { CursorQuery } from './dto/cursor.query';
import {
  ProductPageResponse,
  ProductResponse,
  toProductResponse,
} from './dto/product.response';

/**
 * El catálogo, para cualquiera: mirar productos no pide iniciar sesión. Es un
 * paso directo al catálogo de Quarkus, sin reglas propias.
 */
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogClient) {}

  @Get()
  @ApiEnvelope(ProductPageResponse, { description: 'Una página de productos' })
  @ApiErrors(400)
  async list(@Query() query: CursorQuery): Promise<ProductPageResponse> {
    const page = await this.catalog.listProducts(query.limit, query.cursor);
    return {
      items: page.items.map(toProductResponse),
      nextCursor: page.nextCursor,
      hasNext: page.hasNext,
    };
  }

  @Get(':sku')
  @ApiEnvelope(ProductResponse, { description: 'Un producto' })
  @ApiErrors(404)
  async findOne(@Param('sku') sku: string): Promise<ProductResponse> {
    return toProductResponse(await this.catalog.findProduct(sku));
  }
}
