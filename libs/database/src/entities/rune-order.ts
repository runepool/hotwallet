import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum RuneOrderType {
  ASK = 'ask',
  BID = 'bid',
}

export enum OrderStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELED = 'canceled',
}


const BigIntTransformer = {
  from: (value: string) => {
    return BigInt(value || 0);
  },
  to: (value: bigint) => {
    return value && value.toString();
  },
};

@Entity()
export class RuneOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rune: string;

  @Column('bigint', {
    default: 0n,
    transformer: BigIntTransformer
  })
  quantity: bigint;

  @Column('bigint', {
    default: 0n,
    transformer: BigIntTransformer
  })
  filledQuantity: bigint;

  @Column('bigint', {
    default: 0n,
    transformer: BigIntTransformer
  })
  price: bigint;

  @Column({ default: 'open' })
  status: string;

  @Column({ type: 'text' })
  type: RuneOrderType;

  @CreateDateColumn()
  createdAt: Date;
}
