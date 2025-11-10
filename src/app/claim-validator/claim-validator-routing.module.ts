import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClaimValidatorComponent } from './claim-validator.component';

const routes: Routes = [
  {
    path: '',
    component: ClaimValidatorComponent
  },
  {
    path: ':step',
    component: ClaimValidatorComponent
  },
  {
    path: ':id/:step',
    component: ClaimValidatorComponent
  },
  {
    path: ':id',
    component: ClaimValidatorComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClaimValidatorRoutingModule { }
