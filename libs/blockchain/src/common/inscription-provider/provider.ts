import { Injectable, Logger } from '@nestjs/common';
import { BestinslotClient } from '../bestinslot-client/client';
import { OrdClient } from '../ord-client/client';
import { OrdOutput as OrdOrdOutput } from '../ord-client/types';
import { OrdContent, OrdOutput, RuneInfo, RuneOutput, WithHeight } from './types';
import { BlockheightAwareRetry } from './util';
import { Brc20, InscriptionInfo } from '../bestinslot-client/types';
import { SandshrewClient } from '../sandshrew-client/client';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { Errors, OracleError } from 'libs/errors/errors';


interface InscriptionProviderInterface {
  inscriptionOutput(output: string): Promise<WithHeight<OrdOutput>>;
  inscriptionOutputBatch(outputs: string[]): Promise<WithHeight<OrdOutput[]>>;
  runeOutput(output: string): Promise<WithHeight<null | RuneOutput>>;
  runeOutputBatch(outputs: string[]): Promise<WithHeight<RuneOutput[]>>;
  addressOutputs(address: string): Promise<WithHeight<RuneOutput[]>>;
  tickerInfo(runeId: string): Promise<RuneInfo>;
  brc20ValidityCheck(inscriptionIds: string[]): Promise<WithHeight<Brc20.ValidityCheck[]>>;
  brc20TickerInfo(tickerInfo: string): Promise<WithHeight<Brc20.TickerInfo>>;
  inscriptionContent(inscriptionId: string): Promise<WithHeight<OrdContent>>;
}

/**
 * Queries ord
 */
@Injectable()
export class OrdInscriptionProvider implements InscriptionProviderInterface {
  constructor(private ord: OrdClient) { }

  private blockheight(): Promise<number> {
    return this.ord.blockheight();
  }

  // fetches ord's blockheight and the delegate query at the same time
  private async withHeight<T>(delegate: () => Promise<T>): Promise<WithHeight<T>> {
    let [height, response] = await Promise.all([this.blockheight(), delegate()]);

    return { block_height: height, data: response };
  }

  // normal output call
  async inscriptionOutput(output: string): Promise<WithHeight<OrdOutput>> {
    return this.withHeight(async () => this.ord.output(output).then((data) => ({ ...data, location: output })));
  }

  // ord doesn't return the utxo's vout on the batch response, so we need to do
  // some finagling to include it.
  // It does appear to return them in the requested order. So we can just zip
  // the queried array with the returned array together.
  private joinOutputBatchWithLocations(outputs: string[], ordOutputs: OrdOrdOutput[]): OrdOutput[] {
    // the ord client returns a 404 if it can't find an output so unless
    // that error gets caught, we won't ever branch out here.
    if (outputs.length !== ordOutputs.length) {
      throw new Error('mismatched output lengths');
    }

    return ordOutputs.map((i, n) => ({ ...i, location: outputs[n] }));
  }

  async inscriptionOutputBatch(outputs: string[]): Promise<WithHeight<OrdOutput[]>> {
    return this.withHeight(async () => this.joinOutputBatchWithLocations(outputs, await this.ord.outputBatch(outputs)));
  }

  // normal output call but maps the response
  async runeOutput(output: string): Promise<WithHeight<RuneOutput | null>> {
    return this.withHeight(async () =>
      this.ord
        .output(output)
        .then((data) => ({ ...data, location: output }))
        .then((r) => mapOutputToRune(this.ord)(output, r))
    );
  }

  // rune batch call! but also maps the responses
  async runeOutputBatch(outputs: string[]): Promise<WithHeight<RuneOutput[]>> {
    // judging by the source code of this endpoint, it seems safe to assume that
    // the output index matches the incoming payload order
    // ref: https://github.com/ordinals/ord/blob/47a0ba7b4b7ab9b4561b56e78cf3550eab1fe834/src/subcommand/server.rs#L612
    return this.withHeight(async () => {
      const data = this.joinOutputBatchWithLocations(outputs, await this.ord.outputBatch(outputs));
      return Promise.all(data.map(async (output, n) => mapOutputToRune(this.ord)(outputs[n], output)));
    });
  }

