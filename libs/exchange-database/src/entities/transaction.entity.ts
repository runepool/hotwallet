import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

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

  @Column({ default: 0 })
  confirmations: number;
}
