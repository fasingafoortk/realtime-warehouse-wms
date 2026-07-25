import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container">
      <!-- Sidebar -->
      <aside class="sidebar glass-panel">
        <div class="sidebar-brand">
          <div class="logo">⚡</div>
          <div class="brand-text">
            <h2>LogiWMS</h2>
            <span class="version">v1.2.0 (Stable)</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <span class="icon">📊</span>
            <span>Dashboard</span>
          </a>
          <a routerLink="/inventory" routerLinkActive="active" class="nav-item">
            <span class="icon">📦</span>
            <span>Inventory</span>
          </a>
          <a routerLink="/inbound" routerLinkActive="active" class="nav-item">
            <span class="icon">📥</span>
            <span>Inbound</span>
          </a>
          <a routerLink="/outbound" routerLinkActive="active" class="nav-item">
            <span class="icon">📤</span>
            <span>Outbound Orders</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="user-profile" *ngIf="authService.currentUser() as user">
            <div class="avatar">
              {{ user.name.substring(0, 2).toUpperCase() }}
            </div>
            <div class="user-info">
              <span class="name">{{ user.name }}</span>
              <span class="role badge" [ngClass]="getRoleClass(user.role)">{{ user.role }}</span>
            </div>
          </div>
          <button (click)="logout()" class="btn-logout" title="Log Out">
            <span class="logout-icon">↩</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <!-- Main Layout -->
      <div class="main-layout">
        <header class="top-header glass-panel">
          <div class="header-left">
            <h1 class="page-title">{{ getPageTitle() }}</h1>
          </div>
          <div class="header-right">
            <div class="sys-health">
              <span class="indicator"></span>
              <span class="health-text">Live Connection</span>
            </div>
          </div>
        </header>

        <main class="content-area">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      min-height: 100vh;
      background-color: var(--bg-main);
      position: relative;
    }
    
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: var(--sidebar-width);
      border-radius: 0;
      border-top: none;
      border-left: none;
      border-bottom: none;
      display: flex;
      flex-direction: column;
      padding: 24px;
      z-index: 10;
    }
    
    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 40px;
    }
    
    .logo {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border-radius: 10px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 1.25rem;
      box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
    }
    
    .brand-text h2 {
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1.1;
    }
    
    .version {
      font-size: 0.7rem;
      color: var(--text-muted);
    }
    
    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }
    
    .nav-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      color: var(--text-muted);
      text-decoration: none;
      border-radius: 10px;
      font-weight: 500;
      font-size: 0.95rem;
      transition: all var(--transition-fast);
    }
    
    .nav-item:hover {
      background: rgba(255, 255, 255, 0.03);
      color: #fff;
    }
    
    .nav-item.active {
      background: rgba(99, 102, 241, 0.1);
      color: var(--primary);
      border: 1px solid rgba(99, 102, 241, 0.15);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.05);
    }
    
    .nav-item .icon {
      font-size: 1.2rem;
    }
    
    .sidebar-footer {
      border-top: 1px solid var(--border-color);
      padding-top: 20px;
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .user-profile {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .avatar {
      width: 40px;
      height: 40px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #818cf8;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: 700;
      font-size: 0.9rem;
    }
    
    .user-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .user-info .name {
      font-weight: 600;
      font-size: 0.9rem;
      color: #fff;
    }
    
    .user-info .role {
      font-size: 0.65rem;
      padding: 2px 6px;
    }
    
    .btn-logout {
      background: transparent;
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 8px;
      color: #fca5a5;
      padding: 10px 16px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      transition: all var(--transition-fast);
    }
    
    .btn-logout:hover {
      background: rgba(239, 68, 68, 0.08);
      border-color: rgba(239, 68, 68, 0.4);
    }
    
    .btn-logout .logout-icon {
      font-size: 1.1rem;
    }
    
    .main-layout {
      margin-left: var(--sidebar-width);
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    
    .top-header {
      height: var(--header-height);
      position: sticky;
      top: 0;
      border-radius: 0;
      border-top: none;
      border-left: none;
      border-right: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 40px;
      z-index: 5;
    }
    
    .page-title {
      font-size: 1.35rem;
    }
    
    .sys-health {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(20, 184, 166, 0.08);
      border: 1px solid rgba(20, 184, 166, 0.2);
      padding: 6px 12px;
      border-radius: 20px;
    }
    
    .indicator {
      width: 8px;
      height: 8px;
      background: #14b8a6;
      border-radius: 50%;
      box-shadow: 0 0 8px #14b8a6;
      animation: pulse 2s infinite;
    }
    
    .health-text {
      font-size: 0.75rem;
      font-weight: 600;
      color: #2dd4bf;
    }
    
    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }
    
    .content-area {
      padding: 40px;
      flex: 1;
    }
    
    @media (max-width: 768px) {
      .sidebar {
        display: none; /* In production scale, this would collapse/toggle */
      }
      .main-layout {
        margin-left: 0;
      }
      .top-header {
        padding: 0 20px;
      }
      .content-area {
        padding: 20px;
      }
    }
  `]
})
export class LayoutComponent {
  public authService = inject(AuthService);
  private socketService = inject(WebSocketService);
  private router = inject(Router);

  constructor() {
    // Open live WebSocket connection on layout mount
    this.socketService.connect();
  }

  public getPageTitle(): string {
    const url = this.router.url;
    if (url.includes('/dashboard')) return 'Analytics Dashboard';
    if (url.includes('/inventory')) return 'Inventory Management';
    if (url.includes('/inbound')) return 'Inbound Logistics (Receiving)';
    if (url.includes('/outbound')) return 'Outbound Logistics (Orders)';
    return 'WMS Portal';
  }

  public getRoleClass(role: string): string {
    switch (role) {
      case 'Admin': return 'badge-cancelled';
      case 'Warehouse Manager': return 'badge-reserved';
      case 'Picker': return 'badge-picked';
      case 'Auditor': return 'badge-received';
      default: return 'badge-pending';
    }
  }

  public logout(): void {
    this.socketService.disconnect();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
export default LayoutComponent;