  /**
   * Bit of a hack until the latest ord version gets released with the /address
   * API. In the meanwhile, as a last resort, we'll just query mempool to get
   * the list of UTXOs and then feed that into ord's batch endpoint
   */
  async addressOutputs(address: string): Promise<WithHeight<RuneOutput[]>> {
    const utxos = await this.ord.address(address);
    return await this.runeOutputBatch(utxos.outputs);
  }

  async tickerInfo(runeId: string): Promise<RuneInfo> {
    const rune = await this.ord.rune(runeId);
    return {
      rune_id: rune.id,
      rune_number: String(rune.entry.number),
      rune_name: rune.entry.spaced_rune.replaceAll('•', ''),
      spaced_rune_name: rune.entry.spaced_rune,
      symbol: rune.entry.symbol,
      decimals: rune.entry.divisibility,
      deploy_ts: new Date(rune.entry.timestamp),
      deploy_txid: rune.entry.etching
    };
  }

  /**
   *  Fetches inscription content 
   */
  async inscriptionContent(inscriptionId: string): Promise<WithHeight<OrdContent>> {
    return this.withHeight(() => this.ord.inscriptionContent(inscriptionId));
  }

  async brc20ValidityCheck(inscriptionIds: string[]): Promise<WithHeight<Brc20.ValidityCheck[]>> {
    // can't do brc20 stuff with ord
    throw new Error('unimplemented');
  }

  async brc20TickerInfo(ticker: string): Promise<WithHeight<Brc20.TickerInfo>> {
    // can't do brc20 stuff with ord
    throw new Error('unimplemented');
  }
}

/**
 * Really can't do much but can
 * - check inscription info on an output
 */
@Injectable()
export class SandshrewInscriptionProvider implements InscriptionProviderInterface {
  constructor(private sandshrew: SandshrewClient) { }

  private blockheight(): Promise<number> {
    return this.sandshrew.ordBlockheight();
  }

  async inscriptionOutputBatch(output: string[]): Promise<WithHeight<OrdOutput[]>> {
    throw new Error('unimplemented');
  }

  async inscriptionOutput(output: string): Promise<WithHeight<OrdOutput>> {
    let [height, response] = await Promise.all([this.blockheight(), this.sandshrew.ordOutput(output)]);

    return { block_height: height, data: { ...response, location: output } };
  }

  async inscriptionContent(inscriptionId: string): Promise<WithHeight<OrdContent>> {
    let [height, response] = await Promise.all([this.blockheight(), this.sandshrew.ordContent(inscriptionId)]);

    return { block_height: height, data: response.result };
  }

  async runeOutput(output: string): Promise<any> {
    // can't do rune outputs with sandshrew
    throw new Error('unimplemented');
  }

  async runeOutputBatch(outputs: string[]): Promise<any> {
    // can't do rune outputs with sandshrew
    throw new Error('unimplemented');
  }

  async addressOutputs(address: string): Promise<any> {
    // not implemented until ord releases addresses
    throw new Error('unimplemented');
  }

  async tickerInfo(runeId: string): Promise<RuneInfo> {
    // can't do ord stuff with sandshrew
    throw new Error('unimplemented');
  }

  async brc20ValidityCheck(inscriptionId: string[]): Promise<WithHeight<Brc20.ValidityCheck[]>> {
    // can't do brc20 stuff with sandshrew
    throw new Error('unimplemented');
  }

  async brc20TickerInfo(ticker: string): Promise<WithHeight<Brc20.TickerInfo>> {
    // can't do brc20 stuff with sandshrew
    throw new Error('unimplemented');
  }
}

/**
 * Has a lot of features but cannot:
 * - get inscription info on an output
 */
@Injectable()
export class BestinslotInscriptionProvider implements InscriptionProviderInterface {
  constructor(private bestinslot: BestinslotClient) { }

  private mapInscriptionOutputToOrd(output: InscriptionInfo | null): OrdOutput | null {
    if (!output) return null;

    return {
      location: output.utxo,
      value: output.output_value,
      script_pubkey: '',
      address: output.wallet,
      transaction: output.utxo.split(':')[0],
      sat_ranges: [],
      inscriptions: [output.inscription_id],
      runes: {}
    } satisfies OrdOutput;
  }

  async inscriptionOutput(output: string): Promise<WithHeight<OrdOutput | null>> {
    const resp = await this.bestinslot.batchInscriptionInfo([output]);
    if (resp.data.length < 1) {
      throw new Error(`${output} not found`);
    }

    const out = resp.data[0].result;
    return {
      block_height: resp.block_height,
      data: this.mapInscriptionOutputToOrd(Array.isArray(out) ? out[0] : out)
    };
  }

