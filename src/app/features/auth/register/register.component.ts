import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CommonModule } from '@angular/common';
import DOMPurify from 'dompurify';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  registerForm!: FormGroup;
  loading = false;
  submitted = false;
  errorMessage = '';

  selectedAvatar = 'avatar_1';

  avatarOptions = [
    { id: 'avatar_1', emoji: '🧑‍💻', color: '#4f46e5', label: 'Coder' },
    { id: 'avatar_2', emoji: '👩‍💼', color: '#db2777', label: 'Agent' },
    { id: 'avatar_3', emoji: '🧑‍🚀', color: '#0ea5e9', label: 'Astro' },
    { id: 'avatar_4', emoji: '🦁', color: '#f59e0b', label: 'Lion' },
    { id: 'avatar_5', emoji: '🦊', color: '#10b981', label: 'Fox' },
    { id: 'avatar_6', emoji: '🐼', color: '#8b5cf6', label: 'Panda' },
    { id: 'avatar_7', emoji: '🦄', color: '#ec4899', label: 'Unicorn' },
    { id: 'avatar_8', emoji: '🐨', color: '#64748b', label: 'Koala' }
  ];

  ngOnInit(): void {
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/']);
    }

    this.registerForm = this.fb.group({
      userName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      emailId: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      role: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(20)]],
      status: ['ACTIVE']
    });
  }

  // Easy access wrapper for form controls in HTML
  get f() { 
    return this.registerForm.controls; 
  }

  selectAvatar(avatarId: string): void {
    this.selectedAvatar = avatarId;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    // Mark all controls as touched on submit so dirty/touched checks trigger for unvisited invalid inputs
    this.registerForm.markAllAsTouched();

    // Standard client-side form validation check
    if (this.registerForm.invalid) {
      return;
    }

    // 1. Sanitize the user-entered name to strip out all HTML tags
    const rawName = this.registerForm.value.userName;
    const sanitizedName = DOMPurify.sanitize(rawName, { ALLOWED_TAGS: [] }).trim();

    // 2. Safety Check: Stop execution if sanitization wiped out the name (e.g., input was pure script)
    if (sanitizedName.length < 3) {
      this.errorMessage = 'Please enter a valid name. HTML or script tags are not allowed.';
      return;
    }

    this.loading = true;

    // 3. Construct the clean payload
    const sanitizedRegistrationData = {
      ...this.registerForm.value,
      userName: sanitizedName
    };

    // 4. Submit the clean, sanitized data to the API
    this.authService.register(sanitizedRegistrationData).subscribe({
      next: (response) => {
        this.loading = false;
        
        // Save selected avatar mapping locally
        localStorage.setItem(`re360_avatar_${response.userId}`, this.selectedAvatar);
        localStorage.setItem(`re360_avatar_${response.emailId}`, this.selectedAvatar);
        
        // Redirect to login with success parameters
        this.router.navigate(['/login'], { 
          queryParams: { registered: 'true', email: response.emailId } 
        });
      },
      error: err => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Registration failed. Email might already exist.';
      }
    });
  }
}