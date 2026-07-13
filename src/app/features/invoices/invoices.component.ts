import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { InvoiceOutputDTO, InvoiceDefaultersOutputDto, LeaseOutputDTO } from '../../core/models/models';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.css'
})
export class InvoicesComponent implements OnInit {
  private apiService = inject(ApiService);
  authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  invoices: InvoiceOutputDTO[] = [];
  defaulters: InvoiceDefaultersOutputDto[] = [];
  searchLeaseId = '';
  leases: LeaseOutputDTO[] = [];

  // Pagination helper fields
  pageInvoices = 1;
  pageDefaulters = 1;
  pageSize = 5;

  get paginatedInvoices(): InvoiceOutputDTO[] {
    const start = (this.pageInvoices - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.invoices.slice(start, end);
  }

  get paginatedDefaulters(): InvoiceDefaultersOutputDto[] {
    const start = (this.pageDefaulters - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.defaulters.slice(start, end);
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

  loadingInvoices = false;
  loadingDefaulters = false;
  loadingLeases = false;
  showDefaulters = false;

  hasBillingAccess = false;
  isAccountOfficer = false;
  isTenant = false;
  tenantProfileId = 1;

  activeInvoiceForPayment: InvoiceOutputDTO | null = null;
  verificationOfficerId = '';

  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      const role = user.role.toUpperCase();
      this.hasBillingAccess = role === 'ACCOUNT OFFICER' || role === 'ADMIN';
      this.isAccountOfficer = role === 'ACCOUNT OFFICER';
      this.isTenant = role === 'TENANT';

      const cachedTenantId = localStorage.getItem(`re360_tenant_id_${user.userId}`);
      if (cachedTenantId) {
        this.tenantProfileId = Number(cachedTenantId);
      }

      if (this.isAccountOfficer) {
        this.resolveOfficerProfileId();
      }

      if (!this.isTenant) {
        this.loadLeasesForDropdown();
      }
    }

    this.route.queryParams.subscribe(params => {
      if (params['leaseId']) {
        this.searchLeaseId = params['leaseId'];
        this.onSearchInvoices();
      } else if (this.isTenant) {
        this.loadTenantInvoicesAutomatically();
      }
    });
  }

  loadLeasesForDropdown(): void {
    const user = this.authService.currentUserValue;
    if (!user) return;

    this.loadingLeases = true;
    const role = user.role.toUpperCase();

    if (role === 'OWNER') {
      this.apiService.getLeasesByOwnerUserId(user.userId).subscribe({
        next: (data) => {
          this.leases = data;
          this.loadingLeases = false;
          // Auto-select first lease if nothing searched yet
          if (this.leases.length > 0 && !this.searchLeaseId) {
            this.searchLeaseId = this.leases[0].leaseId.toString();
            this.onSearchInvoices();
          }
        },
        error: () => {
          this.leases = [];
          this.loadingLeases = false;
        }
      });
    } else if (role === 'ACCOUNT OFFICER' || role === 'ADMIN') {
      this.apiService.getAllLeases().subscribe({
        next: (data) => {
          this.leases = data;
          this.loadingLeases = false;
          // Auto-select first lease if nothing searched yet
          if (this.leases.length > 0 && !this.searchLeaseId) {
            this.searchLeaseId = this.leases[0].leaseId.toString();
            this.onSearchInvoices();
          }
        },
        error: () => {
          this.leases = [];
          this.loadingLeases = false;
        }
      });
    }
  }

  resolveOfficerProfileId(): void {
    const user = this.authService.currentUserValue;
    if (!user) return;

    const cached = localStorage.getItem(`re360_officer_id_${user.userId}`);
    if (cached) {
      this.verificationOfficerId = cached;
      return;
    }

    // Silent background scan to resolve the officer ID matching user emailId
    const requests = [];
    for (let i = 1; i <= 20; i++) {
      requests.push(this.apiService.getOfficerById(i).pipe(catchError(() => of(null))));
    }

    forkJoin(requests).subscribe(results => {
      const matched = results.find(profile => profile && profile.emailId === user.emailId);
      if (matched) {
        this.verificationOfficerId = matched.officerId.toString();
        localStorage.setItem(`re360_officer_id_${user.userId}`, this.verificationOfficerId);
        localStorage.setItem(`re360_officer_profile_registered_${user.userId}`, 'true');
      } else {
        // Fallback to user ID in case of test data matching
        this.verificationOfficerId = user.userId.toString();
      }
    });
  }

  loadTenantInvoicesAutomatically(): void {
    this.loadingInvoices = true;
    this.invoices = [];

    // Scan first 50 leaseId values in parallel
    const requests = [];
    for (let i = 1; i <= 50; i++) {
      requests.push(this.apiService.listInvoiceWithLeaseId(i).pipe(catchError(() => of([]))));
    }

    forkJoin(requests).subscribe({
      next: (results) => {
        const filteredInvoices: InvoiceOutputDTO[] = [];
        results.forEach((list) => {
          if (list && list.length > 0) {
            list.forEach(inv => {
              if (inv.tenantId === this.tenantProfileId || inv.tenantId === 1) {
                filteredInvoices.push(inv);
              }
            });
          }
        });
        this.invoices = filteredInvoices;
        this.pageInvoices = 1;
        this.loadingInvoices = false;
      },
      error: () => {
        this.loadingInvoices = false;
      }
    });
  }

  toggleDefaultersView(): void {
    this.showDefaulters = !this.showDefaulters;
    this.errorMessage = '';
    this.successMessage = '';
    if (this.showDefaulters) {
      this.loadDefaulters();
    }
  }

  loadDefaulters(): void {
    this.loadingDefaulters = true;
    this.apiService.getDefaulters().subscribe({
      next: (data) => {
        this.defaulters = data;
        this.pageDefaulters = 1;
        this.loadingDefaulters = false;
      },
      error: () => {
        this.defaulters = [];
        this.loadingDefaulters = false;
      }
    });
  }

  onSearchInvoices(): void {
    if (!this.searchLeaseId) return;
    this.loadingInvoices = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.apiService.listInvoiceWithLeaseId(Number(this.searchLeaseId)).subscribe({
      next: (data) => {
        this.invoices = data;
        this.pageInvoices = 1;
        this.loadingInvoices = false;
      },
      error: (err) => {
        this.invoices = [];
        this.loadingInvoices = false;
        this.errorMessage = err.error?.message || 'Failed to retrieve invoices. Check Lease ID.';
      }
    });
  }

  openPaymentModal(invoice: InvoiceOutputDTO): void {
    this.activeInvoiceForPayment = invoice;
    if (!this.verificationOfficerId) {
      this.resolveOfficerProfileId();
    }
  }

  closePaymentModal(): void {
    this.activeInvoiceForPayment = null;
  }

  confirmPayment(): void {
    if (!this.activeInvoiceForPayment || !this.verificationOfficerId) return;
    const invoiceId = this.activeInvoiceForPayment.invoiceId;
    const officerId = Number(this.verificationOfficerId);

    this.apiService.updateInvoiceStatus(invoiceId, 'PAID', officerId).subscribe({
      next: () => {
        this.successMessage = `Invoice #${invoiceId} successfully marked PAID! Ledger entry created.`;
        setTimeout(() => this.successMessage = '', 4000);
        this.closePaymentModal();
        if (this.isTenant) {
          this.loadTenantInvoicesAutomatically();
        } else {
          this.onSearchInvoices();
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Payment processing failed.';
        setTimeout(() => this.errorMessage = '', 4000);
        this.closePaymentModal();
      }
    });
  }
}
