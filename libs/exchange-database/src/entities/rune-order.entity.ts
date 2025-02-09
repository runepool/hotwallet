import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, PrimaryColumn } from 'typeorm';

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
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  rune: string;

  @Column('bigint', { transformer: BigIntTransformer })
  quantity: bigint;

  @Column('bigint', { transformer: BigIntTransformer, default: 0 })
  filledQuantity: bigint;

  @Column('bigint', { transformer: BigIntTransformer })
  price: bigint;

  @Column({ type: 'enum', enum: RuneOrderType })
  type: RuneOrderType;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.OPEN })
  status: OrderStatus;

  @Column()
  makerNostrKey: string;

  @Column()
  makerAddress: string;

  @Column()
  makerPublicKey: string;

  @CreateDateColumn()
  createdAt: Date;
}
