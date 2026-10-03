import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersClient } from './orders.client';
import { orders } from './orders.config';

@Module({
  imports: [ConfigModule.forFeature(orders)],
  providers: [OrdersClient],
  exports: [OrdersClient],
})
export class OrdersUpstreamModule {}
