import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { UnitInputDTO, UnitOutputDTO, PropertyOutputDTO } from '../../core/models/models';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-units',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './units.component.html',
  styleUrl: './units.component.css'
})
export class UnitsComponent implements OnInit {
  private fb = inject(FormBuilder);
  public apiService = inject(ApiService);
  authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  // Minimum date binding for template (YYYY-MM-DD format)
  todayDate: string = new Date().toISOString().split('T')[0];

  units: UnitOutputDTO[] = [];
  ownerProperties: PropertyOutputDTO[] = [];
  loading = true;
  isOwner = false;

  // Pagination helper fields
  page = 1;
  pageSize = 5;

  get paginatedUnits(): UnitOutputDTO[] {
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.units.slice(start, end);
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

  role = '';
  userId: number | null = null;

  showRegisterForm = false;
  editUnitId: number | null = null;
  unitForm!: FormGroup;
  submitted = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  // Filter bindings
  filterType = '';
  filterStatus = '';
  filterMinRent?: number;
  filterMaxRent?: number;
  filterCity = '';

  // Detailed view segment
  selectedUnit: UnitOutputDTO | null = null;
  newAmenityName = '';
  photos: { photoId: number; caption?: string; imageUrl?: string }[] = [];

  // Carousel & Lightbox browsing variables and methods
  currentPhotoIndex = 0;
  isLightboxOpen = false;
  touchStartX = 0;
  touchEndX = 0;

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.role = user.role.toUpperCase();
      this.isOwner = this.role === 'OWNER';
      this.userId = user.userId;
    }

    this.unitForm = this.fb.group({
      type: ['', Validators.required],
      propertyId: ['', Validators.required],
      areaSqFt: ['', [Validators.required, Validators.min(10)]],
      floor: [0, [Validators.required, Validators.min(0)]],
      availableFrom: ['', [Validators.required, this.futureDateValidator]],
      rentAmount: ['', [Validators.required, Validators.min(1)]],
      depositAmount: ['', [Validators.required, Validators.min(1)]]
    });

    if (this.isOwner && this.userId) {
      this.apiService.findPropertyByOwnerId(this.userId).subscribe(data => {
        this.ownerProperties = data;
      });
    }

