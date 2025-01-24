export interface OutspendInfo {
  spent: boolean;
  txid: string;
  vin: number;
  status: TxStatus;
}

export interface TxStatus {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
}

// all floats
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
    witness: string[];
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

export interface Utxo {
  txid: string;
  vout: number;
  status: TxStatus;
  value: number;
}

