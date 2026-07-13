import { Component, inject, OnInit } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { LedgerEntryOutputDto } from '../../core/models/models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  getMonthName(monthStr: string): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[Number(monthStr) - 1] || '';
  }
}
