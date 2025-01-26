import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMING = 'confirming',
  CONFIRMED = 'confirmed',
  ERRORED = 'errored'
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  txid: string;

  @Column()
  orders: string;

  @Column()
  amount: string;

  @Column()
  price: string;

  @Column()
  confirmations: number

  @Column({ default: 'pending' })
  status: TransactionStatus;

  @CreateDateColumn()
  createdAt: Date;
}
