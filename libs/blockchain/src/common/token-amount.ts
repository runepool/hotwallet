import Decimal from 'decimal.js';

export class TokenAmount {
    _value: bigint;
    _divisibility: number;
    constructor(amount: string | number | Decimal, divisibility: number) {
        this._value = BigInt(new Decimal(amount).mul(10 ** divisibility).toFixed());
        this._divisibility = divisibility;
    }

    get formattedValue() {
        return new Decimal(this._value.toString()).div(10 ** this._divisibility).toFixed(this._divisibility);
    }

    get value() {
        return this._value.toString();
    }

    static parse(value: string | number | Decimal, divisibility: number = 0): TokenAmount {
        return new TokenAmount(value, divisibility);
    }

    static format(value: string | number | Decimal, divisibility: number = 0): number {
        return +new TokenAmount(value, divisibility).formattedValue;
    }

    static fromRawAmount(value: string | number | Decimal, divisibility: number = 0) {
        const rune = new TokenAmount(value, 0);
        rune._divisibility = divisibility;
        return rune;
    }
}
