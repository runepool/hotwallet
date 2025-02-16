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
  rune: string;

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

  @Column()
  psbt: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING
  })
  status: TransactionStatus;

  @Column({ default: 0 })
  confirmations: number;

  @CreateDateColumn()
  createdAt: Date;
}
