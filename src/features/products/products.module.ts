import { Module } from '@nestjs/common';
import { CatalogUpstreamModule } from '../../upstream/catalog/catalog.module';
import { ProductsController } from './products.controller';

@Module({
  imports: [CatalogUpstreamModule],
  controllers: [ProductsController],
})
export class ProductsModule {}
