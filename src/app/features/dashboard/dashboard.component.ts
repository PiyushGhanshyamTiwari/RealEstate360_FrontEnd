import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
      this.role = user.role.toUpperCase();
      this.userId = user.userId;
      this.checkProfileSetup();
      this.loadDashboardData();
    }
  }

  checkProfileSetup(): void {
    if (!this.userId) return;

    if (this.role === 'TENANT') {
      if (localStorage.getItem(`re360_tenant_profile_registered_${this.userId}`) === 'true') {
        this.profileMissing = false;
        return;
      }
      this.apiService.getApplicationByTenantId(this.userId).subscribe({
        next: (apps) => {
          if (apps && apps.length > 0) {
            this.profileMissing = false;
            localStorage.setItem(`re360_tenant_profile_registered_${this.userId}`, 'true');
          } else {
            this.profileMissing = true;
          }
        },
        error: () => {
          this.profileMissing = true;
        }
      });
    } else if (this.role === 'TECHNICIAN') {
      if (localStorage.getItem(`re360_technician_profile_registered_${this.userId}`) === 'true') {
        this.profileMissing = false;
        return;
      }
      this.apiService.getTechnicianById(this.userId).pipe(
        catchError(() => {
          this.profileMissing = true;
          return of(null);
        })
      ).subscribe(profile => {
        if (profile) {
          this.profileMissing = false;
          localStorage.setItem(`re360_technician_profile_registered_${this.userId}`, 'true');
        } else {
          this.profileMissing = true;
        }
      });
    } else if (this.role === 'ACCOUNT OFFICER') {
      if (localStorage.getItem(`re360_officer_profile_registered_${this.userId}`) === 'true') {
        this.profileMissing = false;
        return;
      }
      this.apiService.getOfficerById(this.userId).pipe(
        catchError(() => {
          this.profileMissing = true;
          return of(null);
        })
      ).subscribe(profile => {
        if (profile) {
          this.profileMissing = false;
          localStorage.setItem(`re360_officer_profile_registered_${this.userId}`, 'true');
        } else {
          this.profileMissing = true;
        }
      });
    }
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
