import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loginForm!: FormGroup;
  loading = false;
  submitted = false;
  errorMessage = '';
  sessionExpired = false;
  returnUrl = '/';

  ngOnInit(): void {
    // Redirect if already logged in
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/']);
    }

    this.loginForm = this.fb.group({
      emailId: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    // Get parameters
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    this.sessionExpired = this.route.snapshot.queryParams['sessionExpired'] === 'true';
  }

  get f() { return this.loginForm.controls; }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.sessionExpired = false;

    // Mark all fields as touched to trigger validation UI for unvisited fields
    this.loginForm.markAllAsTouched();

    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl(this.returnUrl);
      },
      error: err => {
        this.loading = false;
        if (err.status === 403) {
          this.errorMessage = 'You are inactive, kindly contact admin.';
        } else if (err.status === 400) {
          this.errorMessage = 'Invalid email or password';
        } else {
          this.errorMessage = err.error?.message || err.error || 'Connection failed. Please verify the backend is running.';
        }
      }
    });
  }
}