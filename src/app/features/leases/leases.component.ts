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

  // Tenant bindings
  tenantLease: SimulatedLease | null = null;
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
      leaseId: ['', [Validators.required, Validators.min(1)]],
      status: ['', Validators.required]
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
      // Filter units belonging to Owner
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
    this.leaseForm.patchValue({ leaseId: '' });

    this.apiService.getApplicationsByUnitId(Number(this.selectedUnitId)).subscribe({
      next: (apps) => {
        // Find approved application
        const approved = apps.find(a => a.status === 'Approved');
        if (approved) {
          this.associatedApp = approved;
          // Set Lease ID default to Application ID
          this.leaseForm.patchValue({ leaseId: approved.applicationId });
        }
        this.loadingApps = false;
      },
      error: () => {
        this.loadingApps = false;
      }
    });
  }

  // --- TENANT METHODS ---
  loadTenantLeaseAndInvoices(): void {
    this.loadingLeases = true;
    this.tenantLease = null;
    this.tenantInvoices = [];

    // Scan first 50 leaseId values in parallel
    const requests = [];
    for (let i = 1; i <= 50; i++) {
      requests.push(this.apiService.listInvoiceWithLeaseId(i).pipe(catchError(() => of([]))));
    }

    forkJoin(requests).subscribe({
      next: (results) => {
        let matchingLeaseId = null;

        results.forEach((invoices, index) => {
          const leaseId = index + 1;
          if (invoices && invoices.length > 0) {
            const firstInv = invoices[0];
            const isMine = firstInv.tenantId === this.tenantProfileId || firstInv.tenantId === 1;
            
            if (isMine) {
              matchingLeaseId = leaseId;
              this.tenantInvoices = invoices;
              this.page = 1;
              this.tenantLease = {
                leaseId: leaseId,
                tenantId: firstInv.tenantId,
                startDate: firstInv.periodStart,
                endDate: invoices[invoices.length - 1].periodEnd,
                status: 'Agreed', // If invoices exist, status has been Agreed
                amountDue: firstInv.amountDue
              };
            }
          }
        });

        // If no agreed lease found via invoices, check approved applications to show review lease
        if (!matchingLeaseId && this.userId) {
          this.apiService.getApplicationByTenantId(this.userId).subscribe(apps => {
            const approvedApp = apps.find(a => a.status === 'Approved');
            if (approvedApp) {
              this.tenantLease = {
                leaseId: approvedApp.applicationId, // Estimate leaseId as applicationId
                tenantId: this.tenantProfileId,
                startDate: approvedApp.startDate.toString(),
                endDate: approvedApp.endDate.toString(),
                status: 'Review',
                amountDue: 0
              };
            }
            this.loadingLeases = false;
          });
        } else {
          this.loadingLeases = false;
        }
      },
      error: () => {
        this.loadingLeases = false;
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.leaseForm.invalid) {
      return;
    }

    this.submitting = true;
    const { leaseId, status } = this.leaseForm.value;

    this.apiService.updateLeaseStatus(Number(leaseId), status).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = `Lease agreement #${leaseId} successfully set to ${status}!`;
        this.leaseForm.reset();
        this.submitted = false;
        this.associatedApp = null;
        this.selectedUnitId = '';
        this.loadOwnerUnits(); // Reload
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to update lease status. Verify the lease ID exists.';
      }
    });
  }
}
