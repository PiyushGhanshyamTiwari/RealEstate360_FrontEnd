import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { 
  UnitOutputDTO, 
  ApplicationOutputDTO, 
  InvoiceOutputDTO, 
  LeaseOutputDTO, 
  TenantProfileOutputDTO 
} from '../../core/models/models';
 
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
  tenantProfileId: number | null = null;
 
  // Owner bindings
  ownerUnits: UnitOutputDTO[] = [];
  selectedUnitId = '';
  associatedApp: ApplicationOutputDTO | null = null;
  loadingApps = false;
  isAlreadyAgreed = false;
 
  // Tenant bindings
  allUnitsMap: Map<number, UnitOutputDTO> = new Map();
  tenantLeases: SimulatedLease[] = [];
  selectedTenantLeaseId: number | null = null;
  tenantLease: SimulatedLease | null = null;
  tenantInvoicesMap: Map<number, InvoiceOutputDTO[]> = new Map();
  tenantInvoices: InvoiceOutputDTO[] = [];
  loadingLeases = false;
 
  // Pagination fields
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
      // If tenantId was saved inside currentUser token/object, read it directly
      this.tenantProfileId = (user as any).tenantId || (user as any).tenantProfileId || null;
 
      const role = user.role.toUpperCase();
      this.isOwner = role === 'OWNER';
      this.isTenant = role === 'TENANT';
    }
 
    this.leaseForm = this.fb.group({
      leaseId: [{ value: '', disabled: false }, [Validators.required, Validators.min(1)]],
      status: [{ value: '', disabled: false }, Validators.required]
    });
 
    if (this.isOwner) {
      this.loadOwnerUnits();
    } else if (this.isTenant) {
      this.resolveTenantAndLoadData();
    }
  }
 
  get f() { return this.leaseForm.controls; }
 
  // --- TENANT PROFILE & LEASE RESOLUTION ---
  private resolveTenantAndLoadData(): void {
    if (!this.userId) return;
 
    this.loadingLeases = true;
    console.log('Current Logged-In User ID:', this.userId);
 
    // If tenantProfileId is already present on user auth object
    if (this.tenantProfileId) {
      console.log('Tenant Profile ID found in Auth context:', this.tenantProfileId);
      this.loadUnitsAndFetchLeases();
      return;
    }
 
    // Try API mapping userId -> tenantProfileId
    this.apiService.getTenantByUserId(this.userId).pipe(
      catchError((err) => {
        console.warn('getTenantByUserId failed (403/404), trying getAllTenants fallback...', err);
        return this.apiService.getAllTenants().pipe(
          switchMap((tenants: any[]) => {
            const found = tenants.find(t => 
              t.userId === this.userId || 
              t.user?.userId === this.userId || 
              t.user_id === this.userId
            );
            return of(found || null);
          }),
          catchError(() => of(null))
        );
      }),
      switchMap((tenantProfile: any) => {
        if (tenantProfile && (tenantProfile.tenantId || tenantProfile.id)) {
          this.tenantProfileId = tenantProfile.tenantId || tenantProfile.id;
          console.log('Mapped tenantProfileId:', this.tenantProfileId);
        } else {
          console.warn('Could not map tenantProfileId. Will attempt query via userId:', this.userId);
        }
        return of(null);
      })
    ).subscribe(() => {
      this.loadUnitsAndFetchLeases();
    });
  }
 
  private loadUnitsAndFetchLeases(): void {
    this.apiService.getAllUnits().pipe(
      catchError(() => of([]))
    ).subscribe((units) => {
      units.forEach(u => this.allUnitsMap.set(u.unitId, u));
      this.fetchTenantLeasesAndInvoices();
    });
  }
 
  private fetchTenantLeasesAndInvoices(): void {
    if (!this.userId) {
      this.loadingLeases = false;
      return;
    }
 
    this.tenantLeases = [];
 
    // Prioritize querying by tenantProfileId (e.g., 2), fallback to userId (e.g., 9)
    const primaryId = this.tenantProfileId || this.userId;
 
    this.apiService.getLeasesByTenantId(primaryId).pipe(
      switchMap((leases) => {
        // If primary query returned empty and tenantProfileId exists, try query by userId
        if ((!leases || leases.length === 0) && this.tenantProfileId && this.tenantProfileId !== this.userId) {
          console.log(`No leases found for tenantId ${this.tenantProfileId}, trying fallback query for userId ${this.userId}...`);
          return this.apiService.getLeasesByTenantId(this.userId!);
        }
        return of(leases);
      }),
      catchError(() => of([] as LeaseOutputDTO[]))
    ).subscribe((leases) => {
      console.log('Final Leases Received from API:', leases);
 
      leases.forEach(lease => {
        const matchedUnit = this.allUnitsMap.get(lease.unitId);
 
        this.tenantLeases.push({
          leaseId: lease.leaseId,
          tenantId: lease.tenantId,
          unitId: lease.unitId,
          unitType: matchedUnit?.type || 'Unit',
          propertyName: matchedUnit?.propertyName || '',
          startDate: lease.startDate,
          endDate: lease.endDate,
          status: lease.status,
          amountDue: lease.rentAmount || 0
        });
 
        // Load invoices tied to leaseId
        this.apiService.listInvoiceWithLeaseId(lease.leaseId).pipe(
          catchError(() => of([]))
        ).subscribe(invoices => {
          if (invoices && invoices.length > 0) {
            this.tenantInvoicesMap.set(lease.leaseId, invoices);
            if (this.selectedTenantLeaseId === lease.leaseId) {
              this.tenantInvoices = invoices;
            }
          }
        });
      });
 
      // Select first lease contract by default
      if (this.tenantLeases.length > 0) {
        this.selectedTenantLeaseId = this.tenantLeases[0].leaseId;
        this.onTenantLeaseSelect();
      }
 
      this.loadingLeases = false;
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
        const approved = apps.find(a => a.status === 'Approved' || a.status === 'Agreed');
        if (approved) {
          this.associatedApp = approved;
          this.leaseForm.patchValue({ leaseId: approved.applicationId });
 
          if (selectedUnit?.status?.toUpperCase() === 'LEASED' || approved.status === 'Agreed') {
            this.lockFormAsAgreed();
          } else {
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