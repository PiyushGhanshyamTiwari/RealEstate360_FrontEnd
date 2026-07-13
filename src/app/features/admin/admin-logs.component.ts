import { Component, inject, OnInit } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { AuditLogResponseDTO } from '../../core/models/models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-logs.component.html',
  styleUrl: './admin-logs.component.css'
})
export class AdminLogsComponent implements OnInit {
  private apiService = inject(ApiService);

  logs: AuditLogResponseDTO[] = [];
  loading = true;

  // Pagination helper fields
  page = 1;
  pageSize = 10; // Let's set 10 page size for logs since logs are dense!

  get paginatedLogs(): AuditLogResponseDTO[] {
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.logs.slice(start, end);
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

  logType = '';
  logValue = '';

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading = true;

    let mappedType: string | undefined = undefined;
    if (this.logType === 'userId') {
      mappedType = 'USER';
    } else if (this.logType === 'action') {
      mappedType = 'ACTION';
    } else if (this.logType === 'resourceType') {
      mappedType = 'RESOURCE';
    }

    this.apiService.getAuditLogs(mappedType, this.logValue || undefined).subscribe({
      next: (data) => {
        this.logs = data || [];
        this.page = 1;
        this.loading = false;
      },
      error: () => {
        this.logs = [];
        this.loading = false;
      }
    });
  }

  resetFilters(): void {
    this.logType = '';
    this.logValue = '';
    this.loadLogs();
  }
}
