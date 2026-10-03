import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogClient } from './catalog.client';
import { catalog } from './catalog.config';

@Module({
  imports: [ConfigModule.forFeature(catalog)],
  providers: [CatalogClient],
  exports: [CatalogClient],
})
export class CatalogUpstreamModule {}
