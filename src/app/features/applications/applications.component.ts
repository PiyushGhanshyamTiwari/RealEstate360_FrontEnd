import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApplicationInputDTO, ApplicationOutputDTO, UnitOutputDTO } from '../../core/models/models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './applications.component.html',
  styleUrl: './applications.component.css'
})
export class ApplicationsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  authService = inject(AuthService);

  applications: ApplicationOutputDTO[] = [];
  availableUnits: UnitOutputDTO[] = [];
  ownerUnits: UnitOutputDTO[] = [];
  loading = true;

  // Track selected unit available date for UI constraints and messages
  selectedUnitAvailableDate: string | null = null;
  maxEndDateConstraint: string | null = null;

  // Pagination helper fields
  page = 1;
  pageSize = 5;

  get paginatedApplications(): ApplicationOutputDTO[] {
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.applications.slice(start, end);
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  totalPages(totalItems: number): number {
    return Math.ceil(totalItems / this.pageSize);
  }

  getPages(totalItems: number): number[] {
    const total = this.totalPages(totalItems);
    const pages = [];
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  isTenant = false;
  isOwner = false;
  userId: number | null = null;

  showApplyForm = false;
  applyForm!: FormGroup;
  submitted = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  ownerSelectedUnitId = '';

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.userId = user.userId;
      this.isTenant = user.role.toUpperCase() === 'TENANT';
      this.isOwner = user.role.toUpperCase() === 'OWNER';
    }

    // Initialize Reactive Form
    this.applyForm = this.fb.group({
      unitId: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required]
    }, { validators: this.dateRangeValidator.bind(this) });

    const prefilledUnitId = this.route.snapshot.queryParams['applyUnitId'];
    if (prefilledUnitId) {
      this.showApplyForm = true;
      this.applyForm.patchValue({ unitId: Number(prefilledUnitId) });
    }

    if (this.isTenant) {
      this.loadTenantApplications();
      this.loadAvailableUnits();
    } else if (this.isOwner) {
      this.loadOwnerUnits();
    } else {
      this.loadAllApplications();
    }
  }

  get fa() { return this.applyForm.controls; }

  // Helper method to convert ISO strings, Date objects, or backend Arrays [YYYY, MM, DD] to "YYYY-MM-DD"
  private formatDateToISO(dateVal: any): string | null {
    if (!dateVal) return null;
    if (Array.isArray(dateVal)) {
      const [year, month, day] = dateVal;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    if (typeof dateVal === 'string') {
      return dateVal.split('T')[0];
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }

  // Safe Form-Level Custom Validator (Returns errors directly to avoid infinite loops)
  dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const unitId = group.get('unitId')?.value;
    const startDateVal = group.get('startDate')?.value;
    const endDateVal = group.get('endDate')?.value;

    if (!unitId || !startDateVal) {
      return null;
    }

    const errors: ValidationErrors = {};
    const selectedUnit = this.availableUnits?.find(u => u.unitId === Number(unitId));

    // 1. Validate Start Date >= Unit availableFrom Date
    if (selectedUnit && selectedUnit.availableFrom && startDateVal) {
      const availIso = this.formatDateToISO(selectedUnit.availableFrom);
      if (availIso) {
        const unitAvailDate = new Date(availIso);
        const startDate = new Date(startDateVal);

        unitAvailDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);

        if (startDate < unitAvailDate) {
          errors['startDateBeforeAvailable'] = true;
        }
      }
    }

    // 2. Validate End Date range
    if (startDateVal && endDateVal) {
      const startDate = new Date(startDateVal);
      const endDate = new Date(endDateVal);

      if (endDate <= startDate) {
        errors['endDateBeforeStart'] = true;
      } else {
        const maxEndDate = new Date(startDate);
        maxEndDate.setFullYear(maxEndDate.getFullYear() + 1);

        if (endDate > maxEndDate) {
          errors['exceedsOneYear'] = true;
        }
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  // Helper called on UI change to set HTML date constraints
  onUnitOrDateSelect(): void {
    const unitId = this.applyForm?.get('unitId')?.value;
    const startDateVal = this.applyForm?.get('startDate')?.value;

    const selectedUnit = this.availableUnits?.find(u => u.unitId === Number(unitId));
    this.selectedUnitAvailableDate = selectedUnit?.availableFrom ? this.formatDateToISO(selectedUnit.availableFrom) : null;

    if (startDateVal) {
      const start = new Date(startDateVal);
      if (!isNaN(start.getTime())) {
        start.setFullYear(start.getFullYear() + 1);
        this.maxEndDateConstraint = start.toISOString().split('T')[0];
      }
    } else {
      this.maxEndDateConstraint = null;
    }
  }

  toggleApplyForm(): void {
    this.showApplyForm = !this.showApplyForm;
    this.errorMessage = '';
    this.successMessage = '';
    this.submitted = false;
    if (!this.showApplyForm) {
      this.loadTenantApplications();
    }
  }

  loadAvailableUnits(): void {
    this.apiService.filterUnits(undefined, undefined, undefined, undefined, undefined, undefined, 'AVAILABLE').subscribe({
      next: (data) => {
        this.availableUnits = data || [];
        if (this.applyForm.get('unitId')?.value) {
          this.onUnitOrDateSelect();
        }
      },
      error: () => {
        this.availableUnits = [];
      }
    });
  }

  loadOwnerUnits(): void {
    if (!this.userId) {
      this.loading = false;
      return;
    }
    this.apiService.findPropertyByOwnerId(this.userId).subscribe({
      next: (properties) => {
        this.apiService.getAllUnits().subscribe({
          next: (units) => {
            this.ownerUnits = units.filter(u => properties.some(p => p.propertyId === u.propertyId));
            this.loading = false;
          },
          error: () => { this.loading = false; }
        });
      },
      error: () => { this.loading = false; }
    });
  }

  loadTenantApplications(): void {
    if (!this.userId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.apiService.getApplicationByTenantId(this.userId).subscribe({
      next: (data) => {
        this.applications = data || [];
        this.page = 1;
        this.loading = false;
      },
      error: () => {
        this.applications = [];
        this.loading = false;
      }
    });
  }

  loadAllApplications(): void {
    this.loading = true;
    this.apiService.getAllUnits().subscribe({
      next: (units) => {
        if (units && units.length > 0) {
          this.apiService.getApplicationsByUnitId(units[0].unitId).subscribe({
            next: (data) => {
              this.applications = data || [];
              this.page = 1;
              this.loading = false;
            },
            error: () => {
              this.applications = [];
              this.loading = false;
            }
          });
        } else {
          this.applications = [];
          this.loading = false;
        }
      },
      error: () => {
        this.applications = [];
        this.loading = false;
      }
    });
  }

  loadOwnerApplications(): void {
    if (!this.ownerSelectedUnitId) return;
    this.loading = true;
    this.apiService.getApplicationsByUnitId(Number(this.ownerSelectedUnitId)).subscribe({
      next: (data) => {
        this.applications = data || [];
        this.page = 1;
        this.loading = false;
      },
      error: () => {
        this.applications = [];
        this.loading = false;
      }
    });
  }

  onApplySubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.applyForm.invalid || !this.userId) {
      return;
    }

    this.submitting = true;
    const formValue = this.applyForm.value;
    const input: ApplicationInputDTO = {
      unitId: Number(formValue.unitId),
      userId: this.userId,
      startDate: formValue.startDate,
      endDate: formValue.endDate
    };

    this.apiService.submitApplication(input).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Lease application successfully submitted!';
        this.applyForm.reset();
        this.submitted = false;
        this.loadTenantApplications();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to submit application. Make sure the unit is AVAILABLE.';
      }
    });
  }

  onUpdateStatus(applicationId: number, status: string): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.apiService.updateStatusOfApplication(applicationId, status).subscribe({
      next: () => {
        this.successMessage = `Application successfully updated to ${status}!`;
        setTimeout(() => this.successMessage = '', 3000);
        if (this.isOwner) {
          this.loadOwnerApplications();
        } else {
          this.loadAllApplications();
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Failed to update application status.';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }
}