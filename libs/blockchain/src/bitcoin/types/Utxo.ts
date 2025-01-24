export interface Utxo {
  txid: string;
  vout: number;
  status: Status;
  value: number;
}

interface Status {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
}
