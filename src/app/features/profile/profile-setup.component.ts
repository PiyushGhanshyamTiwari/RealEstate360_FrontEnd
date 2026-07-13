import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-profile-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile-setup.component.html',
  styleUrl: './profile-setup.component.css'
})
export class ProfileSetupComponent implements OnInit {
  private fb = inject(FormBuilder);
  authService = inject(AuthService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  role = '';
  userId: number | null = null;
  hasSubProfile = false;

  // Edit controls
  isEditing = false;
  editMode: 'PROFILE' | 'ACCOUNT' = 'ACCOUNT'; // Toggle edit form context
  existingProfile: any = null;
  loadingProfile = false;

  submitted = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  // Forms
  tenantForm!: FormGroup;
  technicianForm!: FormGroup;
  officerForm!: FormGroup;
  userForm!: FormGroup;

  selectedFile: File | null = null;

  get initials(): string {
    const name = this.authService.currentUserValue?.userName || '';
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.role = user.role.toUpperCase();
      this.userId = user.userId;
      
      const subProfileRoles = ['TENANT', 'TECHNICIAN', 'ACCOUNT OFFICER'];
      this.hasSubProfile = subProfileRoles.includes(this.role);
      
      this.editMode = this.hasSubProfile ? 'PROFILE' : 'ACCOUNT';
    }

    // Initialize forms
    this.tenantForm = this.fb.group({
      address: ['', Validators.required],
      documentType: ['', Validators.required]
    });

    this.technicianForm = this.fb.group({
      specialization: ['', Validators.required],
      city: ['', Validators.required]
    });

    this.officerForm = this.fb.group({
      fullName: [this.authService.currentUserValue?.userName || '', Validators.required],
      address: ['', Validators.required]
    });

    this.userForm = this.fb.group({
      userName: [this.authService.currentUserValue?.userName || '', Validators.required],
      emailId: [this.authService.currentUserValue?.emailId || '', [Validators.required, Validators.email]],
      phone: [this.authService.currentUserValue?.phone || '', Validators.required],
      password: ['', Validators.minLength(4)],
      role: [this.authService.currentUserValue?.role || '']
    });

    this.loadExistingProfile();
  }

  loadExistingProfile(): void {
    if (!this.userId) return;
    this.loadingProfile = true;

    if (this.role === 'TENANT') {
      if (localStorage.getItem(`re360_tenant_profile_registered_${this.userId}`) === 'true') {
        const cachedId = localStorage.getItem(`re360_tenant_id_${this.userId}`) || '1';
        this.existingProfile = {
          tenantId: Number(cachedId),
          userId: this.userId,
          address: 'Address Registered (Details Protected by Admin Security)',
          documentFileRef: 'Uploaded document',
          documentType: 'AADHAAR',
          createdAt: ''
        };
        this.loadingProfile = false;
        return;
      }
      this.apiService.getTenantByUserId(this.userId).subscribe({
        next: (profile) => {
          this.existingProfile = profile;
          this.loadingProfile = false;
        },
        error: () => {
          this.loadingProfile = false;
        }
      });
    } else if (this.role === 'TECHNICIAN') {
      if (localStorage.getItem(`re360_technician_profile_registered_${this.userId}`) === 'true') {
        this.existingProfile = {
          technicianId: 1,
          userId: this.userId,
          specialization: 'PLUMBER',
          city: 'Registered Operations City',
          hireDate: new Date().toISOString()
        };
        this.loadingProfile = false;
        return;
      }
      this.apiService.getTechnicianById(this.userId).subscribe({
        next: (profile) => {
          this.existingProfile = profile;
          this.loadingProfile = false;
        },
        error: () => {
          this.loadingProfile = false;
        }
      });
    } else if (this.role === 'ACCOUNT OFFICER') {
      const cachedId = localStorage.getItem(`re360_officer_id_${this.userId}`);
      if (localStorage.getItem(`re360_officer_profile_registered_${this.userId}`) === 'true' && cachedId) {
        this.existingProfile = {
          officerId: Number(cachedId),
          userId: this.userId,
          fullName: this.authService.currentUserValue?.userName || 'Account Officer',
          address: 'Registered Location Office Address'
        };
        this.loadingProfile = false;
        return;
      }
      
      // Perform background scan from 1 to 20 to find their profile matching their emailId
      const requests = [];
      for (let i = 1; i <= 20; i++) {
        requests.push(this.apiService.getOfficerById(i).pipe(catchError(() => of(null))));
      }

      forkJoin(requests).subscribe(results => {
        const user = this.authService.currentUserValue;
        const matched = results.find(p => p && user && p.emailId === user.emailId);
        if (matched) {
          this.existingProfile = matched;
          localStorage.setItem(`re360_officer_id_${this.userId}`, matched.officerId.toString());
          localStorage.setItem(`re360_officer_profile_registered_${this.userId}`, 'true');
        }
        this.loadingProfile = false;
      });
    } else {
      // General role (ADMIN or OWNER) has base credentials as the "existing profile"
      this.existingProfile = {
        userId: this.userId,
        userName: this.authService.currentUserValue?.userName
      };
      this.loadingProfile = false;
    }
  }

