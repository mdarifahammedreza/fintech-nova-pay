import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Currency } from '../../accounts/enums/currency.enum';
import { FxProvider } from '../enums/fx-provider.enum';

export type FxLiveQuote = {
  rate: string;
  providerReference: string | null;
  provider: FxProvider;
};

/**
 * Live FX pricing only. No cache fallback: each quote is fetched fresh or this
 * layer fails loudly.
 */
@Injectable()
export class FxProviderService {
  /**
   * Returns a provider-quoted rate for the pair. Never returns a stale cached
   * rate when the provider is down.
   *
   * TODO: Replace with real HTTP integration (auth, timeouts, circuit breaker).
   * When FX_PROVIDER_MOCK=true, returns an explicit mock (opt-in only).
   */
  async fetchLiveRate(
    sourceCurrency: Currency,
    targetCurrency: Currency,
  ): Promise<FxLiveQuote> {
    if (sourceCurrency === targetCurrency) {
      throw new ServiceUnavailableException(
        'FX provider does not quote same-currency pairs',
      );
    }

    if (process.env.FX_PROVIDER_MOCK === 'true') {
      return {
        rate: '1.00000000',
        providerReference: 'MOCK_EXPLICIT_ENV_FX_PROVIDER_MOCK',
        provider: FxProvider.MOCK,
      };
    }

    throw new ServiceUnavailableException(
      'FX live rate provider unavailable (integration pending)',
    );
  }
}
