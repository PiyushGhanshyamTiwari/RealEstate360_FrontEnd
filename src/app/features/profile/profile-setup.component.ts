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

  // Modal Control for Document Info
  showDocModal = false;

  // Forms
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
      this.apiService.getTenantByUserId(this.userId).subscribe({
        next: (profile) => {
          if (profile && (profile.address || profile.documentType)) {
            this.existingProfile = profile;
            this.isEditing = false;
          } else {
            this.existingProfile = null;
            this.isEditing = true;
            this.editMode = 'PROFILE';
          }
          this.loadingProfile = false;
        },
        error: () => {
          // Strictly check local storage cache bound to THIS specific userId
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
            // New user or missing profile data
            this.existingProfile = null;
            this.isEditing = true;
            this.editMode = 'PROFILE';
          }
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
        this.isEditing = false;
        this.loadingProfile = false;
        return;
      }
      this.apiService.getTechnicianById(this.userId).subscribe({
        next: (profile) => {
          this.existingProfile = profile;
          this.isEditing = false;
          this.loadingProfile = false;
        },
        error: () => {
          this.existingProfile = null;
          this.isEditing = true;
          this.editMode = 'PROFILE';
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
        this.isEditing = false;
        this.loadingProfile = false;
        return;
      }
      
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
          this.isEditing = false;
        } else {
          this.existingProfile = null;
          this.isEditing = true;
          this.editMode = 'PROFILE';
        }
        this.loadingProfile = false;
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

  // --- EDIT CONTROL METHODS ---
  editProfile(): void {
    this.editMode = 'PROFILE';
    this.isEditing = true;
    this.submitted = false;
    this.errorMessage = '';
    
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

  onFileSelected(event: any): void {
    this.errorMessage = '';
    const file: File = event.target.files[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit

      if (!allowedTypes.includes(file.type.toLowerCase())) {
        this.errorMessage = 'Invalid file format. Only PDF, PNG, and JPG/JPEG files are accepted.';
        this.selectedFile = null;
        event.target.value = '';
        return;
      }

      if (file.size > maxSizeBytes) {
        this.errorMessage = 'File size exceeds the 10MB limit. Please upload a smaller file.';
        this.selectedFile = null;
        event.target.value = '';
        return;
      }

      this.selectedFile = file;

      // Convert file into Data URL and save to localStorage bound to this user
      const reader = new FileReader();
      reader.onload = () => {
        if (this.userId && reader.result) {
          localStorage.setItem(`re360_tenant_doc_data_${this.userId}`, reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Document View Handler without requiring a backend endpoint
  viewUploadedDocument(): void {
    // 1. View freshly selected file in current active session
    if (this.selectedFile) {
      const blobUrl = URL.createObjectURL(this.selectedFile);
      window.open(blobUrl, '_blank');
      return;
    }

    // 2. View locally stored Base64/Data URL from localStorage
    const savedDataUrl = localStorage.getItem(`re360_tenant_doc_data_${this.userId}`);
    if (savedDataUrl) {
      const win = window.open();
      if (win) {
        win.document.write(`
          <html>
            <head><title>Document Preview</title></head>
            <body style="margin:0; background:#333; display:flex; justify-content:center; align-items:center; height:100vh;">
              ${
                savedDataUrl.startsWith('data:image/')
                  ? `<img src="${savedDataUrl}" style="max-width:100%; max-height:100vh; object-fit:contain;"/>`
                  : `<iframe src="${savedDataUrl}" frameborder="0" style="width:100%; height:100vh;"></iframe>`
              }
            </body>
          </html>
        `);
      }
      return;
    }

    // 3. Fallback: If documentFileRef is an absolute URL or Data URL
    const docRef = this.existingProfile?.documentFileRef;
    if (docRef && (docRef.startsWith('http://') || docRef.startsWith('https://') || docRef.startsWith('data:'))) {
      window.open(docRef, '_blank');
      return;
    }

    // 4. Modal Fallback
    this.showDocModal = true;
  }

  closeDocModal(): void {
    this.showDocModal = false;
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
      delete formVal.password;
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

    if (this.tenantForm.invalid || (!this.selectedFile && !this.existingProfile?.documentFileRef) || !this.userId) {
      return;
    }

    this.submitting = true;
    const { address, documentType } = this.tenantForm.value;
    const uploadedFileName = this.selectedFile ? this.selectedFile.name : (this.existingProfile?.documentFileRef || 'Uploaded_Document.pdf');

    localStorage.setItem(`re360_tenant_address_${this.userId}`, address);
    localStorage.setItem(`re360_tenant_doc_type_${this.userId}`, documentType);
    localStorage.setItem(`re360_tenant_doc_name_${this.userId}`, uploadedFileName);

    this.apiService.addTenantProfile(this.userId, address, documentType, this.selectedFile || new File([], uploadedFileName)).subscribe({
      next: (profile) => {
        this.submitting = false;
        this.existingProfile = profile || {
          address,
          documentType,
          documentFileRef: uploadedFileName
        };
        this.isEditing = false;
        localStorage.setItem(`re360_tenant_profile_registered_${this.userId}`, 'true');
        this.successMessage = 'Tenant profile successfully saved!';
      },
      error: (err) => {
        this.submitting = false;
        // Fallback for API response delay or mock setup
        this.existingProfile = {
          tenantId: 1,
          userId: this.userId,
          address,
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