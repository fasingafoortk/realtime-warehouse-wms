import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogisticsService } from '../../services/logistics.service';
import { WarehouseService } from '../../services/warehouse.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <!-- Warehouse Filter -->
      <div class="filter-header glass-panel">
        <label for="warehouse-select">Active Facility:</label>
        <select id="warehouse-select" (change)="onWarehouseChange($event)">
          <option value="">All Warehouses / Global View</option>
          <option *ngFor="let wh of warehouses()" [value]="wh._id">
            {{ wh.name }} ({{ wh.code }})
          </option>
        </select>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading()">
        <div class="spinner"></div>
        <p>Calculating logistics KPIs...</p>
      </div>

      <!-- Error State -->
      <div class="error-state glass-panel" *ngIf="errorMessage()">
        <span class="icon">⚠️</span>
        <p>{{ errorMessage() }}</p>
        <button (click)="loadKPIs()" class="btn-primary">Try Again</button>
      </div>

      <!-- Dashboard Grid -->
      <div class="dashboard-content" *ngIf="!isLoading() && !errorMessage()">
        <!-- KPI Card Grid -->
        <div class="kpi-grid">
          <div class="glass-card kpi-card">
            <span class="card-icon blue">📦</span>
            <div class="card-info">
              <h3>On-Hand Stock</h3>
              <h2>{{ kpis()?.stockMetrics?.totalOnHand | number }}</h2>
              <p>Physical units in bins</p>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <span class="card-icon purple">🔒</span>
            <div class="card-info">
              <h3>Reserved Stock</h3>
              <h2>{{ kpis()?.stockMetrics?.totalReserved | number }}</h2>
              <p>Allocated to outbound orders</p>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <span class="card-icon green">⚡</span>
            <div class="card-info">
              <h3>Available Stock</h3>
              <h2>{{ kpis()?.stockMetrics?.totalAvailable | number }}</h2>
              <p>Ready to fulfill</p>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <span class="card-icon red">🚨</span>
            <div class="card-info">
              <h3>Stockouts</h3>
              <h2>{{ kpis()?.stockoutsCount }}</h2>
              <p>SKUs at zero inventory</p>
            </div>
          </div>
        </div>

        <!-- Charts / Analytics Grid -->
        <div class="analytics-grid">
          <!-- Fulfillment Metrics -->
          <div class="glass-panel analytics-panel">
            <h2>Order Fulfillment Performance</h2>
            <div class="fulfillment-box">
              <div class="duration-meter">
                <span class="meter-val">{{ kpis()?.fulfillment?.avgHours }}h</span>
                <span class="meter-lbl">Avg Fulfillment Time</span>
              </div>
              <div class="fulfillment-details">
                <p>Calculated based on orders dispatched in the last 30 days.</p>
                <div class="detail-row">
                  <span class="lbl">Total Dispatched:</span>
                  <span class="val">{{ kpis()?.fulfillment?.totalShipped }} orders</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SKU Turnover Rates -->
          <div class="glass-panel analytics-panel">
            <h2>Fastest Inventory Turnover (Last 30d)</h2>
            <div class="turnover-list" *ngIf="kpis()?.turnoverRates?.length > 0; else noTurnover">
              <div class="turnover-row" *ngFor="let item of kpis()?.turnoverRates">
                <div class="item-desc">
                  <span class="code">{{ item.code }}</span>
                  <span class="name">{{ item.name }}</span>
                </div>
                <div class="item-stats">
                  <div class="progress-container">
                    <div class="progress-bar" [style.width.%]="getTurnoverPercent(item.turnoverRate)"></div>
                  </div>
                  <span class="rate-val">{{ item.turnoverRate }}x</span>
                </div>
              </div>
            </div>
            <ng-template #noTurnover>
              <div class="empty-state">
                <p>No outbound stock movements logged in the last 30 days.</p>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Stockout Alert Table -->
        <div class="glass-panel stockouts-panel">
          <h2>Stockout Warnings</h2>
          <div class="table-container" *ngIf="kpis()?.stockouts?.length > 0; else noStockouts">
            <table>
              <thead>
                <tr>
                  <th>SKU Code</th>
                  <th>SKU Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of kpis()?.stockouts">
                  <td><strong class="text-white">{{ item.code }}</strong></td>
                  <td>{{ item.name }}</td>
                  <td><span class="badge badge-cancelled">OUT OF STOCK</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <ng-template #noStockouts>
            <div class="empty-state success">
              <span class="icon">✅</span>
              <p>Excellent! No SKUs are currently experiencing stockouts.</p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    
    .filter-header {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 16px 24px;
    }
    
    .filter-header select {
      max-width: 320px;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }
    
    .kpi-card {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 24px;
    }
    
    .card-icon {
      font-size: 2.2rem;
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .card-icon.blue { background: rgba(59, 130, 246, 0.1); }
    .card-icon.purple { background: rgba(139, 92, 246, 0.1); }
    .card-icon.green { background: rgba(16, 185, 129, 0.1); }
    .card-icon.red { background: rgba(239, 68, 68, 0.1); }
    
    .card-info h3 {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    
    .card-info h2 {
      font-size: 1.8rem;
      color: #fff;
      line-height: 1.1;
      margin-bottom: 4px;
    }
    
    .card-info p {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    .analytics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
    }
    
    .analytics-panel {
      padding: 25px;
    }
    
    .analytics-panel h2, .stockouts-panel h2 {
      font-size: 1.1rem;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }
    
    .fulfillment-box {
      display: flex;
      align-items: center;
      gap: 40px;
      padding: 20px 0;
    }
    
    .duration-meter {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 140px;
      height: 140px;
      border: 4px solid rgba(99, 102, 241, 0.15);
      border-top-color: var(--primary);
      border-radius: 50%;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.12);
      background: rgba(99, 102, 241, 0.01);
      padding: 10px;
    }
    
    .duration-meter .meter-val {
      font-size: 2.2rem;
      font-weight: 800;
      color: #fff;
      font-family: 'Outfit', sans-serif;
      line-height: 1;
    }
    
    .duration-meter .meter-lbl {
      font-size: 0.6rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 6px;
      text-align: center;
      max-width: 90px;
      line-height: 1.2;
    }
    
    .fulfillment-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .fulfillment-details p {
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed var(--border-color);
      padding-bottom: 8px;
      font-size: 0.9rem;
    }
    
    .detail-row .lbl { color: var(--text-muted); }
    .detail-row .val { font-weight: 600; color: #fff; }
    
    .turnover-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .turnover-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    
    .item-desc {
      display: flex;
      flex-direction: column;
      width: 140px;
    }
    
    .item-desc .code {
      font-weight: 700;
      font-size: 0.85rem;
      color: #fff;
    }
    
    .item-desc .name {
      font-size: 0.75rem;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .item-stats {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .progress-container {
      flex: 1;
      height: 8px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      border-radius: 4px;
    }
    
    .rate-val {
      font-size: 0.85rem;
      font-weight: 700;
      color: #fff;
      min-width: 35px;
      text-align: right;
    }
    
    .stockouts-panel {
      padding: 25px;
    }
    
    .empty-state {
      text-align: center;
      padding: 30px;
      color: var(--text-muted);
    }
    
    .empty-state.success {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 20px;
    }
    
    .empty-state.success .icon {
      font-size: 2rem;
    }
    
    .loading-state, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      gap: 15px;
    }
    
    .spinner {
      width: 30px;
      height: 30px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      border-top-color: var(--primary);
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 1024px) {
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    
    @media (max-width: 768px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
      .analytics-grid {
        grid-template-columns: 1fr;
      }
      .fulfillment-box {
        flex-direction: column;
        gap: 25px;
        align-items: center;
        text-align: center;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private logisticsService = inject(LogisticsService);
  private warehouseService = inject(WarehouseService);

  public readonly warehouses = signal<any[]>([]);
  public readonly selectedWarehouseId = signal<string>('');
  
  public readonly kpis = signal<any>(null);
  public readonly isLoading = signal(true);
  public readonly errorMessage = signal<string | null>(null);

  public ngOnInit(): void {
    this.loadWarehouses();
    this.loadKPIs();
  }

  public loadWarehouses(): void {
    this.warehouseService.listWarehouses().subscribe({
      next: (data) => this.warehouses.set(data),
      error: () => console.error('Failed to load warehouses list')
    });
  }

  public loadKPIs(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.logisticsService.getKPIs(this.selectedWarehouseId()).subscribe({
      next: (data) => {
        this.kpis.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.detail || 'Failed to calculate analytics KPIs.');
        this.isLoading.set(false);
      },
    });
  }

  public onWarehouseChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedWarehouseId.set(target.value);
    this.loadKPIs();
  }

  public getTurnoverPercent(rate: number): number {
    // Arbitrary scale for rendering. If turnover rate is e.g. 5.0, render full bar (100%)
    return Math.min(100, Math.max(10, rate * 20));
  }
}
export default DashboardComponent;
