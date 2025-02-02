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
  from: (value: string) => BigInt(value || 0),
  to: (value: bigint) => value?.toString(),
};

@Entity()
export class RuneOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rune: string;

  @Column('bigint', { transformer: BigIntTransformer })
  quantity: bigint;

  @Column('bigint', { transformer: BigIntTransformer })
  filledQuantity: bigint;

  @Column('bigint', { transformer: BigIntTransformer })
  price: bigint;

  @Column({ type: 'enum', enum: OrderStatus })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;
}
