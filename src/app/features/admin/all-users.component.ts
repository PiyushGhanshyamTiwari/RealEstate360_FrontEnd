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
  status: string;
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

          return {
            userId: u.userId,
            userName: u.userName,
            emailId: u.emailId,
            phone: u.phone,
            role: roleUpper,
            status: u.status || 'ACTIVE'
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

  toggleUserStatus(user: DisplayUser): void {
    if (user.role === 'ADMIN') return;

    const newStatus = (user.status === 'ACTIVE' || user.status === 'APPROVED') ? 'INACTIVE' : 'ACTIVE';
    this.apiService.updateUserStatus(user.userId, newStatus).subscribe({
      next: () => {
        user.status = newStatus;
      },
      error: (err) => {
        console.error('Failed to toggle status', err);
        alert(`API Error details:\n- URL attempted: ${err.url || ('PUT /api/v1/user/' + user.userId + '/' + newStatus)}\n- Status code: ${err.status || 'None'}\n- Message: ${err.message || 'Server may be down or connection refused'}`);
      }
    });
  }
}
