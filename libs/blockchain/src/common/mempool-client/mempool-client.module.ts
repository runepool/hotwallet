import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MempoolClient } from './client';
import { AxiosRetryModule } from 'nestjs-axios-retry';
import { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

@Module({
  providers: [MempoolClient],
  imports: [
    HttpModule,
    AxiosRetryModule.forRoot({
      axiosRetryConfig: {
        retries: 3,
        retryDelay: (retryCount) => 1000 + Math.random(), // random value between 1 and 2 seconds.
        retryCondition: (error: AxiosError) => {
          if (axiosRetry.isNetworkError(error)) {
            return true;
          }

          if (!error.response) {
            return true;
          }

          switch (error.response.status) {
            case 429:
            case 502:
            case 504:
              return true;
          }

          return false;
        }
      }
    }),
  ],
  exports: [MempoolClient]
})
export class MempoolClientModule {}
