import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
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

  units: UnitOutputDTO[] = [];
  ownerProperties: PropertyOutputDTO[] = [];
  loading = true;
  isOwner = false;
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
  photos: { photoId: number; caption?: string, imageUrl?: string }[] = [];

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
      availableFrom: ['', Validators.required],
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

  // openDetailView(unit: UnitOutputDTO): void {
  //   this.selectedUnit = unit;
  //   this.newAmenityName = '';
    
  //   // Parse photos map (HashMap<Integer,String> propertyPhotos)
  //   this.photos = [];
  //   if (unit.propertyPhotos) {
  //     this.photos = Object.keys(unit.propertyPhotos).map(photoId => ({
  //       photoId: Number(photoId),
  //       caption: unit.propertyPhotos?.[Number(photoId)]
  //     }));
  //   }
    
  // }

  openDetailView(unit: UnitOutputDTO): void {
  this.selectedUnit = unit;
  this.newAmenityName = '';
  
  this.photos = [];
  if (unit.propertyPhotos) {
    this.photos = Object.keys(unit.propertyPhotos).map(photoId => ({
      photoId: Number(photoId),
      caption: unit.propertyPhotos?.[Number(photoId)],
      imageUrl: '' // Add a placeholder for the object URL string
    }));

    // Fetch binary content for each photo and build the local preview URL
    // this.photos.forEach(photo => {
    //   this.apiService.downloadPhoto(photo.photoId).subscribe({
    //     next: (blob: Blob) => {
    //       // Convert the raw binary blob into a renderable browser URL string
    //       photo.imageUrl = window.URL.createObjectURL(blob);
    //      // console.log(photo.imageUrl)
    //     },
    //     error: () => {
    //       // Fallback if image fails to load (can use a placeholder image path)
    //       photo.imageUrl = 'assets/placeholder-image.jpg'; 
    //     }
    //   });
    // });

  }
}

private sanitizer = inject(DomSanitizer); // Inject it
// Create a helper method
  getSanitizedUrl(photoId: number): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(`http://localhost:8080/api/v1/propertyphoto/views/${photoId}`);
  }

  closeDetailView(): void {
    this.selectedUnit = null;
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
    if (event.target.files && event.target.files.length > 0 && this.selectedUnit) {
      const file: File = event.target.files[0];
      const userName = this.authService.currentUserValue?.userName || 'Owner';

      this.apiService.uploadPhoto(this.selectedUnit.unitId, file, userName, 'Unit Photo').subscribe({
        next: (photo) => {
          this.photos.push({
            photoId: photo.photoId,
            caption: photo.caption
          });
          this.successMessage = 'Photo uploaded successfully!';
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: () => {
          this.errorMessage = 'Photo upload failed.';
          setTimeout(() => this.errorMessage = '', 3000);
        }
      });
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
