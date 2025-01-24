export type Sandshrew<T> = {
  jsonrpc: string;
  id: number;
  result: T;
  error?: unknown
};


// ORD

export type OrdOutput = {
  value: number;
  script_pubkey: string;
  address: string;
  transaction: string;
  sat_ranges: number[][];
  inscriptions: string[];
  runes: Record<string, RuneAmount>;
};

export type OrdContent = {
  result: string; // base64
};


export type RuneAmount = {
  amount: number;
  divisibility: number;
  symbol: string;
};

export type RuneInfo = {
  entry: RuneEntry;
  id: string;
  mintable: boolean;
  parent: string;
};

export type RuneEntry = {
  block: number;
  burned: number;
  divisibility: number;
  etching: string;
  mints: number;
  number: number;
  premine: number;
  spaced_rune: string;
  symbol: string;
  terms: null; // ??
  timestamp: number;
  turbo: boolean;
};

// ESPLORA

export interface TxInfo {
  txid: string;
  version: number;
  locktime: number;
  vin: {
    txid: string;
    vout: number;
    prevout: Vout;
    scriptsig: string;
    scriptsig_asm: string;
    is_coinbase: boolean;
    sequence: string;
  }[];
  vout: Vout[];
  size: number;
  weight: number;
  fee: number;
  status: TxStatus;
}

export interface Vout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface TxStatus {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
}

export interface OutspendInfo {
  spent: boolean;
  txid: string;
  vin: number;
  status: TxStatus;
}

export interface FeeEstimation {
  '1': number;
  '2': number;
  '3': number;
  '4': number;
  '5': number;
  '6': number;
  '7': number;
  '8': number;
  '9': number;
  '10': number;
  '11': number;
  '12': number;
  '13': number;
  '14': number;
  '15': number;
  '16': number;
  '17': number;
  '18': number;
  '19': number;
  '20': number;
  '21': number;
  '22': number;
  '23': number;
  '24': number;
  '25': number;
  '144': number;
  '504': number;
  '1008': number;
}

export interface Utxo {
  txid: string;
  vout: number;
  status: TxStatus;
  value: number;
}