  async inscriptionOutputBatch(outputs: string[]): Promise<WithHeight<OrdOutput[]>> {
    const resp = await this.bestinslot.batchInscriptionInfoPaged(outputs);
    if (outputs.length > 0 && resp.data.length < 1) {
      throw new Error(`bestinslot batch inscription output query failed`);
    }

    return {
      block_height: resp.block_height,
      data: resp.data
        .map((item) => this.mapInscriptionOutputToOrd(Array.isArray(item.result) ? item.result[0] : item.result))
        .filter(Boolean)
    };
  }

  async runeOutput(output: string): Promise<WithHeight<RuneOutput | null>> {
    const response = await this.bestinslot.runesOutputInfo(output);

    if (BestinslotClient.outputHasRunes(response.data)) {
      return { block_height: response.block_height, data: response.data };
    }

    return { block_height: response.block_height, data: null };
  }

  async runeOutputBatch(outputs: string[]): Promise<WithHeight<RuneOutput[]>> {
    const response = await this.bestinslot.batchRuneOutputsInfoPaged(outputs);
    return {
      block_height: response.block_height,
      data: response.data
        .map((output) => {
          if (BestinslotClient.outputHasRunes(output)) {
            return output;
          }

          return null;
        })
        .filter(Boolean)
    };
  }

  async addressOutputs(address: string): Promise<WithHeight<RuneOutput[]>> {
    return this.bestinslot.runesWalletValidOutputs(address);
  }

  async tickerInfo(runeId: string): Promise<RuneInfo> {
    // don't care about blockheight
    return this.bestinslot.runesTickerInfo(runeId).then((r) => r.data);
  }

  async brc20ValidityCheck(inscriptionIds: string[]): Promise<WithHeight<Brc20.ValidityCheck[]>> {
    return this.bestinslot.brc20ValidityCheck(inscriptionIds)
  }

  async brc20TickerInfo(ticker: string): Promise<WithHeight<Brc20.TickerInfo>> {
    return this.bestinslot.brc20TickerInfo(ticker)
  }

  async inscriptionContent(inscriptionId: string): Promise<WithHeight<OrdContent>> {
    // Cannot get the inscription content via BIS
    throw new Error("unimplemented")
  }
}

const mapOutputToRune =
  (ord: OrdClient) =>
    async (output: string, out: OrdOutput): Promise<RuneOutput | null> => {
      // flatten (include the rune_id on the main object)
      const runes = Object.entries(out.runes).map(([k, v]) => ({ rune_id: k, ...v }));

      const rune_ids = [];
      for (const rune of runes) {
        const runeInfo = await ord.rune(rune.rune_id);
        rune_ids.push(runeInfo.id);
      }

      return {
        pkscript: out.script_pubkey,
        wallet_addr: out.address,
        output: output,
        rune_ids,
        balances: runes.map((i) => i.amount),
        rune_names: runes.map((i) => ''), // needed?
        spaced_rune_names: runes.map((i) => ''), // needed?
        decimals: runes.map((i) => i.divisibility)
      };
    };

@Injectable()
export class InscriptionProvider {
  constructor(
    private sandshrew: SandshrewInscriptionProvider,
    private bestinslot: BestinslotInscriptionProvider,
    private ord: OrdInscriptionProvider,
    private bitcoin: BitcoinService
  ) { }

  private async blockheight(): Promise<number> {
    return this.bitcoin.getTipHeight();
  }
  //
  // Ord output but only reliably gives inscription information.
  // pecking order:
  // - ord
  // - bestinslot
  async inscriptionOutputBatch(outputs: string[]): Promise<WithHeight<OrdOutput[]>> {
    const height = await this.blockheight();

    try {
      return await BlockheightAwareRetry(height, () => this.ord.inscriptionOutputBatch(outputs));
    } catch (error: unknown) {
      Logger.error(error);
    }

    return await BlockheightAwareRetry(height, () => this.bestinslot.inscriptionOutputBatch(outputs), 1);
  }

