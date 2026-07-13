import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated) {
    return true;
  }

  // Redirect to login page by returning UrlTree (best practice for functional guards)
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated) {
      return router.createUrlTree(['/login']);
    }

    const userRole = authService.userRole?.toUpperCase();
    if (userRole && allowedRoles.map(r => r.toUpperCase()).includes(userRole)) {
      return true;
    }

    // Role is not authorized, redirect to forbidden page
    return router.createUrlTree(['/forbidden']);
  };
};
