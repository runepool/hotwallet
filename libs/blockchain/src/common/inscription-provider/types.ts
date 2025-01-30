export type OrdOutput = {
  location: string;
  value: number;
  script_pubkey: string;
  address: string;
  transaction: string;
  sat_ranges: number[][];
  spent?: boolean;
  outpoint?: string;
  inscriptions: string[];
  runes: Record<string, OrdOutputRuneAmount>;
};

export type OrdContent = string;

export type OrdOutputRuneAmount = {
  amount: number;
  divisibility: number;
  symbol: string;
};

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

export type WithHeight<T> = {
  block_height: number;
  data: T;
};

export type RuneInfo = {
  rune_id: string;
  rune_number: string;
  rune_name: string;
  spaced_rune_name: string;
  symbol: string;
  decimals: number;
  deploy_ts: Date;
  deploy_txid: string;
}

