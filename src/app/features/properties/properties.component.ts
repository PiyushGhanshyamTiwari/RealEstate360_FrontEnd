import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { PropertyOutputDTO } from '../../core/models/models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-properties',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './properties.component.html',
  styleUrl: './properties.component.css'
})
export class PropertiesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  authService = inject(AuthService);

  properties: PropertyOutputDTO[] = [];
  loading = true;
  isOwner = false;
  userId: number | null = null;

  showRegisterForm = false;
  propertyForm!: FormGroup;
  submitted = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  searchCity = '';
  searchState = '';

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.userId = user.userId;
      this.isOwner = user.role.toUpperCase() === 'OWNER';
    }

    this.propertyForm = this.fb.group({
      propertyName: ['', Validators.required],
      propertyAddress: ['', Validators.required],
      propertyCity: ['', Validators.required],
      propertyState: ['', Validators.required],
      propertyPostalCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      propertyCountry: ['', Validators.required]
    });

    this.loadProperties();
  }

  get f() { return this.propertyForm.controls; }

  toggleRegisterForm(): void {
    this.showRegisterForm = !this.showRegisterForm;
    this.errorMessage = '';
    this.successMessage = '';
    this.submitted = false;
    if (!this.showRegisterForm) {
      this.loadProperties();
    }
  }

  loadProperties(): void {
    this.loading = true;
    if (this.isOwner && this.userId) {
      // Owners view their own properties by default
      this.apiService.findPropertyByOwnerId(this.userId).subscribe({
        next: (data) => {
          this.properties = data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
    } else {
      // Tenants/Admins do not have a list-all properties API.
      // We aggregate property records dynamically from all registered rental units!
      this.apiService.getAllUnits().subscribe({
        next: (units) => {
          const propertyMap = new Map<number, PropertyOutputDTO>();
          units.forEach(u => {
            if (u.propertyId && !propertyMap.has(u.propertyId)) {
              propertyMap.set(u.propertyId, {
                propertyId: u.propertyId,
                propertyName: u.propertyName,
                propertyAddress: u.propertyPostalCode ? `${u.propertyPostalCode}, ${u.propertyCountry}` : 'Address Not Specified',
                propertyCity: u.propertyCity,
                propertyState: u.propertyState,
                propertyPostalCode: u.propertyPostalCode,
                propertyCountry: u.propertyCountry,
                createdAt: u.createdAt,
                updatedAt: u.updatedAt,
                ownerId: 0
              });
            }
          });
          this.properties = Array.from(propertyMap.values());
          this.loading = false;
        },
        error: () => {
          this.properties = [];
          this.loading = false;
        }
      });
    }
  }

  onRegisterSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.propertyForm.invalid || !this.userId) {
      return;
    }

    this.submitting = true;
    this.apiService.addProperty(this.propertyForm.value, this.userId).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Property successfully registered!';
        this.propertyForm.reset();
        this.submitted = false;
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to register property.';
      }
    });
  }

  onSearchCity(): void {
    if (!this.searchCity) return;
    this.loading = true;
    this.searchState = '';
    this.apiService.findPropertyByCity(this.searchCity).subscribe({
      next: (data) => {
        this.properties = data;
        this.loading = false;
      },
      error: () => {
        this.properties = [];
        this.loading = false;
      }
    });
  }

  onSearchState(): void {
    if (!this.searchState) return;
    this.loading = true;
    this.searchCity = '';
    this.apiService.findPropertyByState(this.searchState).subscribe({
      next: (data) => {
        this.properties = data;
        this.loading = false;
      },
      error: () => {
        this.properties = [];
        this.loading = false;
      }
    });
  }

  resetSearch(): void {
    this.searchCity = '';
    this.searchState = '';
    this.loadProperties();
  }
}
