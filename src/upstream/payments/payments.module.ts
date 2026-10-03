import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsClient } from './payments.client';
import { payments } from './payments.config';

@Module({
  imports: [ConfigModule.forFeature(payments)],
  providers: [PaymentsClient],
  exports: [PaymentsClient],
})
export class PaymentsUpstreamModule {}
