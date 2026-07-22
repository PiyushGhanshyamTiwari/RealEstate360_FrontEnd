import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UnitOutputDTO, ApplicationOutputDTO, InvoiceOutputDTO } from '../../core/models/models';

interface SimulatedLease {
  leaseId: number;
  tenantId: number;
  unitId?: number;
  unitType?: string;
  propertyName?: string;
  startDate: string;
  endDate: string;
  status: string;
  amountDue: number;
}

@Component({
  selector: 'app-leases',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './leases.component.html',
  styleUrl: './leases.component.css'
})
export class LeasesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  isOwner = false;
  isTenant = false;
  userId: number | null = null;
  tenantProfileId = 1;

  // Owner bindings
  ownerUnits: UnitOutputDTO[] = [];
  selectedUnitId = '';
  associatedApp: ApplicationOutputDTO | null = null;
  loadingApps = false;
  isAlreadyAgreed = false; // Controls locking owner update form permanently

  // Tenant bindings
  allUnitsMap: Map<number, UnitOutputDTO> = new Map();
  tenantLeases: SimulatedLease[] = [];
  selectedTenantLeaseId: number | null = null;
  tenantLease: SimulatedLease | null = null;
  tenantInvoicesMap: Map<number, InvoiceOutputDTO[]> = new Map();
  tenantInvoices: InvoiceOutputDTO[] = [];
  loadingLeases = false;

  // Pagination helper fields
  page = 1;
  pageSize = 5;

  get paginatedTenantInvoices(): InvoiceOutputDTO[] {
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.tenantInvoices.slice(start, end);
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

  leaseForm!: FormGroup;
  submitted = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.userId = user.userId;
      const role = user.role.toUpperCase();
      this.isOwner = role === 'OWNER';
      this.isTenant = role === 'TENANT';
      
      const cachedTenantId = localStorage.getItem(`re360_tenant_id_${user.userId}`);
      if (cachedTenantId) {
        this.tenantProfileId = Number(cachedTenantId);
      }
    }

    this.leaseForm = this.fb.group({
      leaseId: [{ value: '', disabled: false }, [Validators.required, Validators.min(1)]],
      status: [{ value: '', disabled: false }, Validators.required]
    });

    if (this.isOwner) {
      this.loadOwnerUnits();
    } else if (this.isTenant) {
      this.loadTenantLeaseAndInvoices();
    }
  }

  get f() { return this.leaseForm.controls; }

  // --- OWNER METHODS ---
  loadOwnerUnits(): void {
    this.apiService.getAllUnits().subscribe(units => {
      if (this.userId) {
        this.apiService.findPropertyByOwnerId(this.userId).subscribe(props => {
          const propIds = props.map(p => p.propertyId);
          this.ownerUnits = units.filter(u => propIds.includes(u.propertyId));
        });
      }
    });
  }

  onUnitSelectChange(): void {
    if (!this.selectedUnitId) return;
    this.loadingApps = true;
    this.associatedApp = null;
    this.isAlreadyAgreed = false;
    this.leaseForm.enable();
    this.leaseForm.patchValue({ leaseId: '', status: '' });

    const selectedUnit = this.ownerUnits.find(u => u.unitId === Number(this.selectedUnitId));

    this.apiService.getApplicationsByUnitId(Number(this.selectedUnitId)).subscribe({
      next: (apps) => {
        // Find approved or agreed application
        const approved = apps.find(a => a.status === 'Approved' || a.status === 'Agreed');
        if (approved) {
          this.associatedApp = approved;
          this.leaseForm.patchValue({ leaseId: approved.applicationId });

          // 1. Check if unit is already marked LEASED OR app status is Agreed
          if (selectedUnit?.status?.toUpperCase() === 'LEASED' || approved.status === 'Agreed') {
            this.lockFormAsAgreed();
          } else {
            // 2. Backup check: verify if invoices already exist for this lease ID
            this.apiService.listInvoiceWithLeaseId(approved.applicationId).pipe(
              catchError(() => of([]))
            ).subscribe(invoices => {
              if (invoices && invoices.length > 0) {
                this.lockFormAsAgreed();
              }
            });
          }
        }
        this.loadingApps = false;
      },
      error: () => {
        this.loadingApps = false;
      }
    });
  }

  private lockFormAsAgreed(): void {
    this.isAlreadyAgreed = true;
    this.leaseForm.patchValue({ status: 'Agreed' });
    this.leaseForm.disable();
  }

  // --- TENANT METHODS ---
  loadTenantLeaseAndInvoices(): void {
    this.loadingLeases = true;
    this.tenantLeases = [];
    this.tenantInvoicesMap.clear();

    // Fetch all units first to map unit details (unitId, type, propertyName)
    this.apiService.getAllUnits().subscribe({
      next: (units) => {
        units.forEach(u => this.allUnitsMap.set(u.unitId, u));
        this.fetchTenantData();
      },
      error: () => {
        this.fetchTenantData();
      }
    });
  }

  private fetchTenantData(): void {
    const requests = [];
    for (let i = 1; i <= 50; i++) {
      requests.push(this.apiService.listInvoiceWithLeaseId(i).pipe(catchError(() => of([]))));
    }

    forkJoin(requests).subscribe({
      next: (results) => {
        results.forEach((invoices, index) => {
          const leaseId = index + 1;
          if (invoices && invoices.length > 0) {
            const firstInv = invoices[0];
            const isMine = firstInv.tenantId === this.tenantProfileId || firstInv.tenantId === 1;
            
            if (isMine) {
              this.tenantInvoicesMap.set(leaseId, invoices);
              const matchedUnit = this.allUnitsMap.get(leaseId);

              this.tenantLeases.push({
                leaseId: leaseId,
                tenantId: firstInv.tenantId,
                unitId: matchedUnit?.unitId || leaseId,
                unitType: matchedUnit?.type || 'Unit',
                propertyName: matchedUnit?.propertyName || '',
                startDate: firstInv.periodStart,
                endDate: invoices[invoices.length - 1].periodEnd,
                status: 'Agreed',
                amountDue: firstInv.amountDue
              });
            }
          }
        });

        if (this.userId) {
          this.apiService.getApplicationByTenantId(this.userId).subscribe(apps => {
            apps.forEach(app => {
              if ((app.status === 'Approved' || app.status === 'Agreed') && !this.tenantLeases.some(l => l.leaseId === app.applicationId)) {
                const matchedUnit = this.allUnitsMap.get(app.unitId);

                this.tenantLeases.push({
                  leaseId: app.applicationId,
                  tenantId: this.tenantProfileId,
                  unitId: app.unitId,
                  unitType: matchedUnit?.type || 'Unit',
                  propertyName: matchedUnit?.propertyName || '',
                  startDate: app.startDate.toString(),
                  endDate: app.endDate.toString(),
                  status: app.status === 'Agreed' ? 'Agreed' : 'Review',
                  amountDue: 0
                });
              }
            });

            if (this.tenantLeases.length > 0) {
              this.selectedTenantLeaseId = this.tenantLeases[0].leaseId;
              this.onTenantLeaseSelect();
            }
            this.loadingLeases = false;
          });
        } else {
          if (this.tenantLeases.length > 0) {
            this.selectedTenantLeaseId = this.tenantLeases[0].leaseId;
            this.onTenantLeaseSelect();
          }
          this.loadingLeases = false;
        }
      },
      error: () => {
        this.loadingLeases = false;
      }
    });
  }

  onTenantLeaseSelect(): void {
    if (!this.selectedTenantLeaseId) {
      this.tenantLease = null;
      this.tenantInvoices = [];
      return;
    }

    const found = this.tenantLeases.find(l => l.leaseId === Number(this.selectedTenantLeaseId));
    this.tenantLease = found || null;
    this.tenantInvoices = this.tenantInvoicesMap.get(Number(this.selectedTenantLeaseId)) || [];
    this.page = 1;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.leaseForm.invalid || this.isAlreadyAgreed) {
      return;
    }

    this.submitting = true;
    const { leaseId, status } = this.leaseForm.getRawValue();

    this.apiService.updateLeaseStatus(Number(leaseId), status).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = `Lease agreement #${leaseId} successfully set to ${status}!`;
        
        if (status === 'Agreed') {
          this.lockFormAsAgreed();
        } else {
          this.leaseForm.reset();
          this.submitted = false;
          this.associatedApp = null;
          this.selectedUnitId = '';
        }
        this.loadOwnerUnits();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to update lease status. Verify the lease ID exists.';
      }
    });
  }
}