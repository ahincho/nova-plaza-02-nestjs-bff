import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditClient } from './audit.client';
import { audit } from './audit.config';

@Module({
  imports: [ConfigModule.forFeature(audit)],
  providers: [AuditClient],
  exports: [AuditClient],
})
export class AuditUpstreamModule {}
