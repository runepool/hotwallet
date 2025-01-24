import { Module } from '@nestjs/common';
import { OrdinalsService } from './ordinals.service';
import { InscriptionInfoProviderModule } from '../common/inscription-provider/inscription-provider.module';

@Module({
  imports: [InscriptionInfoProviderModule],
  providers: [OrdinalsService],
  exports: [OrdinalsService]
})
export class OrdinalsModule { }
