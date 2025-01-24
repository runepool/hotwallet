import { HttpStatus, Injectable } from '@nestjs/common';
import { Network, networks } from 'bitcoinjs-lib';
import { Errors, OracleError } from 'libs/errors/errors';
import { BitcoinService } from './bitcoin/bitcoin.service';
import { UnspentOutput } from './bitcoin/types/UnspentOutput';
import { Utxo } from './bitcoin/types/Utxo';
import { OrdinalsService } from './ordinals/ordinals.service';
import { RunesService } from './runes/runes.service';
import { branchAndBoundUTXOSelection } from './utxoSelection';

@Injectable()
export class BlockchainService {


    constructor(
        private readonly bitcoinService: BitcoinService,
        private readonly runeService: RunesService,
        private readonly ordinalsService: OrdinalsService
    ) {
    }


    /**
     * Returns a list of sanitized spendable inputs
     * @param address - The account address that we are getting the valid inputs for
     * @param publicKey - If provided, the returned outputs will also gold information necessary for spending
     * @returns {Promise<UnspentOutput>} 
     */
    async getSanitizedUtxos(address: string, publicKey?: string, keepRunes?: boolean, keepInscriptions?: boolean): Promise<UnspentOutput[]> {
        const utxos = await this.bitcoinService.getUtxos(address);
        // Filter out the utxos that have inscriptions or rare sats
        const sanitizedOutputs = await this.sanitizeOutputs(utxos, publicKey, keepRunes, keepInscriptions);
        return sanitizedOutputs;
    }

    async getValidFundingInputs(paymentAddress: string, paymentPublicKey: string, keepRunes?: boolean, keepInscriptions?: boolean, amount?: number, feeRate?: number): Promise<UnspentOutput[]> {

        // Filter out the utxos that have inscriptions or rare sats
        const sanitizedOutputs = await this.getSanitizedUtxos(paymentAddress, paymentPublicKey, keepRunes, keepInscriptions)

        if (!sanitizedOutputs || sanitizedOutputs.length === 0) {
            throw new OracleError(Errors.NO_VALID_INPUTS_FOUND, HttpStatus.BAD_REQUEST);
        }

        sanitizedOutputs.sort((a, b) => b.amount - a.amount);
        // We prioritize unused outputs by placing then at at the start of the list
        let validOutputs: UnspentOutput[] = [];

        if (process.env.BRANCH_AND_BOUND_ENABLED === 'true' && amount && feeRate) {
            const optimizedOutputs = branchAndBoundUTXOSelection(validOutputs, amount, feeRate);
            if (optimizedOutputs.selectedUTXOs && optimizedOutputs.selectedUTXOs.length > 0) {
                validOutputs = optimizedOutputs.selectedUTXOs;
            }
        }

        return [...validOutputs,];
    }

    /**
     * Remove inputs that have inscriptions, runes or rare sats
     */
    public async sanitizeOutputs(utxos: Utxo[], publicKey: string, keepRunes?: boolean, keepInscriptions?: boolean): Promise<UnspentOutput[]> {
        // utxo location transform helper
        const utxoLocation = (utxo: Utxo): { location: string; inscriptions: string[]; runeIds: string[]; runeBalances: bigint[] } => ({ location: `${utxo.txid}:${utxo.vout}`, inscriptions: [], runeBalances: [], runeIds: [] })

        const cached = [];// await this.cacheUtxoService.findByLocationMany(utxos.map(utxoLocation).map(item => item.location));

        // Some cached items might not have a public key because the of the /balance ep call, hence we need add the key manually
        cached.forEach(item => {
            if (!item.unspentOutput.publicKey) {
                item.unspentOutput.publicKey = publicKey;
            }
        })

        // don't hunt for
        // - utxos we've previously cleared (cached utxos)
        // - utxos smaller than 1500
        // - unconfirmed utxos
        let utxosToJudge = utxos
            .filter(utxo => {
                const response = cached.find(cache => cache.location === utxoLocation(utxo).location)
                if (response) return false
                if (utxo.value < 1000) return false
                if (!utxo.status.confirmed) return false

                return true
            })
            .map(utxoLocation)

        // filter out inputs containing runes
        const runeOutputs = await this.runeService.outputsWithRunes(utxosToJudge.map(item => item.location))
        utxosToJudge = utxosToJudge.filter(utxo => {
            const runeOutput = runeOutputs.find(i => i.output === utxo.location);
            if (runeOutput) {
                if (!keepRunes) {
                    return false
                } else {
                    utxo.runeBalances = runeOutput.balances.map(BigInt);
                    utxo.runeIds = runeOutput.rune_ids;
                }
            }
            return true
        })


        // filter out inputs containing inscriptions
        const inscriptionOutputs = await this.ordinalsService.outputsWithInscriptions(utxosToJudge.map(item => item.location))
        utxosToJudge = utxosToJudge.filter(utxo => {
            const ordOutput = inscriptionOutputs.find(i => i.location === utxo.location)
            if (ordOutput) {
                if (!keepInscriptions) {
                    if (ordOutput.value <= 10_000) {
                        return false;
                    }
                    if (utxo.inscriptions.length < 100) {
                        return false;
                    }
                    utxo.inscriptions = ordOutput.inscriptions;
                } else {
                    if (ordOutput.value <= 10_000) {
                        return false;
                    }
                    utxo.inscriptions = ordOutput.inscriptions;
                }
            }

            return true
        })


        // TODO: check for rare sats

        // we're confident that we've got a list of usable payment utxos at this point
        // fetch all their unspent info so we can return and store in the cache
        let unspents: UnspentOutput[] = [];
        const unspentBatchSize = 50;
        for (let i = 0; i < utxosToJudge.length; i += unspentBatchSize) {
            const batch = utxosToJudge.slice(i, i + unspentBatchSize)
            const result = await Promise.all(batch.map(async utxo => {
                const unspent = await this.bitcoinService.getUnspentOutput(utxo.location, publicKey)
                unspent.runeBalances = utxo.runeBalances;
                unspent.runeIds = utxo.runeIds;
                unspent.inscriptions = utxo.inscriptions;

                return unspent;
            }
            ))
            unspents = unspents.concat(result)
        }


        // include the cached ones from earlier
        const validInputs = unspents
            .concat(cached.map(i => i.unspentOutput))
            .filter(Boolean)
            .filter(output => output.safe)

        // Run a pass over the output to make sure we're not returning duplicate
        // utxos. This shouldn't happen, but because we're relying on external APIs
        // it's for the best that we double check.
        const seenUtxos = new Set<string>();
        return validInputs.filter(input => {
            if (seenUtxos.has(input.location)) {
                return false;
            }
            seenUtxos.add(input.location)
            return true;
        })
    }

}
