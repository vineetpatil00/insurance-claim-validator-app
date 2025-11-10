import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/claims',
    pathMatch: 'full'
  },
  {
    path: 'claims',
    loadChildren: () =>
      import('./claims-list/claims-list.module').then((m) => m.ClaimsListModule),
  },
  {
    path: 'claim-validator',
    loadChildren: () =>
      import('./claim-validator/claim-validator.module').then((m) => m.ClaimValidatorModule),
  },
  {
    path: 'claim-validator/:id',
    loadChildren: () =>
      import('./claim-validator/claim-validator.module').then((m) => m.ClaimValidatorModule),
  },
  {
    path: 'claim-validator/:id/:step',
    loadChildren: () =>
      import('./claim-validator/claim-validator.module').then((m) => m.ClaimValidatorModule),
  },
  {
    path: 'claim-validator/:step',
    loadChildren: () =>
      import('./claim-validator/claim-validator.module').then((m) => m.ClaimValidatorModule),
  },
  {
    path: '**',
    redirectTo: '/claims',
    pathMatch: 'full'
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