  // Ord output but only reliably gives inscription information.
  // pecking order:
  // - ord
  // - bestinslot
  // - sandshrew
  async inscriptionOutput(output: string): Promise<WithHeight<OrdOutput | null>> {
    const height = await this.blockheight();

    try {
      return await BlockheightAwareRetry(height, () => this.ord.inscriptionOutput(output));
    } catch (error: unknown) {
      Logger.error(error);
    }

    try {
      return await BlockheightAwareRetry(height, () => this.bestinslot.inscriptionOutput(output), 1);
    } catch (error: unknown) {
      Logger.error(error);
    }

    return await BlockheightAwareRetry(height, () => this.sandshrew.inscriptionOutput(output), 1);
  }

  // Rune output info.
  // pecking order:
  // - ord
  // - bestinslot
  //
  // - can also return null when BIS is used
  async runeOutput(output: string): Promise<WithHeight<RuneOutput | null>> {
    const height = await this.blockheight();

    try {
      return await BlockheightAwareRetry(height, () => this.ord.runeOutput(output));
    } catch (error: unknown) {
      Logger.error(error);
    }

    return await BlockheightAwareRetry(height, () => this.bestinslot.runeOutput(output), 1);
  }

  // Rune output info (batched).
  // pecking order:
  // - ord
  // - bestinslot
  async runeOutputBatch(outputs: string[]): Promise<WithHeight<RuneOutput[]>> {
    const height = await this.blockheight();

    try {
      return await BlockheightAwareRetry(height, () => this.ord.runeOutputBatch(outputs));
    } catch (error: unknown) {
      Logger.error(error);
    }

    return await BlockheightAwareRetry(height, () => this.bestinslot.runeOutputBatch(outputs), 1);
  }

  // Address outputs
  // pecking order:
  // - ord
  // - bestinslot
  async addressOutputs(address: string): Promise<WithHeight<RuneOutput[]>> {
    const height = await this.blockheight();

    try {
      return await BlockheightAwareRetry(height, () => this.ord.addressOutputs(address));
    } catch (error: unknown) {
      Logger.error(error);
    }

    return await this.bestinslot.addressOutputs(address);
  }

  // rune ticker info
  // pecking order:
  // - ord
  // - bestinslot
  async tickerInfo(runeId: string): Promise<RuneInfo> {
    let tickerInfo: RuneInfo | undefined = undefined;

    try {
      tickerInfo = await this.ord.tickerInfo(runeId);
    } catch (error: unknown) {
      Logger.error(error);
    }

    // got something!
    if (tickerInfo && tickerInfo.rune_id) {
      return tickerInfo;
    }

    // didn't get something? check BIS.
    // realistically, I think we'd only get here if the ord server was
    // unreachable or busy re-indexing and has a blockheight lower than
    // the rune etching.
    return this.bestinslot.tickerInfo(runeId);
  }

  // brc20 validity check 
  // pecking order:
  // - Our OPI
  // - bestinslot
  async brc20ValidityCheck(outputs: string[]): Promise<WithHeight<Brc20.ValidityCheck[]>> {
    const height = await this.blockheight();

    // TODO: Add in house indexer call here 
    return await BlockheightAwareRetry(height, () => this.bestinslot.brc20ValidityCheck(outputs), 3);
  }

  // brc20 ticker info
  // pecking order:
  // - Our OPI
  // - bestinslot
  async brc20TickerInfo(ticker: string): Promise<WithHeight<Brc20.TickerInfo>> {
    const height = await this.blockheight();

    // TODO: Add in house indexer call here 
    const tickerInfo = await BlockheightAwareRetry(height, () => this.bestinslot.brc20TickerInfo(ticker), 3);

    const brc20DeploymentInscription = tickerInfo.data.deploy_inscr_id

    let inscriptionContent: OrdContent;

    try {
      ({ data: inscriptionContent } = await BlockheightAwareRetry(height, () => this.ord.inscriptionContent(brc20DeploymentInscription)))
    } catch (error: unknown) {
      console.error(error);
    }

    if (!inscriptionContent) {
      ({ data: inscriptionContent } = await BlockheightAwareRetry(height, () => this.sandshrew.inscriptionContent(brc20DeploymentInscription), 1))
    }

    try {
      const brcInfo = JSON.parse(inscriptionContent);
      const decimals = brcInfo.decimals || 18;
      tickerInfo.data.decimals = decimals;
    } catch (error) {
      console.log(error);
      throw new OracleError(Errors.BRC20_COULD_NOT_PARSE_DEPLOYMENT_INSCRIPTION);
    }

    return tickerInfo;
  }
}
