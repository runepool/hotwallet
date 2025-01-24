export type BestInSlotResponse<T> = {
  data: T;
  block_height: number;
};

export type RuneInfo = {
  rune_id: string;
  rune_number: string;
  rune_name: string;
  spaced_rune_name: string;
  symbol: string;
  decimals: number;
  per_mint_amount: string;
  mint_cnt: string;
  mint_cnt_limit: string;
  premined_supply: string;
  total_minted_supply: string;
  burned_supply: string;
  circulating_supply: string;
  mint_progress: number;
  mint_start_block: null;
  mint_end_block: number;
  genesis_block: number;
  deploy_ts: Date;
  deploy_txid: string;
  mintable: boolean;
};

// returns an empty object if there's nothing
export type PossiblyEmptyRuneOutput = RuneOutput | {};

export type RuneOutput = {
  pkscript: string;
  wallet_addr: string;
  output: string;
  rune_ids: string[];
  balances: number[];
  rune_names: string[];
  spaced_rune_names: string[];
  decimals: number[];
};

export type InscriptionInfo = {
  inscription_name: string;
  inscription_id: string;
  inscription_number: number;
  metadata: InscripionMetadata;
  wallet: string;
  mime_type: string;
  media_length: number;
  genesis_ts: number;
  genesis_height: number;
  genesis_fee: number;
  output_value: number;
  satpoint: string;
  last_sale_price: null;
  collection_name: string;
  collection_slug: string;
  last_transfer_block_height: number;
  utxo: string;
  parent_ids: string[];
  collection_floor_price: number;
  min_price: null;
  ordswap_price: null;
  magiceden_price: null;
  ordinalswallet_price: null;
  gammaio_price: null;
  nostr_price: null;
  odynals_price: null;
  unisat_price: null;
  ordinalsmarket_price: null;
  okx_price: null;
  content_url: string;
  bis_url: string;
  render_url: null;
  byte_size: number;
  bitmap_number: null;
  delegate: InscriptionDelegate;
};

export type InscripionMetadata = {
  name?: string;
} & Record<string, string>;

export type InscriptionDelegate = {
  delegate_id: string;
  render_url: string;
  mime_type: string;
  content_url: string;
  bis_url: string;
};

export type InscriptionBatchResponse = {
  query: string;
  result: (InscriptionInfo | InscriptionInfo[]) | null; // if no inscription
};



export namespace Brc20 {
  export interface TickerInfo {
    ticker: string;
    original_ticker: string;
    image_url: string;
    limit_per_mint: number;
    max_supply: number;
    minted_supply: number;
    burned_supply: number;
    mint_progress: number;
    holder_count: number;
    tx_count: number;
    deploy_ts: Date;
    deploy_incr_number: number;
    deploy_inscr_id: string;
    is_self_mint: boolean;
    decimals: number;
  }

  export interface ValidityCheck {
    transfer_info: TransferInfo;
    mint_info: MintInfo;
    deploy_info: DeployInfo;
  }

  export interface DeployInfo {
    is_valid: boolean;
    ticker: null;
    original_ticker: null;
    max_supply: null;
    decimals: null;
    limit_per_mint: null;
    is_self_mint: null;
  }

  export interface MintInfo {
    is_valid: boolean;
    ticker: null;
    original_ticker: null;
    amount: null;
    mint_wallet: null;
    parent_id: null;
  }

  export interface TransferInfo {
    inscription_id: string;
    is_valid: boolean;
    ticker: string;
    original_ticker: string;
    amount: string;
    is_used: boolean;
  }
}
