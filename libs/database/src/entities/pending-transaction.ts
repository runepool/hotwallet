import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum PendingTransactionStatus {
  PENDING = 'pending',
  CONFIRMING = 'confirming',
}

@Entity()
export class PendingTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  txid: string;

  @Column()
  orders: string;

  @Column({ default: 'pending' })
  status: PendingTransactionStatus;

  @CreateDateColumn()
  createdAt: Date;
}
