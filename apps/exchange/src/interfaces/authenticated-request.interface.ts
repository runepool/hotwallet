import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    nostrPublicKey: string;
    corePublicKey: string;
    address: string;
  };
}
