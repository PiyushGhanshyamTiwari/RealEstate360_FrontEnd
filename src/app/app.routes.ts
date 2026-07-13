import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: '',
    loadComponent: () => import('./shared/layouts/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'profile-setup',
        loadComponent: () => import('./features/profile/profile-setup.component').then(m => m.ProfileSetupComponent)
      },
      {
        path: 'properties',
        loadComponent: () => import('./features/properties/properties.component').then(m => m.PropertiesComponent),
        canActivate: [roleGuard(['OWNER', 'TENANT', 'ADMIN'])]
      },
      {
        path: 'units',
        loadComponent: () => import('./features/units/units.component').then(m => m.UnitsComponent),
        canActivate: [roleGuard(['OWNER', 'TENANT', 'ADMIN'])]
      },
      {
        path: 'applications',
        loadComponent: () => import('./features/applications/applications.component').then(m => m.ApplicationsComponent),
        canActivate: [roleGuard(['OWNER', 'TENANT', 'ADMIN'])]
      },
      {
        path: 'leases',
        loadComponent: () => import('./features/leases/leases.component').then(m => m.LeasesComponent),
        canActivate: [roleGuard(['OWNER', 'TENANT', 'ADMIN'])]
      },
      {
        path: 'invoices',
        loadComponent: () => import('./features/invoices/invoices.component').then(m => m.InvoicesComponent),
        canActivate: [roleGuard(['ACCOUNT OFFICER', 'TENANT', 'OWNER', 'ADMIN'])]
      },
      {
        path: 'ledger',
        loadComponent: () => import('./features/ledger/ledger.component').then(m => m.LedgerComponent),
        canActivate: [roleGuard(['ACCOUNT OFFICER', 'ADMIN'])]
      },
      {
        path: 'maintenance',
        loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
        canActivate: [roleGuard(['OWNER', 'TENANT', 'TECHNICIAN', 'ADMIN'])]
      },
      {
        path: 'admin-logs',
        loadComponent: () => import('./features/admin/admin-logs.component').then(m => m.AdminLogsComponent),
        canActivate: [roleGuard(['ADMIN'])]
      },
      {
        path: 'all-users',
        loadComponent: () => import('./features/admin/all-users.component').then(m => m.AllUsersComponent),
        canActivate: [roleGuard(['ADMIN'])]
      },
      {
        path: 'account-officers',
        loadComponent: () => import('./features/admin/account-officers.component').then(m => m.AccountOfficersComponent),
        canActivate: [roleGuard(['ADMIN'])]
      },
      {
        path: 'forbidden',
        loadComponent: () => import('./features/errors/forbidden.component').then(m => m.ForbiddenComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
