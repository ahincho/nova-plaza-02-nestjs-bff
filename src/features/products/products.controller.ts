import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiEnvelope, ApiErrors, Public } from '@ahincho/nova-nestjs';
import { CatalogClient } from '../../upstream/catalog/catalog.client';
import {
  BestSellerResponse,
  toBestSellerResponse,
} from './dto/best-seller.response';
import { BestSellersQuery } from './dto/best-sellers.query';
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

  // Antes de ':sku', para que `best-sellers` no se lea como un código.
  @Get('best-sellers')
  @ApiEnvelope(BestSellerResponse, {
    isArray: true,
    description: 'Lo más vendido, de más a menos unidades',
  })
  @ApiErrors(400)
  async bestSellers(
    @Query() query: BestSellersQuery,
  ): Promise<BestSellerResponse[]> {
    const ranking = await this.catalog.bestSellers(query.limit);
    return ranking.map(toBestSellerResponse);
  }

  @Get(':sku')
  @ApiEnvelope(ProductResponse, { description: 'Un producto' })
  @ApiErrors(404)
  async findOne(@Param('sku') sku: string): Promise<ProductResponse> {
    return toProductResponse(await this.catalog.findProduct(sku));
  }
}
