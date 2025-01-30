export type OrdOutput = {
  value: number;
  script_pubkey: string;
  address: string;
  transaction: string;
  sat_ranges: number[][];
  inscriptions: string[];
  spent?: boolean;
  outpoint?: string;
  runes: Record<string, RuneAmount>;
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
