import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { InvoiceOutputDTO, InvoiceDefaultersOutputDto, LeaseOutputDTO, UnitOutputDTO } from '../../core/models/models';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface TenantLeaseOption {
  leaseId: number;
  unitId?: number;
  unitType?: string;
  rentAmount?: number;
}

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
  tenantLeaseOptions: TenantLeaseOption[] = [];

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

      if (this.isTenant) {
        this.loadTenantLeasesAndInvoices();
      } else {
        this.loadLeasesForDropdown();
      }
    }

    this.route.queryParams.subscribe(params => {
      if (params['leaseId']) {
        this.searchLeaseId = params['leaseId'];
        this.onSearchInvoices();
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

  loadTenantLeasesAndInvoices(): void {
    this.loadingLeases = true;
    this.loadingInvoices = true;
    this.tenantLeaseOptions = [];

    this.apiService.getAllUnits().subscribe({
      next: (units) => {
        const unitsMap = new Map<number, UnitOutputDTO>();
        units.forEach(u => unitsMap.set(u.unitId, u));

        const requests = [];
        for (let i = 1; i <= 50; i++) {
          requests.push(this.apiService.listInvoiceWithLeaseId(i).pipe(catchError(() => of([]))));
        }

        forkJoin(requests).subscribe({
          next: (results) => {
            const options: TenantLeaseOption[] = [];
            results.forEach((list, index) => {
              const leaseId = index + 1;
              if (list && list.length > 0) {
                const isMine = list.some(inv => inv.tenantId === this.tenantProfileId || inv.tenantId === 1);
                if (isMine) {
                  const matchedUnit = unitsMap.get(leaseId);
                  options.push({
                    leaseId: leaseId,
                    unitId: matchedUnit?.unitId || leaseId,
                    unitType: matchedUnit?.type || 'Unit',
                    rentAmount: list[0]?.amountDue || 0
                  });
                }
              }
            });

            this.tenantLeaseOptions = options;
            this.loadingLeases = false;

            if (this.tenantLeaseOptions.length > 0 && !this.searchLeaseId) {
              this.searchLeaseId = this.tenantLeaseOptions[0].leaseId.toString();
            }
            
            if (this.searchLeaseId) {
              this.onSearchInvoices();
            } else {
              this.loadingInvoices = false;
            }
          },
          error: () => {
            this.loadingLeases = false;
            this.loadingInvoices = false;
          }
        });
      },
      error: () => {
        this.loadingLeases = false;
        this.loadingInvoices = false;
      }
    });
  }

  resolveOfficerProfileId(): void {
    const user = this.authService.currentUserValue;
    if (!user) return;

    const cached = localStorage.getItem(`re360_officer_id_${user.userId}`);
    if (cached) {
      this.verificationOfficerId = cached;
      return;
    }

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
        this.verificationOfficerId = user.userId.toString();
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
        
        // Re-fetch from the database to get the newly updated timestamp saved by Spring Boot
        this.onSearchInvoices();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Payment processing failed.';
        setTimeout(() => this.errorMessage = '', 4000);
        this.closePaymentModal();
      }
    });
  }

  downloadInvoicePDF(inv: InvoiceOutputDTO): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked! Please allow pop-ups for this site to download the invoice.');
      return;
    }

    // Retrieve unit type from lease option list or fallback
    const matchedOption = this.tenantLeaseOptions.find(o => o.leaseId === inv.leaseId);
    const unitType = (matchedOption?.unitType || 'VILLA').toUpperCase();

    // Calculate GST percentage matching Backend getGstPercent logic
    let gstPercent = 12.0;
    if (unitType === 'APARTMENT' || unitType === 'STUDIO') {
      gstPercent = 5.0;
    } else if (unitType === 'VILLA' || unitType === 'OFFICE' || unitType === 'COMMERCIAL') {
      gstPercent = 12.0;
    }

    const baseRent = inv.amountDue;
    const gstAmount = (baseRent * gstPercent) / 100;
    const totalPaid = baseRent + gstAmount;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice #${inv.invoiceId}</title>
        <style>
          body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 40px; color: #0f172a; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0056df; padding-bottom: 20px; margin-bottom: 40px; }
          .logo { font-size: 28px; font-weight: 800; color: #0056df; letter-spacing: -0.02em; }
          .title { font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
          .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .details div { width: 45%; }
          .details h4 { margin: 0 0 10px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
          .details p { margin: 0 0 6px 0; font-size: 14px; line-height: 1.5; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          .table th, .table td { padding: 14px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .table th { background: #f8fafc; font-weight: 600; color: #475569; }
          .total-box { display: flex; justify-content: flex-end; margin-top: 30px; }
          .total-table { width: 320px; border-collapse: collapse; }
          .total-table td { padding: 10px 14px; font-size: 14px; }
          .total-table tr.grand-total { font-weight: 700; font-size: 18px; color: #0056df; border-top: 2px solid #cbd5e1; }
          .badge-paid { background: #dcfce7; color: #15803d; padding: 5px 12px; border-radius: 50px; font-size: 12px; font-weight: 700; text-transform: uppercase; display: inline-block; border: 1px solid #bbf7d0; }
          .footer { text-align: center; margin-top: 80px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; line-height: 1.5; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">RealEstate360</div>
          <div class="title">INVOICE RECEIPT</div>
        </div>
        <div class="details">
          <div>
            <h4>Billing From</h4>
            <p><strong>RealEstate360 Properties Ltd.</strong></p>
            <p>99acres Tower, Sector 62</p>
            <p>Noida, Uttar Pradesh, India</p>
            <p>Email: billing@realestate360.com</p>
          </div>
          <div>
            <h4>Invoice Info</h4>
            <p><strong>Invoice ID:</strong> #${inv.invoiceId}</p>
            <p><strong>Lease ID:</strong> Lease #${inv.leaseId}</p>
            <p><strong>Paid Date:</strong> ${new Date(inv.generatedAt).toLocaleString()}</p>
            <p><strong>Status:</strong> <span class="badge-paid">Paid</span></p>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Billing Period</th>
              <th style="text-align: right;">Base Rent</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Rental Payment Charge (${unitType})</strong><br>
                <span style="font-size: 12px; color: #64748b;">Lease contract monthly installment fee</span>
              </td>
              <td>From ${new Date(inv.periodStart).toLocaleDateString()} to ${new Date(inv.periodEnd).toLocaleDateString()}</td>
              <td style="text-align: right; font-weight: 700;">₹ ${baseRent.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div class="total-box">
          <table class="total-table">
            <tr>
              <td>Subtotal (Base Rent):</td>
              <td style="text-align: right;">₹ ${baseRent.toFixed(2)}</td>
            </tr>
            <tr>
              <td>GST (${gstPercent}%):</td>
              <td style="text-align: right;">₹ ${gstAmount.toFixed(2)}</td>
            </tr>
            <tr class="grand-total">
              <td>Total Paid:</td>
              <td style="text-align: right;">₹ ${totalPaid.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        <div class="footer">
          Thank you for your prompt payment. This is a computer generated receipt, no signature required.<br>
          RealEstate360 Property Management Platform.
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 1000);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}