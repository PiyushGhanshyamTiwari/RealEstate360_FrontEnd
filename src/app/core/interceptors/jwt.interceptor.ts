import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Directly retrieve token from LocalStorage to avoid cyclic dependency between AuthService & HttpClient
  let token = null;
  const storedUser = localStorage.getItem('re360_user');
  if (storedUser) {
    try {
      const userObj = JSON.parse(storedUser);
      token = userObj?.token || null;
    } catch (e) {
      // Ignore parsing errors
    }
  }

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Clear session and redirect to sign-in page
        localStorage.removeItem('re360_user');
        router.navigate(['/login'], { queryParams: { sessionExpired: true } });
      }
      // Let 403 errors pass through to the calling components so they can catchError and handle it locally
      return throwError(() => error);
    })
  );
};
