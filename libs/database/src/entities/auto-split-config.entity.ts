import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('auto_split_configurations')
export class AutoSplitConfiguration {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  assetName: string;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column()
  maxCost: number;

  @Column()
  splitSize: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
