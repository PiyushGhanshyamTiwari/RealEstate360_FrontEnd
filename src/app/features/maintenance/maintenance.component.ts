import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { MaintenanceScheduleResponseDTO, MaintenanceLogResponseDTO, TechnicianOutputDTO, UnitOutputDTO } from '../../core/models/models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.css'
})
export class MaintenanceComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  authService = inject(AuthService);

  schedules: MaintenanceScheduleResponseDTO[] = [];
  tenantUnits: UnitOutputDTO[] = [];
  technicians: TechnicianOutputDTO[] = [];
  logs: MaintenanceLogResponseDTO[] = [];

  loading = true;
  loadingLogs = false;
  isTenant = false;
  isOwner = false;
  isTechnician = false;
  userId: number | null = null;

  showTenantForm = false;
  issueForm!: FormGroup;
  submitted = false;
  submitting = false;

  errorMessage = '';
  successMessage = '';

  // Owner filter values
  filterStatus = '';
  filterSeverity = '';

  // Detail view bindings
  selectedSchedule: MaintenanceScheduleResponseDTO | null = null;

  // Owner assignment modal values
  activeAssignSchedule: MaintenanceScheduleResponseDTO | null = null;
  assignTechUserId = '';
  assignSeverity = 'MEDIUM';

  // Tech status modal values
  activeStatusSchedule: MaintenanceScheduleResponseDTO | null = null;
  updateStatusValue = 'IN_PROGRESS';
  updateRemarksValue = '';

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.userId = user.userId;
      const role = user.role.toUpperCase();
      this.isTenant = role === 'TENANT';
      this.isOwner = role === 'OWNER';
      this.isTechnician = role === 'TECHNICIAN';
    }

    this.issueForm = this.fb.group({
      unitId: ['', Validators.required],
      issueDescription: ['', Validators.required],
      category: ['', Validators.required]
    });

    if (this.isTenant) {
      this.loadTenantUnits();
    }
    if (this.isOwner) {
      this.loadTechnicians();
    }

    this.loadSchedules();
  }

  get f() { return this.issueForm.controls; }

  toggleTenantForm(): void {
    this.showTenantForm = !this.showTenantForm;
    this.errorMessage = '';
    this.successMessage = '';
    this.submitted = false;
    this.issueForm.reset();
    if (!this.showTenantForm) {
      this.loadSchedules();
    }
  }

  loadTenantUnits(): void {
    if (!this.userId) return;
    this.apiService.getApplicationByTenantId(this.userId).subscribe(apps => {
      // Find all approved units
      const approvedUnitIds = apps.filter(a => a.status === 'Approved').map(a => a.unitId);
      this.apiService.getAllUnits().subscribe(units => {
        this.tenantUnits = units.filter(u => approvedUnitIds.includes(u.unitId));
      });
    });
  }

  loadTechnicians(): void {
    this.apiService.getAllTechnicians().subscribe(data => {
      this.technicians = data;
    });
  }

  loadSchedules(): void {
    this.loading = true;
    this.selectedSchedule = null;

    if (this.isOwner) {
      this.apiService.getAllSchedules(this.filterStatus || undefined, this.filterSeverity || undefined).subscribe({
        next: (data) => {
          this.schedules = data;
          this.loading = false;
        },
        error: () => {
          this.schedules = [];
          this.loading = false;
        }
      });
    } else if (this.isTechnician && this.userId) {
      this.apiService.getTechnicianSchedules(this.userId).subscribe({
        next: (data) => {
          this.schedules = data;
          this.loading = false;
        },
        error: () => {
          this.schedules = [];
          this.loading = false;
        }
      });
    } else if (this.isTenant && this.userId) {
      this.schedules = [];
      this.loading = false;
    } else {
      this.loading = false;
    }
  }

  onIssueSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.issueForm.invalid || !this.userId) {
      return;
    }

    this.submitting = true;
    const formValue = this.issueForm.value;
    const input = {
      userId: this.userId,
      unitId: Number(formValue.unitId),
      issueDescription: formValue.issueDescription,
      category: formValue.category
    };

    this.apiService.createScheduleByTenant(input).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Maintenance issue successfully reported to management!';
        this.toggleTenantForm();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to file maintenance request.';
      }
    });
  }

  openDetailView(schedule: MaintenanceScheduleResponseDTO): void {
    this.selectedSchedule = schedule;
    this.loadingLogs = true;
    this.logs = [];

    this.apiService.getLogsByScheduleId(schedule.scheduleId).subscribe({
      next: (page) => {
        this.logs = page.content || [];
        this.loadingLogs = false;
      },
      error: () => {
        this.logs = [];
        this.loadingLogs = false;
      }
    });
  }

  closeDetailView(): void {
    this.selectedSchedule = null;
  }

  openAssignModal(schedule: MaintenanceScheduleResponseDTO): void {
    this.activeAssignSchedule = schedule;
    this.assignTechUserId = '';
    this.assignSeverity = 'MEDIUM';
  }

  closeAssignModal(): void {
    this.activeAssignSchedule = null;
  }

  confirmAssignment(): void {
    if (!this.activeAssignSchedule || !this.assignTechUserId) return;
    const scheduleId = this.activeAssignSchedule.scheduleId;
    const input = {
      userId: Number(this.assignTechUserId),
      severity: this.assignSeverity
    };

    this.apiService.assignByManager(scheduleId, input).subscribe({
      next: () => {
        this.successMessage = `Technician successfully assigned to Request #${scheduleId}!`;
        setTimeout(() => this.successMessage = '', 4000);
        this.closeAssignModal();
        this.loadSchedules();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Assignment failed.';
        setTimeout(() => this.errorMessage = '', 4000);
        this.closeAssignModal();
      }
    });
  }

  openStatusModal(schedule: MaintenanceScheduleResponseDTO): void {
    this.activeStatusSchedule = schedule;
    this.updateStatusValue = 'IN_PROGRESS';
    this.updateRemarksValue = '';
  }

  closeStatusModal(): void {
    this.activeStatusSchedule = null;
  }

  confirmStatusUpdate(): void {
    if (!this.activeStatusSchedule || !this.userId) return;
    const scheduleId = this.activeStatusSchedule.scheduleId;
    
    const statusInput = { status: this.updateStatusValue };
    this.apiService.updateByTechnician(scheduleId, this.userId, statusInput).subscribe({
      next: () => {
        if (this.updateRemarksValue) {
          const logInput = {
            scheduleId,
            remarks: this.updateRemarksValue
          };
          this.apiService.addMaintenanceLog(logInput).subscribe(() => {
            this.successMessage = 'Progress status and work log successfully updated!';
            setTimeout(() => this.successMessage = '', 4000);
            this.closeStatusModal();
            this.loadSchedules();
          });
        } else {
          this.successMessage = 'Progress status successfully updated!';
          setTimeout(() => this.successMessage = '', 4000);
          this.closeStatusModal();
          this.loadSchedules();
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to update schedule progress.';
        setTimeout(() => this.errorMessage = '', 4000);
        this.closeStatusModal();
      }
    });
  }
}
