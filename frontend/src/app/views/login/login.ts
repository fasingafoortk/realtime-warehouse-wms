import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <div class="glow-sphere pos-1"></div>
      <div class="glow-sphere pos-2"></div>
      
      <div class="glass-panel login-card">
        <div class="card-header">
          <div class="logo-box">
            <span class="logo-icon">⚡</span>
          </div>
          <h1>WMS Portal</h1>
          <p class="subtitle">Logistics & Real-time Inventory Management</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="email">Email Address</label>
            <input 
              id="email" 
              type="email" 
              formControlName="email" 
              placeholder="e.g. manager@wms.com"
              [class.error]="isFieldInvalid('email')"
              autocomplete="email"
              required
            />
            <span class="error-text" *ngIf="isFieldInvalid('email')">
              Please enter a valid email address.
            </span>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input 
              id="password" 
              type="password" 
              formControlName="password" 
              placeholder="••••••••"
              [class.error]="isFieldInvalid('password')"
              autocomplete="current-password"
              required
            />
            <span class="error-text" *ngIf="isFieldInvalid('password')">
              Password must be at least 6 characters.
            </span>
          </div>

          <div class="error-alert" *ngIf="errorMessage()">
            <span class="alert-icon">⚠️</span>
            <span class="alert-message">{{ errorMessage() }}</span>
          </div>

          <button type="submit" class="btn-primary login-btn" [disabled]="isLoading() || loginForm.invalid">
            <span *ngIf="isLoading()" class="spinner"></span>
            {{ isLoading() ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>

        <div class="demo-credentials">
          <h3>Quick Demo Access:</h3>
          <div class="cred-grid">
            <button type="button" class="btn-demo" (click)="fillCreds('admin@wms.com', 'Password123!', 'Admin')">Admin</button>
            <button type="button" class="btn-demo" (click)="fillCreds('manager@wms.com', 'Password123!', 'Warehouse Manager')">Manager</button>
            <button type="button" class="btn-demo" (click)="fillCreds('picker@wms.com', 'Password123!', 'Picker')">Picker</button>
            <button type="button" class="btn-demo" (click)="fillCreds('auditor@wms.com', 'Password123!', 'Auditor')">Auditor</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: #05070a;
      position: relative;
      overflow: hidden;
      padding: 20px;
    }
    
    .glow-sphere {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%);
      filter: blur(40px);
      z-index: 1;
    }
    
    .pos-1 {
      width: 400px;
      height: 400px;
      top: -100px;
      right: -100px;
    }
    
    .pos-2 {
      width: 500px;
      height: 500px;
      bottom: -150px;
      left: -150px;
    }
    
    .login-card {
      width: 100%;
      max-width: 480px;
      padding: 40px;
      z-index: 2;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    
    .card-header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .logo-box {
      width: 55px;
      height: 55px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border-radius: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 1.6rem;
      margin: 0 auto 15px auto;
      box-shadow: 0 8px 16px rgba(99, 102, 241, 0.3);
    }
    
    h1 {
      font-size: 1.8rem;
      margin-bottom: 5px;
    }
    
    .subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.03em;
    }
    
    input.error {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.15);
    }
    
    .error-text {
      font-size: 0.75rem;
      color: var(--accent);
      margin-top: -2px;
    }
    
    .error-alert {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(244, 63, 94, 0.1);
      border: 1px solid rgba(244, 63, 94, 0.2);
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 5px;
    }
    
    .alert-icon {
      font-size: 1.1rem;
    }
    
    .alert-message {
      font-size: 0.85rem;
      color: #fca5a5;
    }
    
    .login-btn {
      margin-top: 10px;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
    }
    
    .demo-credentials {
      margin-top: 35px;
      padding-top: 25px;
      border-top: 1px solid var(--border-color);
      text-align: center;
    }
    
    .demo-credentials h3 {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .cred-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    
    .btn-demo {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-main);
      padding: 8px 12px;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .btn-demo:hover {
      background: rgba(99, 102, 241, 0.08);
      border-color: rgba(99, 102, 241, 0.3);
      color: #fff;
    }
    
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  public readonly loginForm: FormGroup;
  public readonly isLoading = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  public isFieldInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  public fillCreds(email: string, pass: string, _role: string): void {
    this.loginForm.patchValue({ email, password: pass });
    this.errorMessage.set(null);
  }

  public onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.detail || 'Invalid credentials.');
      },
    });
  }
}
export default LoginComponent;
