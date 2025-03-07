import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('auto_rebalance_configurations')
export class AutoRebalanceConfiguration {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  assetName: string;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.5 })
  spread: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
