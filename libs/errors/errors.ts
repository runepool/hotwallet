import { HttpException } from '@nestjs/common';

export interface OracleErrorType {
  code: number;
  message: string;
}

export const Errors = {
  BITCOIN_ERROR: (message: string, code: number = 999) => ({
    code,
    message
  }),
  MALFORMED_FUNDING_TRANSACTION: (reason: string) => ({
    code: 1000,
    message: `Malformed funding transaction (${reason})`
  }),
  INVALID_BORRWER_PSBT: {
    code: 1001,
    message: `Invalid borrower psbt detected!`
  },
  INVALID_LENDER_PSBT: {
    code: 1002,
    message: `Invalid lender psbt detected!`
  },
  INVALID_ESCROW_ADDRESS: {
    code: 1003,
    message: `Invalid escrow address!`
  },
  INSUFFICIENT_RUNE_AMOUNT: {
    code: 1004,
    message: `Insufficient rune amount!`
  },
  NO_RUNE_OUTPUTS_AVAILABLE: {
    code: 1005,
    message: `No rune outputs available`
  },
  TRANSACTION_ALREADY_CONFIRMED: {
    code: 1006,
    message: `Transaction already confirmed`
  },
  OWNER_OUTPUT_NOT_FOUND: {
    code: 1007,
    message: `Owner output not found`
  },
  CLAIM_NOT_ALLOWED: {
    code: 1008,
    message: `Claim not allowed`
  },
  AIRDROP_NOT_FOUND: {
    code: 1009,
    message: `Airdrop not found`
  },
  NO_VALID_INPUTS_FOUND: {
    code: 1010,
    message: 'No valid inputs'
  },
  INVALID_REPAYMENT_REQUEST: {
    code: 1011,
    message: 'Invalid repayment request'
  },
  LOAN_NOT_ACTIVE: {
    code: 1012,
    message: 'Loan not active'
  },
  TIMELOCK_ERROR: {
    code: 1013,
    message: 'Timelock error'
  },
  COULD_NOT_ACTIVATE_LOAN: (reason: string) => ({
    code: 1014,
    message: `Could not activate loan (${reason})`
  }),
  MALFORMED_TRANSACTION: (reason: string) => ({
    code: 1015,
    message: `Malformed transaction (${reason})`
  }),
  REBUILD_REQUIRED: {
    code: 1016,
    message: 'Rebuild required'
  },
  LOAN_NOT_FOUND: {
    code: 1017,
    message: 'Loan not found'
  },
  MISSING_SIGNATURE: {
    code: 1018,
    message: 'Signature is missing'
  },
  MEMPOOL_ERROR: (message: string) => ({
    code: 1019,
    message: `Mempool error: ${message}`
  }),
  INVALID_LIQUIDATION_REQUEST: {
    code: 1020,
    message: 'Invalid liquidation request'
  },
  BRC20_TICKER_NOT_FOUND: {
    code: 1021,
    message: 'Brc ticker not found'
  },
  BRC20_COULD_NOT_PARSE_DEPLOYMENT_INSCRIPTION: {
    code: 1022,
    message: 'Could not parse deployment inscription'
  },
  BRC20_NO_VALID_INSCRIPTION: {
    code: 1023,
    message: 'Could not find a valid brc20 inscription'
  },
  BRC20_AMOUNT_MISMATCH: {
    code: 1024,
    message: 'Brc20 amount mismatch'
  },
  INSCRIPTION_NOT_FOUND: {
    code: 1025,
    message: 'Inscription not found'
  },
  COULD_NOT_INSCRIBE: (reason: string) => ({
    code: 1026,
    message: `Could not inscribe (${reason})`
  }),
  COULD_NOT_ACQUIRE_LOCK: {
    code: 1027,
    message: 'Could not acquire lock'
  },
  TO_MANY_PENDING_CLAIMS: {
    code: 1028,
    message: 'Concurrent claim limit reached'
  },
  FAILED_BUILDING_AIRDROP_CLAIM: {
    code: 1029,
    message: 'Failed building airdrop'
  },
  SIGNATURE_MISSING: {
    code: 1031,
    message: 'Unsigned inputs detected'
  },
  INDEXER_BLOCKHEIGHT_OUT_OF_SYNC: (want: number, got: number) => ({
    code: 1032,
    message: `Indexer blockheight is out of sync with bitcoin. Want ${want} Got ${got}`
  }),
  TRANSACTION_ALREADY_ONCHAIN: {
    code: 1033,
    message: `Mempool error: Transaction already on chain`
  },
  PUB_KEY_MESSING: {
    code: 1034,
    message: `Public key is missing`
  },
  QUOTE_AMOUNT_LESS_THAN_DUST: {
    code: 1035,
    message: `Quote amount is less than dust`
  },
  BASE_AMOUNT_LESS_THAN_DUST: {
    code: 1036,
    message: `Base amount is less than dust`
  },
  INSUFFICIENT_FUNDS: {
    code: 1037,
    message: `Insufficient funds`
  },
  TX_VALUE_TO_SMALL: {
    code: 1038,
    message: `Transaction value is too small to cover for network fee`
  }
};

export class OracleError extends HttpException {
  constructor(err: OracleErrorType, public httpCode = 406) {
    super(err, httpCode);
  }
}
