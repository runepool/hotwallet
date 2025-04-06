declare module 'argon2' {
  export interface Options {
    type?: number;
    memoryCost?: number;
    timeCost?: number;
    parallelism?: number;
    salt?: Buffer;
    hashLength?: number;
    raw?: boolean;
    associatedData?: Buffer;
  }

  export const argon2id: number;
  export const argon2i: number;
  export const argon2d: number;

  export function hash(plain: string, options?: Options): Promise<string>;
  export function verify(hash: string, plain: string): Promise<boolean>;
}
