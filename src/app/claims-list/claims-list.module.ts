import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClaimsListComponent } from './claims-list.component';
import { ClaimsListRoutingModule } from './claims-list-routing.module';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    ClaimsListComponent
  ],
  imports: [
    CommonModule,
    ClaimsListRoutingModule,
    RouterModule
  ]
})
export class ClaimsListModule { }

