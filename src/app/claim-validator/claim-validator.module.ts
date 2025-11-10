import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClaimValidatorComponent } from './claim-validator.component';
import { ClaimValidatorRoutingModule } from './claim-validator-routing.module';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    ClaimValidatorComponent
  ],
  imports: [
    CommonModule,
    ClaimValidatorRoutingModule,
    FormsModule
  ]
})
export class ClaimValidatorModule { }

