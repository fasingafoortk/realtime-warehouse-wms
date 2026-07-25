import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./views/login/login').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./views/layout/layout').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./views/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'inventory',
        loadComponent: () => import('./views/inventory/inventory').then((m) => m.InventoryComponent),
      },
      {
        path: 'inbound',
        loadComponent: () => import('./views/inbound/inbound').then((m) => m.InboundComponent),
      },
      {
        path: 'outbound',
        loadComponent: () => import('./views/outbound/outbound').then((m) => m.OutboundComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
