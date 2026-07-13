import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AccountOfficerOutputDto } from '../../core/models/models';

@Component({
  selector: 'app-account-officers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-officers.component.html',
  styleUrl: './account-officers.component.css'
})
export class AccountOfficersComponent implements OnInit {
  private apiService = inject(ApiService);

  officers: AccountOfficerOutputDto[] = [];
  loading = true;

  ngOnInit(): void {
    this.loadOfficers();
  }

  loadOfficers(): void {
    this.loading = true;
    this.apiService.getAllOfficers().subscribe({
      next: (data) => {
        this.officers = data;
        this.loading = false;
      },
      error: () => {
        this.officers = [];
        this.loading = false;
      }
    });
  }
}
