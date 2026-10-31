import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { databaseProviders } from './db.provider.js';
import { QUERY_CLIENT } from '../../common/constants/tokens.js';

@Global()
@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(QUERY_CLIENT) private readonly queryClient: any) {}

  async onApplicationShutdown(_signal?: string) {
    if (this.queryClient?.end) {
      await this.queryClient.end();
    }
  }
}
