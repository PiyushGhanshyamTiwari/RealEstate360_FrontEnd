import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  apiService = inject(ApiService);
  router = inject(Router);

  role = '';
  userId: number | null = null;
  profileMissing = false;
  today = new Date();

  get userAvatar(): { emoji: string; color: string } {
    const user = this.authService.currentUserValue;
    return this.authService.getAvatarForUser(user?.userId, user?.emailId);
  }

  // Admin stats
  adminStats = {
    usersCount: 0,
    officersCount: 0,
    defaultersCount: 0
  };

  // Owner stats
  ownerStats = {
    propertiesCount: 0,
    unitsCount: 0,
    pendingAppsCount: 0,
    maintenanceCount: 0
  };

  // Tenant stats
  tenantStats = {
    applicationsCount: 0,
    maintenanceCount: 0
  };

  // Technician stats
  technicianStats = {
    tasksCount: 0
  };

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      // Normalize role checking (handles spaces and underscores, e.g., 'ACCOUNT_OFFICER' vs 'ACCOUNT OFFICER')
      this.role = user.role ? user.role.toUpperCase().replace('_', ' ').trim() : '';
      this.userId = user.userId;
      this.checkProfileSetup();
      this.loadDashboardData();
    }
  }

  checkProfileSetup(): void {
    if (!this.userId) return;

    const user = this.authService.currentUserValue;

    // TENANT ROLE
    if (this.role === 'TENANT') {
      const isCached = localStorage.getItem(`re360_tenant_profile_registered_${this.userId}`) === 'true';
      if (isCached) {
        this.profileMissing = false;
        return;
      }

      this.apiService.getTenantByUserId(this.userId).pipe(
        catchError(() => of(null))
      ).subscribe({
        next: (profile: any) => {
          if (profile && (profile.tenantId || profile.id)) {
            this.profileMissing = false;
            localStorage.setItem(`re360_tenant_profile_registered_${this.userId!}`, 'true');
          } else {
            this.profileMissing = true;
          }
        },
        error: () => {
          this.profileMissing = true;
        }
      });

    // TECHNICIAN ROLE
    } else if (this.role === 'TECHNICIAN') {
      const isCached = localStorage.getItem(`re360_technician_profile_registered_${this.userId}`) === 'true';
      if (isCached) {
        this.profileMissing = false;
        return;
      }

      this.apiService.getTechnicianById(this.userId).pipe(
        catchError(() => of(null))
      ).subscribe({
        next: (profile: any) => {
          if (profile && (profile.technicianId || profile.id)) {
            this.profileMissing = false;
            localStorage.setItem(`re360_technician_profile_registered_${this.userId!}`, 'true');
          } else {
            this.profileMissing = true;
          }
        },
        error: () => {
          this.profileMissing = true;
        }
      });

    // ACCOUNT OFFICER ROLE
    } else if (this.role === 'ACCOUNT OFFICER') {
      const isCached = localStorage.getItem(`re360_officer_profile_registered_${this.userId}`) === 'true';
      if (isCached) {
        this.profileMissing = false;
        return;
      }

      this.apiService.getOfficerById(this.userId).pipe(
        catchError(() => of(null))
      ).subscribe({
        next: (profile: any) => {
          if (profile && (profile.officerId || profile.id)) {
            this.profileMissing = false;
            localStorage.setItem(`re360_officer_profile_registered_${this.userId!}`, 'true');
          } else if (user?.emailId) {
            this.apiService.getAllOfficers().pipe(
              catchError(() => of([]))
            ).subscribe((officers: any[]) => {
              const matched = officers.find((o: any) => o.emailId === user.emailId || o.email === user.emailId);
              if (matched) {
                this.profileMissing = false;
                localStorage.setItem(`re360_officer_profile_registered_${this.userId!}`, 'true');
              } else {
                this.profileMissing = true;
              }
            });
          } else {
            this.profileMissing = true;
          }
        },
        error: () => {
          this.profileMissing = true;
        }
      });

    // OTHER ROLES (ADMIN, OWNER)
    } else {
      this.profileMissing = false;
    }
  }

  navigateToProfileSetup(): void {
    this.router.navigate(['/profile-setup']);
  }

  loadDashboardData(): void {
    if (this.role === 'ADMIN') {
      forkJoin({
        users: this.authService.getAllUsers().pipe(catchError(() => of([]))),
        officers: this.apiService.getAllOfficers().pipe(catchError(() => of([]))),
        defaulters: this.apiService.getDefaulters().pipe(catchError(() => of([])))
      }).subscribe({
        next: (data) => {
          this.adminStats.usersCount = data.users.length;
          this.adminStats.officersCount = data.officers.length;
          this.adminStats.defaultersCount = data.defaulters.length;
        }
      });
    } else if (this.role === 'OWNER') {
      if (!this.userId) return;
      forkJoin({
        properties: this.apiService.findPropertyByOwnerId(this.userId).pipe(catchError(() => of([]))),
        units: this.apiService.getAllUnits().pipe(catchError(() => of([]))),
        schedules: this.apiService.getAllSchedules().pipe(catchError(() => of([])))
      }).subscribe({
        next: (data) => {
          this.ownerStats.propertiesCount = data.properties.length;
          this.ownerStats.unitsCount = data.units.filter(u => u.propertyId && data.properties.some(p => p.propertyId === u.propertyId)).length;
          this.ownerStats.maintenanceCount = data.schedules.filter(s => s.status === 'OPEN').length;

          let pendingApps = 0;
          data.properties.forEach(p => {
            data.units.filter(u => u.propertyId === p.propertyId).forEach(u => {
              this.apiService.getApplicationsByUnitId(u.unitId).pipe(catchError(() => of([]))).subscribe(apps => {
                pendingApps += apps.filter(a => a.status === 'Submitted' || a.status === 'Pending').length;
                this.ownerStats.pendingAppsCount = pendingApps;
              });
            });
          });
        }
      });
    } else if (this.role === 'TENANT') {
      if (!this.userId) return;
      this.apiService.getApplicationByTenantId(this.userId).pipe(
        catchError(() => of([]))
      ).subscribe(apps => {
        this.tenantStats.applicationsCount = apps.length;
      });

      this.apiService.getAllSchedules().pipe(
        catchError(() => {
          const stored = localStorage.getItem(`re360_schedules_tenant_${this.userId}`);
          return of(stored ? JSON.parse(stored) : []);
        })
      ).subscribe((schedules: any[]) => {
        const mySchedules = schedules.filter((s: any) => s.userId === this.userId);
        this.tenantStats.maintenanceCount = mySchedules.filter((s: any) => s.status !== 'COMPLETED' && s.status !== 'RESOLVED' && s.status !== 'CLOSED').length;
      });
    } else if (this.role === 'TECHNICIAN') {
      if (!this.userId) return;
      this.apiService.getTechnicianSchedules(this.userId).pipe(
        catchError(() => of([]))
      ).subscribe(schedules => {
        this.technicianStats.tasksCount = schedules.filter(s => s.status !== 'RESOLVED' && s.status !== 'CLOSED').length;
      });
    }
  }
}