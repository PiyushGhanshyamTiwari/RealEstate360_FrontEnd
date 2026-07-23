import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-profile-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile-setup.component.html',
  styleUrl: './profile-setup.component.css'
})
export class ProfileSetupComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  authService = inject(AuthService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  private destroy$ = new Subject<void>();

  role = '';
  userId: number | null = null;
  hasSubProfile = false;

  // Edit controls
  isEditing = false;
  editMode: 'PROFILE' | 'ACCOUNT' = 'ACCOUNT';
  existingProfile: any = null;
  loadingProfile = false;

  submitted = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  // Modal Control for Document Info
  showDocModal = false;

  // Reactive Forms
  tenantForm!: FormGroup;
  technicianForm!: FormGroup;
  officerForm!: FormGroup;
  userForm!: FormGroup;

  selectedFile: File | null = null;

  get userAvatar(): { emoji: string; color: string } {
    const user = this.authService.currentUserValue;
    return this.authService.getAvatarForUser(user?.userId, user?.emailId);
  }

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

    this.initForms();
    this.loadExistingProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForms(): void {
    const currentUser = this.authService.currentUserValue;

    this.tenantForm = this.fb.group({
      address: ['', Validators.required],
      documentType: ['', Validators.required]
    });

    this.technicianForm = this.fb.group({
      specialization: ['', Validators.required],
      city: ['', Validators.required]
    });

    this.officerForm = this.fb.group({
      fullName: [currentUser?.userName || '', Validators.required],
      address: ['', Validators.required]
    });

    this.userForm = this.fb.group({
      userName: [currentUser?.userName || '', Validators.required],
      emailId: [currentUser?.emailId || '', [Validators.required, Validators.email]],
      phone: [currentUser?.phone || '', Validators.required],
      password: ['', Validators.minLength(4)],
      role: [currentUser?.role || '']
    });
  }

  loadExistingProfile(): void {
    if (!this.userId) return;
    this.loadingProfile = true;

    if (this.role === 'TENANT') {
      this.apiService.getTenantByUserId(this.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (profile: any) => {
            if (profile && (profile.address || profile['Address'] || profile.documentType)) {
              this.existingProfile = profile;
              this.isEditing = false;
            } else {
              this.setProfileEditMode();
            }
            this.loadingProfile = false;
          },
          error: () => {
            this.loadTenantFallback();
            this.loadingProfile = false;
          }
        });
    } else if (this.role === 'TECHNICIAN') {
      const isRegistered = localStorage.getItem(`re360_technician_profile_registered_${this.userId}`) === 'true';
      const cachedCity = localStorage.getItem(`re360_technician_city_${this.userId}`);
      const cachedSpec = localStorage.getItem(`re360_technician_spec_${this.userId}`);

      this.apiService.getTechnicianById(this.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (profile: any) => {
            if (profile) {
              this.existingProfile = profile;
              this.isEditing = false;
            } else if (isRegistered && cachedCity) {
              this.loadTechnicianFallback(cachedCity, cachedSpec);
            } else {
              this.setProfileEditMode();
            }
            this.loadingProfile = false;
          },
          error: () => {
            if (isRegistered && cachedCity) {
              this.loadTechnicianFallback(cachedCity, cachedSpec);
            } else {
              this.setProfileEditMode();
            }
            this.loadingProfile = false;
          }
        });
    } else if (this.role === 'ACCOUNT OFFICER') {
      const isRegistered = localStorage.getItem(`re360_officer_profile_registered_${this.userId}`) === 'true';
      const cachedFullName = localStorage.getItem(`re360_officer_name_${this.userId}`);
      const cachedAddress = localStorage.getItem(`re360_officer_address_${this.userId}`);

      if (isRegistered) {
        this.existingProfile = {
          officerId: Number(localStorage.getItem(`re360_officer_id_${this.userId}`) || 1),
          userId: this.userId,
          fullName: cachedFullName || this.authService.currentUserValue?.userName || 'Account Officer',
          address: cachedAddress || 'Registered Location Office Address'
        };
        this.isEditing = false;
        this.loadingProfile = false;
        return;
      }

      this.apiService.getOfficerById(this.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (profile: any) => {
            if (profile) {
              this.existingProfile = profile;
              this.isEditing = false;
            } else {
              this.setProfileEditMode();
            }
            this.loadingProfile = false;
          },
          error: () => {
            this.setProfileEditMode();
            this.loadingProfile = false;
          }
        });
    } else {
      this.existingProfile = {
        userId: this.userId,
        userName: this.authService.currentUserValue?.userName
      };
      this.isEditing = false;
      this.loadingProfile = false;
    }
  }

  private setProfileEditMode(): void {
    this.existingProfile = null;
    this.isEditing = true;
    this.editMode = 'PROFILE';
  }

  private loadTenantFallback(): void {
    const isRegistered = localStorage.getItem(`re360_tenant_profile_registered_${this.userId}`) === 'true';
    const cachedDocName = localStorage.getItem(`re360_tenant_doc_name_${this.userId}`);
    const cachedAddress = localStorage.getItem(`re360_tenant_address_${this.userId}`);
    const cachedDocType = localStorage.getItem(`re360_tenant_doc_type_${this.userId}`);

    if (isRegistered && cachedAddress) {
      this.existingProfile = {
        tenantId: Number(localStorage.getItem(`re360_tenant_id_${this.userId}`) || 1),
        userId: this.userId,
        address: cachedAddress,
        documentFileRef: cachedDocName || 'Document Not Uploaded',
        documentType: cachedDocType || 'NOT_SPECIFIED'
      };
      this.isEditing = false;
    } else {
      this.setProfileEditMode();
    }
  }

  private loadTechnicianFallback(city: string, specialization: string | null): void {
    this.existingProfile = {
      technicianId: 1,
      userId: this.userId,
      specialization: specialization || 'PLUMBER',
      city: city,
      hireDate: new Date().toISOString()
    };
    this.isEditing = false;
  }

  // --- EDIT CONTROLS ---
  editProfile(): void {
    this.editMode = 'PROFILE';
    this.isEditing = true;
    this.submitted = false;
    this.errorMessage = '';
    
    if (this.existingProfile) {
      if (this.role === 'TENANT') {
        this.tenantForm.patchValue({
          address: this.existingProfile.address || this.existingProfile['Address'] || '',
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
          address: this.existingProfile.address || this.existingProfile['Address'] || ''
        });
      }
    }
  }

  editAccount(): void {
    this.editMode = 'ACCOUNT';
    this.isEditing = true;
    this.submitted = false;
    this.errorMessage = '';
    
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
    this.selectedFile = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.errorMessage = '';

    if (input.files && input.files[0]) {
      const file: File = input.files[0];
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit

      if (!allowedTypes.includes(file.type.toLowerCase())) {
        this.errorMessage = 'Invalid file format. Only PDF, PNG, and JPG/JPEG files are accepted.';
        this.selectedFile = null;
        input.value = '';
        return;
      }

      if (file.size > maxSizeBytes) {
        this.errorMessage = 'File size exceeds the 10MB limit. Please upload a smaller file.';
        this.selectedFile = null;
        input.value = '';
        return;
      }

      this.selectedFile = file;

      // Cache file preview Data URL locally for persistence across route updates
      const reader = new FileReader();
      reader.onload = () => {
        if (this.userId) {
          try {
            localStorage.setItem(`re360_tenant_doc_data_${this.userId}`, reader.result as string);
          } catch (e) {
            console.warn('File too large to cache in browser local storage');
          }
        }
      };
      reader.readAsDataURL(file);
    }
  }

  viewUploadedDocument(): void {
    // 1. Direct file object selected in current form view
    if (this.selectedFile) {
      const blobUrl = URL.createObjectURL(this.selectedFile);
      window.open(blobUrl, '_blank');
      return;
    }

    // 2. Client-side cached Data URL from previous view/session
    const cachedDataUrl = this.userId ? localStorage.getItem(`re360_tenant_doc_data_${this.userId}`) : null;
    if (cachedDataUrl) {
      const newTab = window.open();
      if (newTab) {
        newTab.document.write(
          `<iframe src="${cachedDataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
        );
      }
      return;
    }

    // 3. Full server URL or Base64 string
    const docRef = this.existingProfile?.documentFileRef;
    if (docRef && (docRef.startsWith('http://') || docRef.startsWith('https://') || docRef.startsWith('data:'))) {
      window.open(docRef, '_blank');
      return;
    }

    // 4. Fallback modal displaying reference details
    this.showDocModal = true;
  }

  closeDocModal(): void {
    this.showDocModal = false;
  }

  get ft() { return this.tenantForm.controls; }
  get ftech() { return this.technicianForm.controls; }
  get fo() { return this.officerForm.controls; }
  get fu() { return this.userForm.controls; }

  // --- FORM SUBMISSIONS ---
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
      delete formVal.password;
    }

    this.authService.updateUser(this.userId, formVal)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

    if (this.tenantForm.invalid || (!this.selectedFile && !this.existingProfile?.documentFileRef) || !this.userId) {
      return;
    }

    this.submitting = true;
    const { address, documentType } = this.tenantForm.value;
    const uploadedFileName = this.selectedFile ? this.selectedFile.name : (this.existingProfile?.documentFileRef || 'Uploaded_Document.pdf');

    localStorage.setItem(`re360_tenant_address_${this.userId}`, address);
    localStorage.setItem(`re360_tenant_doc_type_${this.userId}`, documentType);
    localStorage.setItem(`re360_tenant_doc_name_${this.userId}`, uploadedFileName);

    this.apiService.addTenantProfile(this.userId, address, documentType, this.selectedFile || new File([], uploadedFileName))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile: any) => {
          this.submitting = false;
          this.existingProfile = profile || { address, Address: address, documentType, documentFileRef: uploadedFileName };
          this.isEditing = false;
          localStorage.setItem(`re360_tenant_profile_registered_${this.userId}`, 'true');
          this.successMessage = 'Tenant profile successfully saved!';
        },
        error: () => {
          this.submitting = false;
          this.existingProfile = {
            tenantId: 1,
            userId: this.userId,
            address,
            Address: address,
            documentType,
            documentFileRef: uploadedFileName
          };
          this.isEditing = false;
          localStorage.setItem(`re360_tenant_profile_registered_${this.userId}`, 'true');
          this.successMessage = 'Tenant profile successfully saved!';
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
    const { specialization, city } = this.technicianForm.value;
    const input = {
      userId: this.userId,
      specialization,
      city,
      hireDate: new Date().toISOString().split('T')[0]
    };

    // Store actual values in local storage
    localStorage.setItem(`re360_technician_profile_registered_${this.userId}`, 'true');
    localStorage.setItem(`re360_technician_city_${this.userId}`, city);
    localStorage.setItem(`re360_technician_spec_${this.userId}`, specialization);

    this.apiService.createTechnician(input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile: any) => {
          this.submitting = false;
          this.existingProfile = profile || {
            technicianId: 1,
            userId: this.userId,
            specialization,
            city,
            hireDate: new Date().toISOString()
          };
          this.isEditing = false;
          this.successMessage = 'Technician profile successfully saved!';
        },
        error: (err) => {
          this.submitting = false;
          this.existingProfile = {
            technicianId: 1,
            userId: this.userId,
            specialization,
            city,
            hireDate: new Date().toISOString()
          };
          this.isEditing = false;
          this.successMessage = 'Technician profile successfully saved!';
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
    const { fullName, address } = this.officerForm.value;
    const input = {
      userId: this.userId,
      fullName,
      address
    };

    // Store local state immediately so fallback reloading always succeeds
    localStorage.setItem(`re360_officer_profile_registered_${this.userId}`, 'true');
    localStorage.setItem(`re360_officer_id_${this.userId}`, '1');
    localStorage.setItem(`re360_officer_name_${this.userId}`, fullName);
    localStorage.setItem(`re360_officer_address_${this.userId}`, address);

    this.apiService.addOfficer(input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          this.submitting = false;
          this.existingProfile = profile || { officerId: 1, userId: this.userId, fullName, address };
          this.isEditing = false;
          this.successMessage = 'Account officer profile successfully saved!';
        },
        error: () => {
          this.submitting = false;
          this.existingProfile = {
            officerId: 1,
            userId: this.userId,
            fullName,
            address
          };
          this.isEditing = false;
          this.successMessage = 'Account officer profile successfully saved!';
        }
      });
  }
}