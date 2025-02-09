import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMING = 'confirming',
  CONFIRMED = 'confirmed',
  ERRORED = 'errored'
}

export enum TransactionType {
  BUY = 'buy',
  SELL = 'sell',
  SPLIT = 'split'
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rune: string;

  @Column({ unique: true })
  tradeId: string;

  @Column({ nullable: true })
  txid: string;

  @Column()
  orders: string;

  @Column()
  type: string;

  @Column()
  amount: string;

  @Column()
  price: string;

  @Column({ default: 0 })
  confirmations: number

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}