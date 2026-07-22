import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { LedgerEntryOutputDto } from '../../core/models/models';

export interface LedgerEntry {
  ledgerId: number | string;
  invoiceId: number | string;
  officerName?: string;
  officerId?: number | string;
  unitType: string;
  amountPaid: number;
  gstPercent: number;
  gstAmount: number;
  profitPercent: number;
  profitAmount: number;
  loggedDate: string | Date;
}

@Component({
  selector: 'app-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ledger.component.html',
  styleUrls: ['./ledger.component.css']
})
export class LedgerComponent implements OnInit {
  private apiService = inject(ApiService);

  // Query Filters
  queryMonth: number = 7;
  queryYear: number = 2026;

  // UI States
  errorMessage: string = '';
  loading: boolean = false;
  searched: boolean = false;

  // Data State
  entries: LedgerEntry[] = [];

  // Metrics
  totalCollected: number = 0;
  totalGstCollected: number = 0;
  totalProfit: number = 0;
  averageProfitPercent: number = 0;

  // Pagination State
  page: number = 1;
  pageSize: number = 5;

  // Report Modal State
  showReport: boolean = false;
  reportMode: 'month' | 'year' = 'month';
  loadingReportData: boolean = false;
  activeReportYear: number = 2026;
  monthlyRevenueData: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  ngOnInit(): void {
    this.onQueryLedger();
  }

  onQueryLedger(): void {
    this.errorMessage = '';
    this.searched = true;
    this.loading = true;
    this.page = 1;

    const month = Number(this.queryMonth);
    const year = Number(this.queryYear);

    this.apiService.getLedgerEntriesByMonthAndYear(month, year).subscribe({
      next: (data: LedgerEntryOutputDto[]) => {
        this.processApiResponse(data);
        this.loading = false;
      },
      error: (err) => {
        console.error('Backend Ledger Fetch Error:', err);
        this.errorMessage = err?.error?.message || 'Failed to fetch ledger records from backend.';
        this.entries = [];
        this.calculateMetrics();
        this.loading = false;
      }
    });
  }

  processApiResponse(apiData: LedgerEntryOutputDto[]): void {
    if (!Array.isArray(apiData)) {
      this.entries = [];
      this.calculateMetrics();
      return;
    }

    this.entries = apiData.map((item: any) => {
      const grossPaid = Number(item.amountPaid ?? item.rentCollected ?? 0);
      const gstPercent = Number(item.gstPercent ?? item.gstRate ?? 0);
      
      // Calculate base rent from total collection (e.g., 56000 / 1.12 = 50000)
      const baseRent = gstPercent > 0 ? grossPaid / (1 + gstPercent / 100) : grossPaid;
      
      // Calculate GST directly on base rent (e.g., 50000 * 0.12 = 6000)
      const gstAmount = baseRent * (gstPercent / 100);

      return {
        ledgerId: item.ledgerId ?? item.id ?? 'N/A',
        invoiceId: item.invoiceId ?? item.invoiceRef ?? 0,
        officerName: item.officerName || 'System Automated',
        officerId: item.officerId,
        unitType: item.unitType || 'STANDARD',
        amountPaid: grossPaid,        // Rent Collected (₹56,000.00)
        gstPercent: gstPercent,        // GST % (12%)
        gstAmount: gstAmount,          // Correct GST Collected (₹6,000.00)
        profitPercent: Number(item.profitPercent ?? 0),
        profitAmount: Number(item.profitAmount ?? 0),
        loggedDate: item.loggedDate || new Date()
      };
    });

    this.calculateMetrics();
  }

  calculateMetrics(): void {
    if (!this.entries || this.entries.length === 0) {
      this.totalCollected = 0;
      this.totalGstCollected = 0;
      this.totalProfit = 0;
      this.averageProfitPercent = 0;
      return;
    }

    this.totalCollected = this.entries.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
    this.totalGstCollected = this.entries.reduce((acc, curr) => acc + (curr.gstAmount || 0), 0);
    this.totalProfit = this.entries.reduce((acc, curr) => acc + (curr.profitAmount || 0), 0);

    const sumProfitPercent = this.entries.reduce((acc, curr) => acc + (curr.profitPercent || 0), 0);
    this.averageProfitPercent = sumProfitPercent / this.entries.length;
  }

  // --- REPORT GENERATION LOGIC ---

  generateReport(): void {
    this.activeReportYear = Number(this.queryYear);
    this.showReport = true;
    this.setReportMode('month');
  }

  setReportMode(mode: 'month' | 'year'): void {
    this.reportMode = mode;
    if (mode === 'year') {
      this.fetchYearlyData(this.activeReportYear);
    }
  }

  fetchYearlyData(year: number): void {
    this.loadingReportData = true;

    // Create 12 requests (Months 1 through 12) to query the single monthly API
    const requests = Array.from({ length: 12 }, (_, index) => {
      const monthNum = index + 1;
      return this.apiService.getLedgerEntriesByMonthAndYear(monthNum, year).pipe(
        catchError(() => of([])) // Catch empty months gracefully
      );
    });

    forkJoin(requests).subscribe({
      next: (results: LedgerEntryOutputDto[][]) => {
        this.monthlyRevenueData = results.map(monthEntries => {
          if (!Array.isArray(monthEntries)) return 0;
          return monthEntries.reduce((sum, item: any) => sum + Number(item.amountPaid ?? item.rentCollected ?? 0), 0);
        });
        this.loadingReportData = false;
      },
      error: (err) => {
        console.error('Failed to load yearly data:', err);
        this.monthlyRevenueData = new Array(12).fill(0);
        this.loadingReportData = false;
      }
    });
  }

  // --- YEAR-WISE COMPUTED HELPERS ---

  getYearlyTotalRevenue(): number {
    return this.monthlyRevenueData.reduce((a, b) => a + b, 0);
  }

  getYearlyTotalGst(): number {
    return this.getYearlyTotalRevenue() * 0.18;
  }

  getYearlyTotalProfit(): number {
    return this.getYearlyTotalRevenue() * 0.10;
  }

  getYearlyProfitPercent(): number {
    return 10;
  }

  getLinePoints(data: number[]): string {
    if (!data || data.length === 0) return '';
    const max = Math.max(...data, 1);
    return data.map((val, idx) => {
      const x = 25 + idx * 30;
      const y = 130 - (val / max) * 90;
      return `${x},${y}`;
    }).join(' ');
  }

  getLineNodes(data: number[]) {
    if (!data) return [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const max = Math.max(...data, 1);
    return data.map((val, idx) => ({
      x: 25 + idx * 30,
      y: 130 - (val / max) * 90,
      val,
      month: months[idx]
    }));
  }

  // --- GENERAL HELPERS & PAGINATION ---

  get paginatedEntries(): LedgerEntry[] {
    const startIndex = (this.page - 1) * this.pageSize;
    return this.entries.slice(startIndex, startIndex + this.pageSize);
  }

  totalPages(totalLength: number): number {
    return Math.ceil(totalLength / this.pageSize);
  }

  getPages(totalLength: number): number[] {
    const count = this.totalPages(totalLength);
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  getMonthName(monthNum: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[Number(monthNum) - 1] || '';
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  exportPDF(): void {
    window.print();
  }

  getTopEntries(): LedgerEntry[] {
    return [...this.entries]
      .sort((a, b) => b.amountPaid - a.amountPaid)
      .slice(0, 5);
  }

  getBarHeight(val: number): number {
    const maxVal = Math.max(...this.entries.map(e => e.amountPaid), 1);
    return Math.round((val / maxVal) * 100);
  }
}