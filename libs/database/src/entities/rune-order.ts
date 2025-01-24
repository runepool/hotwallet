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


@Entity()
export class RuneOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rune: string;

  @Column('bigint')
  quantity: bigint;

  @Column('bigint', { default: 0 })
  filledQuantity: bigint;

  @Column('bigint')
  price: bigint;

  @Column({ default: 'open' })
  status: string;

  @Column({ type: 'text' })
  type: RuneOrderType;

  @CreateDateColumn()
  createdAt: Date;
}
