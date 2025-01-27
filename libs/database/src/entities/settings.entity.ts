import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class SettingsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  bitcoinPrivateKey: string;

  @Column()
  ordUrl: string;

  @Column('simple-array')
  nostrRelays: string[];

  @Column({ nullable: true })
  nostrPrivateKey: string;

  @Column({ nullable: true })
  nostrPublicKey: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
