import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CommonModule } from '@angular/common';

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

  get f() { return this.registerForm.controls; }

  selectAvatar(avatarId: string): void {
    this.selectedAvatar = avatarId;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.registerForm.invalid) {
      return;
    }

    this.loading = true;
    this.authService.register(this.registerForm.value).subscribe({
      next: (response) => {
        this.loading = false;
        // Save the chosen avatar key locally for this user
        localStorage.setItem(`re360_avatar_${response.userId}`, this.selectedAvatar);
        localStorage.setItem(`re360_avatar_${response.emailId}`, this.selectedAvatar);
        
        this.router.navigate(['/login'], { queryParams: { registered: 'true', email: response.emailId } });
      },
      error: err => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Registration failed. Email might already exist.';
      }
    });
  }
}
