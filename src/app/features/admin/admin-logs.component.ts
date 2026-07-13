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

  logType = '';
  logValue = '';

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading = true;
    this.apiService.getAuditLogs(this.logType || undefined, this.logValue || undefined).subscribe({
      next: (data) => {
        this.logs = data;
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