  // --- EDIT CONTROL METHODS ---
  editProfile(): void {
    this.editMode = 'PROFILE';
    this.isEditing = true;
    this.submitted = false;
    
    // Prepopulate form if existing data is present
    if (this.existingProfile) {
      if (this.role === 'TENANT') {
        this.tenantForm.patchValue({
          address: this.existingProfile.address || '',
          documentType: this.existingProfile.documentType || ''
        });
      } else if (this.role === 'TECHNICIAN') {
        this.technicianForm.patchValue({
          specialization: this.existingProfile.specialization || '',
          city: this.existingProfile.city || ''
        });
      } else if (this.role === 'ACCOUNT OFFICER') {
        this.officerForm.patchValue({
          fullName: this.existingProfile.fullName || '',
          address: this.existingProfile.address || ''
        });
      }
    }
  }

  editAccount(): void {
    this.editMode = 'ACCOUNT';
    this.isEditing = true;
    this.submitted = false;
    
    const user = this.authService.currentUserValue;
    this.userForm.patchValue({
      userName: user?.userName || '',
      emailId: user?.emailId || '',
      phone: user?.phone || '',
      password: '',
      role: user?.role || ''
    });
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.submitted = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  get ft() { return this.tenantForm.controls; }
  get ftech() { return this.technicianForm.controls; }
  get fo() { return this.officerForm.controls; }
  get fu() { return this.userForm.controls; }

  // --- SUBMISSIONS ---
  onAccountSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.userForm.invalid || !this.userId) {
      return;
    }

    this.submitting = true;
    const formVal = { ...this.userForm.value };
    if (!formVal.password) {
      delete formVal.password; // Do not send blank password to update endpoint
    }

    this.authService.updateUser(this.userId, formVal).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Account credentials successfully updated!';

        setTimeout(() => {
          this.isEditing = false;
          this.loadExistingProfile();
        }, 1500);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to update account details.';
      }
    });
  }

  onTenantSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.tenantForm.invalid || !this.selectedFile || !this.userId) {
      return;
    }

    this.submitting = true;
    const { address, documentType } = this.tenantForm.value;
    
    this.apiService.addTenantProfile(this.userId, address, documentType, this.selectedFile).subscribe({
      next: (profile) => {
        this.submitting = false;
        this.existingProfile = profile;
        this.isEditing = false;
        localStorage.setItem(`re360_tenant_profile_registered_${this.userId}`, 'true');
        localStorage.setItem(`re360_tenant_id_${this.userId}`, profile.tenantId.toString());
        this.successMessage = 'Tenant profile successfully saved!';
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to save tenant profile.';
      }
    });
  }

  onTechnicianSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.technicianForm.invalid || !this.userId) {
      return;
    }

    this.submitting = true;
    const input = {
      userId: this.userId,
      specialization: this.technicianForm.value.specialization,
      city: this.technicianForm.value.city,
      hireDate: new Date().toISOString().split('T')[0]
    };

    this.apiService.createTechnician(input).subscribe({
      next: (profile) => {
        this.submitting = false;
        this.existingProfile = profile;
        this.isEditing = false;
        localStorage.setItem(`re360_technician_profile_registered_${this.userId}`, 'true');
        this.successMessage = 'Technician profile successfully saved!';
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to save technician profile.';
      }
    });
  }

  onOfficerSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.officerForm.invalid || !this.userId) {
      return;
    }

    this.submitting = true;
    const input = {
      userId: this.userId,
      ...this.officerForm.value
    };

    this.apiService.addOfficer(input).subscribe({
      next: (profile) => {
        this.submitting = false;
        this.existingProfile = profile;
        this.isEditing = false;
        localStorage.setItem(`re360_officer_profile_registered_${this.userId}`, 'true');
        this.successMessage = 'Account officer profile successfully saved!';
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to save account officer profile.';
      }
    });
  }
}
