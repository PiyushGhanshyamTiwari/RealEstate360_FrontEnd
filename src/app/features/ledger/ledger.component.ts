import { Component, inject, OnInit } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { LedgerEntryOutputDto } from '../../core/models/models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ledger.component.html',
  styleUrl: './ledger.component.css'
})
export class LedgerComponent implements OnInit {
  private apiService = inject(ApiService);

  queryMonth = (new Date().getMonth() + 1).toString();
  queryYear = new Date().getFullYear();

  entries: LedgerEntryOutputDto[] = [];
  searched = false;
  errorMessage = '';

  // Pagination helper fields
  page = 1;
  pageSize = 5;

  get paginatedEntries(): LedgerEntryOutputDto[] {
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.entries.slice(start, end);
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

  totalCollected = 0;
  totalProfit = 0;
  averageProfitPercent = 0;

  ngOnInit(): void {
    this.onQueryLedger();
  }

  onQueryLedger(): void {
    this.errorMessage = '';
    this.entries = [];
    this.searched = true;

    this.apiService.getLedgerEntriesByMonthAndYear(Number(this.queryMonth), this.queryYear).subscribe({
      next: (data) => {
        this.entries = data;
        this.page = 1;
        this.calculateMetrics();
      },
      error: () => {
        this.entries = [];
        this.totalCollected = 0;
        this.totalProfit = 0;
        this.averageProfitPercent = 0;
      }
    });
  }

  calculateMetrics(): void {
    let collected = 0;
    let profit = 0;
    this.entries.forEach(e => {
      collected += e.amountPaid;
      profit += e.profitAmount;
    });

    this.totalCollected = collected;
    this.totalProfit = profit;
    if (collected > 0) {
      this.averageProfitPercent = (profit / collected) * 100;
    } else {
      this.averageProfitPercent = 0;
    }
  }

  getMonthName(m: string): string {
    const idx = Number(m) - 1;
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return names[idx] || '';
  }

  showReport = false;
  reportMode: 'month' | 'year' = 'month';
  monthlyRevenueData: number[] = [];
  monthlyProfitData: number[] = [];
  activeReportYear = new Date().getFullYear();
  loadingReportData = false;

  generateReport(): void {
    this.showReport = true;
    this.loadingReportData = true;
    this.activeReportYear = this.queryYear;

    const requests = [];
    for (let m = 1; m <= 12; m++) {
      requests.push(
        this.apiService.getLedgerEntriesByMonthAndYear(m, this.activeReportYear).pipe(
          catchError(() => of([]))
        )
      );
    }

    forkJoin(requests).subscribe({
      next: (results: any[]) => {
        this.monthlyRevenueData = new Array(12).fill(0);
        this.monthlyProfitData = new Array(12).fill(0);

        results.forEach((entriesList, index) => {
          let rev = 0;
          let prof = 0;
          if (entriesList && entriesList.length > 0) {
            entriesList.forEach((e: any) => {
              rev += e.amountPaid;
              prof += e.profitAmount;
            });
          }
          this.monthlyRevenueData[index] = rev;
          this.monthlyProfitData[index] = prof;
        });

        this.loadingReportData = false;
      },
      error: () => {
        this.loadingReportData = false;
      }
    });
  }

  getYearlyTotalRevenue(): number {
    return this.monthlyRevenueData.reduce((sum, val) => sum + val, 0);
  }

  getYearlyTotalProfit(): number {
    return this.monthlyProfitData.reduce((sum, val) => sum + val, 0);
  }

  getYearlyProfitPercent(): number {
    const rev = this.getYearlyTotalRevenue();
    return rev > 0 ? (this.getYearlyTotalProfit() / rev) * 100 : 0;
  }

  getTopEntries(): LedgerEntryOutputDto[] {
    return this.entries.slice(0, 5);
  }

  getBarHeight(amount: number): number {
    if (this.entries.length === 0) return 0;
    const maxAmount = Math.max(...this.entries.map(e => e.amountPaid), 1);
    return Math.round((amount / maxAmount) * 110);
  }

  getYearlyMaxVal(): number {
    const maxRev = Math.max(...this.monthlyRevenueData, 1);
    const maxProf = Math.max(...this.monthlyProfitData, 1);
    return Math.max(maxRev, maxProf);
  }

  getLinePoints(data: number[]): string {
    if (data.length === 0) return '';
    const maxVal = this.getYearlyMaxVal();
    return data.map((val, idx) => {
      const x = 30 + idx * 30; // 12 points spaced by 30px
      const y = 140 - (val / maxVal) * 110;
      return `${x},${y}`;
    }).join(' ');
  }

  getLineNodes(data: number[]): { x: number; y: number; val: number; month: string }[] {
    const maxVal = this.getYearlyMaxVal();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return data.map((val, idx) => ({
      x: 30 + idx * 30,
      y: 140 - (val / maxVal) * 110,
      val: val,
      month: months[idx]
    }));
  }

  exportPDF(): void {
    window.print();
  }
}
