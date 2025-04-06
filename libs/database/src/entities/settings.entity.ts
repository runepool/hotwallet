import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class SettingsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  bitcoinPrivateKey?: string;

  @Column({ nullable: true })
  ordUrl?: string;

  @Column({ nullable: true })
  websocketUrl?: string;
  
  @Column({ default: false })
  hasPassword: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