    this.applyFilters();
  }

  // Custom Validator to disallow past dates
  futureDateValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const selectedDate = new Date(control.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Strip time component for fair date comparison

    return selectedDate >= today ? null : { pastDate: true };
  }

  get fu() { return this.unitForm.controls; }

  toggleRegisterForm(): void {
    this.showRegisterForm = !this.showRegisterForm;
    this.editUnitId = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.submitted = false;
    this.unitForm.reset({ floor: 0 });
    if (!this.showRegisterForm) {
      this.applyFilters();
    }
  }

  applyFilters(): void {
    this.loading = true;
    this.selectedUnit = null;

    this.apiService.filterUnits(
      this.filterType || undefined,
      this.filterMinRent || undefined,
      this.filterMaxRent || undefined,
      undefined,
      undefined,
      this.filterCity || undefined,
      this.filterStatus || undefined
    ).subscribe({
      next: (data) => {
        this.units = data;
        this.page = 1;
        this.loading = false;
      },
      error: () => {
        this.units = [];
        this.loading = false;
      }
    });
  }

  resetFilters(): void {
    this.filterType = '';
    this.filterStatus = '';
    this.filterMinRent = undefined;
    this.filterMaxRent = undefined;
    this.filterCity = '';
    this.applyFilters();
  }

  onUnitSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.unitForm.invalid) {
      return;
    }

    this.submitting = true;
    const formValue = this.unitForm.value;
    const input: UnitInputDTO = {
      type: formValue.type,
      propertyId: Number(formValue.propertyId),
      areaSqFt: formValue.areaSqFt,
      floor: formValue.floor,
      availableFrom: formValue.availableFrom,
      rentAmount: formValue.rentAmount,
      depositAmount: formValue.depositAmount,
      status: 'AVAILABLE'
    };

    if (this.editUnitId) {
      this.apiService.updateUnit(this.editUnitId, input).subscribe({
        next: () => {
          this.submitting = false;
          this.successMessage = 'Unit updated successfully!';
          this.toggleRegisterForm();
        },
        error: (err) => {
          this.submitting = false;
          this.errorMessage = err.error?.message || 'Failed to update unit.';
        }
      });
    } else {
      this.apiService.addUnit(input).subscribe({
        next: () => {
          this.submitting = false;
          this.successMessage = 'Unit registered successfully!';
          this.unitForm.reset({ floor: 0 });
          this.submitted = false;
        },
        error: (err) => {
          this.submitting = false;
          this.errorMessage = err.error?.message || 'Failed to register unit.';
        }
      });
    }
  }

  onEditUnit(unit: UnitOutputDTO): void {
    this.editUnitId = unit.unitId;
    this.showRegisterForm = true;
    this.submitted = false;
    this.unitForm.patchValue({
      type: unit.type,
      propertyId: unit.propertyId,
      areaSqFt: unit.areaSqFt,
      floor: unit.floor,
      availableFrom: unit.availableFrom,
      rentAmount: unit.rentAmount,
      depositAmount: unit.depositAmount
    });
  }

  openDetailView(unit: UnitOutputDTO): void {
    this.selectedUnit = unit;
    this.newAmenityName = '';
    this.currentPhotoIndex = 0;
    this.isLightboxOpen = false;

    this.photos = [];
    if (unit.propertyPhotos) {
      this.photos = Object.keys(unit.propertyPhotos).map((photoId, index) => ({
        photoId: Number(photoId),
        caption: unit.propertyPhotos?.[Number(photoId)] || `Unit Photo ${index + 1}`,
        imageUrl: ''
      }));
    }
  }

  getSanitizedUrl(photoId: number): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(`http://localhost:8080/api/v1/propertyphoto/views/${photoId}`);
  }

  closeDetailView(): void {
    this.selectedUnit = null;
    this.isLightboxOpen = false;
  }

  prevPhoto(): void {
    if (this.photos.length <= 1) return;
    this.currentPhotoIndex = (this.currentPhotoIndex - 1 + this.photos.length) % this.photos.length;
  }

  nextPhoto(): void {
    if (this.photos.length <= 1) return;
    this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
  }

  openLightbox(index: number): void {
    this.currentPhotoIndex = index;
    this.isLightboxOpen = true;
  }

  closeLightbox(): void {
    this.isLightboxOpen = false;
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  handleSwipe(): void {
    const swipeThreshold = 50;
    if (this.touchEndX < this.touchStartX - swipeThreshold) {
      this.nextPhoto();
    } else if (this.touchEndX > this.touchStartX + swipeThreshold) {
      this.prevPhoto();
    }
  }

  onAddAmenity(): void {
    if (!this.newAmenityName || !this.selectedUnit) return;
    const input = {
      name: this.newAmenityName,
      description: 'Added to ' + this.selectedUnit.type
    };

    this.apiService.addAmenity(input, this.selectedUnit.unitId).subscribe({
      next: (response) => {
        if (!this.selectedUnit!.amenities) {
          this.selectedUnit!.amenities = [];
        }
        this.selectedUnit!.amenities.push(response.name);
        this.newAmenityName = '';
        this.successMessage = 'Amenity added successfully!';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => {
        this.errorMessage = 'Failed to add amenity.';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  onUploadPhoto(event: any): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (event.target.files && event.target.files.length > 0 && this.selectedUnit) {
      const files: FileList = event.target.files;
      const userName = this.authService.currentUserValue?.userName || 'Owner';
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      const maxSizeBytes = 5 * 1024 * 1024; // 5 MB Limit
      
      let successCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file: File = files[i];

        // 1. Validate File Type
        if (!allowedTypes.includes(file.type.toLowerCase())) {
          this.errorMessage = `Invalid file type for '${file.name}'. Only PNG and JPG/JPEG files are allowed.`;
          event.target.value = '';
          return;
        }

        // 2. Validate File Size
        if (file.size > maxSizeBytes) {
          this.errorMessage = `File '${file.name}' exceeds the 5MB size limit. Please upload a smaller image.`;
          event.target.value = '';
          return;
        }

        // Dynamically compute photo number based on current list length
        const photoIndex = this.photos.length + i + 1;
        const captionText = `Unit Photo ${photoIndex}`;

        this.apiService.uploadPhoto(this.selectedUnit.unitId, file, userName, captionText).subscribe({
          next: (photo) => {
            successCount++;
            
            this.photos.push({
              photoId: photo.photoId,
              caption: photo.caption || captionText
            });

            if (!this.selectedUnit!.propertyPhotos) {
              this.selectedUnit!.propertyPhotos = {};
            }
            this.selectedUnit!.propertyPhotos[photo.photoId] = photo.caption || captionText;

            this.currentPhotoIndex = this.photos.length - 1;

            this.successMessage = `${successCount} photo(s) uploaded successfully!`;
            setTimeout(() => this.successMessage = '', 3000);
          },
          error: () => {
            this.errorMessage = 'Some photo uploads failed.';
            setTimeout(() => this.errorMessage = '', 3000);
          }
        });
      }

      event.target.value = ''; // Reset file input selection
    }
  }

  onDownloadPhoto(photoId: number): void {
    this.apiService.downloadPhoto(photoId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo_${photoId}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.errorMessage = 'Failed to download photo.';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }
}