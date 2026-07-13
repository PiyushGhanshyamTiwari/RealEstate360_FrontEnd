import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface DisplayUser {
  userId: number;
  userName: string;
  emailId: string;
  phone: string;
  role: string;
  profileDetails?: string;
}

@Component({
  selector: 'app-all-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './all-users.component.html',
  styleUrl: './all-users.component.css'
})
export class AllUsersComponent implements OnInit {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);

  allUsers: DisplayUser[] = [];
  filteredUsers: DisplayUser[] = [];
  selectedRole = 'ALL';
  loading = true;

  ngOnInit(): void {
    this.loadAllUsersData();
  }

  loadAllUsersData(): void {
    this.loading = true;
    
    forkJoin({
      users: this.authService.getAllUsers().pipe(catchError(() => of([]))),
      tenants: this.apiService.getAllTenants().pipe(catchError(() => of([]))),
      officers: this.apiService.getAllOfficers().pipe(catchError(() => of([]))),
      technicians: this.apiService.getAllTechnicians().pipe(catchError(() => of([])))
    }).subscribe({
      next: (data) => {
        // Map users and details
        this.allUsers = data.users.map(u => {
          const roleUpper = u.role ? u.role.toUpperCase() : '';
          let details = '';

          if (roleUpper === 'TENANT') {
            const profile = data.tenants.find(t => t.emailId === u.emailId);
            if (profile) {
              details = `Tenant ID: #${profile.tenantId} | Document: ${profile.documentType} | Address: ${profile.address}`;
            }
          } else if (roleUpper === 'ACCOUNT OFFICER') {
            const profile = data.officers.find(o => o.emailId === u.emailId);
            if (profile) {
              details = `Officer ID: #${profile.officerId} | Office Full Name: ${profile.fullName} | Address: ${profile.address}`;
            }
          } else if (roleUpper === 'TECHNICIAN') {
            const profile = data.technicians.find(tech => tech.userId === u.userId);
            if (profile) {
              details = `Technician ID: #${profile.technicianId} | Spec: ${profile.specialization} | City: ${profile.city}`;
            }
          }

          return {
            userId: u.userId,
            userName: u.userName,
            emailId: u.emailId,
            phone: u.phone,
            role: roleUpper,
            profileDetails: details
          };
        });

        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
    if (this.selectedRole === 'ALL') {
      this.filteredUsers = [...this.allUsers];
    } else {
      this.filteredUsers = this.allUsers.filter(u => u.role === this.selectedRole);
    }
  }
}
