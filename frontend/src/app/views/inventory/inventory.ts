import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { WarehouseService } from '../../services/warehouse.service';
import { WebSocketService } from '../../services/websocket.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="inventory-container">
      <!-- Actions & Filters -->
      <div class="glass-panel tools-panel">
        <div class="filters">
          <div class="filter-group">
            <label for="wh-filter">Warehouse:</label>
            <select id="wh-filter" (change)="onWarehouseChange($event)">
              <option value="">All Warehouses</option>
              <option *ngFor="let wh of warehouses()" [value]="wh._id">{{ wh.name }}</option>
            </select>
          </div>
          <div class="filter-group checkbox-group">
            <input id="low-stock-check" type="checkbox" (change)="onLowStockToggle($event)" />
            <label for="low-stock-check">⚠️ Low Stock Alerts</label>
          </div>
        </div>

        <button 
          *ngIf="authService.isAdmin()" 
          (click)="openAdjustModal()" 
          class="btn-primary"
        >
          🔧 Adjust Stock
        </button>
      </div>

      <!-- Main Grid -->
      <div class="inventory-grid">
        <!-- Stock Table -->
        <div class="glass-panel table-panel">
          <div class="panel-header">
            <h2>Real-time Stock Levels</h2>
            <span class="live-tag">● LIVE UPDATES</span>
          </div>

          <div class="table-container">
            <table *ngIf="inventoryItems().length > 0; else emptyStock">
              <thead>
                <tr>
                  <th>SKU Details</th>
                  <th>Warehouse</th>
                  <th>Bin locations</th>
                  <th>Available</th>
                  <th>Reserved</th>
                  <th>Total Physical</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <!-- We map bins nested or flat. getInventoryLevels returned grouped by SKU & Warehouse -->
                <ng-container *ngFor="let item of inventoryItems()">
                  <tr 
                    *ngFor="let bin of item.bins" 
                    [class.row-highlight]="isHighlighted(item.skuId, bin.binId)"
                  >
                    <td>
                      <div class="sku-cell">
                        <strong class="text-white">{{ item.skuCode }}</strong>
                        <span class="sku-name">{{ item.skuName }}</span>
                      </div>
                    </td>
                    <td>{{ item.warehouseCode }}</td>
                    <td>
                      <span class="bin-tag">{{ getBinCode(bin.binId) || 'RCV-DOCK' }}</span>
                    </td>
                    <td>
                      <span 
                        [class.text-danger]="bin.quantityAvailable < item.reorderPoint"
                        [class.text-success]="bin.quantityAvailable >= item.reorderPoint"
                        class="qty-val"
                      >
                        {{ bin.quantityAvailable }}
                      </span>
                      <span *ngIf="bin.quantityAvailable < item.reorderPoint" class="alert-icon" title="Below Reorder Point">⚠️</span>
                    </td>
                    <td>{{ bin.quantityReserved }}</td>
                    <td><strong class="text-white">{{ bin.quantityOnHand }}</strong></td>
                    <td>
                      <button (click)="getSuggestions(item.skuId, item.warehouseId)" class="btn-action">
                        Suggest Bins
                      </button>
                    </td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
            
            <ng-template #emptyStock>
              <div class="empty-state">
                <span class="icon">📦</span>
                <p>No inventory records found matching filters.</p>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Suggestions Sidebar -->
        <div class="glass-panel suggestions-panel" *ngIf="activeSuggestionsSKU()">
          <div class="panel-header border">
            <h2>Putaway Suggestions</h2>
            <button (click)="activeSuggestionsSKU.set(null)" class="btn-close">×</button>
          </div>
          <p class="panel-intro">Directed suggestions for storage bins in warehouse.</p>
          
          <div class="suggestions-list" *ngIf="suggestions().length > 0; else emptySuggestions">
            <div class="suggestion-card glass-card" *ngFor="let s of suggestions()">
              <div class="sug-header">
                <span class="bin-name">{{ s.binCode }}</span>
                <span class="score-badge">Score: {{ s.score }}</span>
              </div>
              <div class="sug-body">
                <div class="sug-row">
                  <span>Capacity Limit:</span>
                  <strong>{{ s.maxCapacityCount }} units</strong>
                </div>
                <div class="sug-row">
                  <span>Utilization:</span>
                  <strong>{{ s.utilizationRate | number:'1.0-1' }}%</strong>
                </div>
              </div>
            </div>
          </div>
          <ng-template #emptySuggestions>
            <div class="empty-state small">
              <p>No compatible bins with space found in this facility.</p>
            </div>
          </ng-template>
        </div>
      </div>

      <!-- Adjust Stock Modal (Admin Only) -->
      <div class="modal-backdrop" *ngIf="isAdjustModalOpen()">
        <div class="glass-panel modal-card">
          <h2>🔧 Inventory Adjustment</h2>
          <p class="modal-desc">Force physical stock level overrides. This creates an ADJUSTMENT audit entry.</p>

          <form [formGroup]="adjustForm" (ngSubmit)="onAdjustSubmit()" class="modal-form">
            <div class="form-group">
              <label for="adj-wh">Warehouse</label>
              <select id="adj-wh" formControlName="warehouseId" (change)="onAdjustWhChange()">
                <option value="">Select Warehouse</option>
                <option *ngFor="let wh of warehouses()" [value]="wh._id">{{ wh.name }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="adj-bin">Bin Location</label>
              <select id="adj-bin" formControlName="binId">
                <option value="">Select Bin</option>
                <option *ngFor="let bin of bins()" [value]="bin._id">{{ bin.code }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="adj-sku">SKU Catalog Item</label>
              <select id="adj-sku" formControlName="skuId">
                <option value="">Select SKU</option>
                <option *ngFor="let s of skus()" [value]="s._id">{{ s.code }} - {{ s.name }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="adj-qty">Physical QuantityOnHand</label>
              <input id="adj-qty" type="number" formControlName="quantity" min="0" placeholder="e.g. 150" />
            </div>

            <div class="form-group">
              <label for="adj-notes">Reason / Notes</label>
              <textarea id="adj-notes" formControlName="notes" rows="2" placeholder="e.g. Cycle count correction"></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" (click)="closeAdjustModal()" class="btn-secondary">Cancel</button>
              <button type="submit" [disabled]="adjustForm.invalid" class="btn-primary">Adjust Stock</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .inventory-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    
    .tools-panel {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
    }
    
    .filters {
      display: flex;
      align-items: center;
      gap: 30px;
    }
    
    .filter-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .filter-group select {
      min-width: 200px;
    }
    
    .checkbox-group {
      gap: 8px;
      cursor: pointer;
    }
    
    .checkbox-group input {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    
    .inventory-grid {
      display: flex;
      gap: 25px;
      align-items: flex-start;
    }
    
    .table-panel {
      flex: 1;
      padding: 25px;
    }
    
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .panel-header.border {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }
    
    .live-tag {
      font-size: 0.75rem;
      font-weight: 700;
      color: #14b8a6;
      background: rgba(20, 184, 166, 0.1);
      padding: 4px 10px;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }
    
    .sku-cell {
      display: flex;
      flex-direction: column;
    }
    
    .sku-name {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    .bin-tag {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      padding: 4px 8px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.8rem;
    }
    
    .qty-val {
      font-weight: 700;
      font-size: 0.95rem;
    }
    
    .text-danger { color: #f43f5e; }
    .text-success { color: #10b981; }
    
    .alert-icon {
      margin-left: 6px;
      font-size: 0.9rem;
    }
    
    .btn-action {
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.2);
      color: var(--primary);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .btn-action:hover {
      background: var(--primary);
      color: #fff;
    }
    
    /* Highlight Row Effect */
    tr.row-highlight td {
      background-color: rgba(99, 102, 241, 0.2) !important;
      border-bottom-color: rgba(99, 102, 241, 0.4);
      transition: background-color 0s;
    }
    
    tr {
      transition: background-color 1s ease-out;
    }
    
    /* Suggestions panel */
    .suggestions-panel {
      width: 320px;
      padding: 25px;
      animation: slideIn var(--transition-normal);
    }
    
    @keyframes slideIn {
      from { transform: translateX(20px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    .panel-intro {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 20px;
    }
    
    .btn-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.5rem;
      cursor: pointer;
    }
    
    .btn-close:hover { color: #fff; }
    
    .suggestions-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .suggestion-card {
      padding: 16px;
    }
    
    .sug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .bin-name {
      font-weight: 700;
      color: #fff;
      font-family: monospace;
    }
    
    .score-badge {
      font-size: 0.7rem;
      background: rgba(20, 184, 166, 0.1);
      color: #14b8a6;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    
    .sug-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.8rem;
    }
    
    .sug-row {
      display: flex;
      justify-content: space-between;
      color: var(--text-muted);
    }
    
    .sug-row strong { color: #fff; }
    
    /* Modals */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 100;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .modal-card {
      width: 100%;
      max-width: 500px;
      padding: 35px;
      background: #0f172a !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 16px !important;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
    }
    
    .modal-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 25px;
      text-align: left;
    }
    
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 15px;
      width: 100%;
      text-align: left;
    }
    
    .form-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
    }
    
    .form-group select, .form-group input, .form-group textarea {
      background: #0b0f19 !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 8px !important;
      color: #fff !important;
      padding: 12px 16px !important;
      font-family: inherit;
      font-size: 0.95rem;
      width: 100%;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    
    .form-group select:focus, .form-group input:focus, .form-group textarea:focus {
      border-color: #6366f1 !important;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25) !important;
    }
    
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 15px;
      margin-top: 15px;
    }

    .modal-actions .btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
      color: #fff !important;
      border: none !important;
      border-radius: 8px !important;
      padding: 12px 24px !important;
      font-weight: 600 !important;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4) !important;
      transition: opacity 0.2s;
    }

    .modal-actions .btn-primary:hover {
      opacity: 0.95;
    }
    
    .modal-actions .btn-secondary {
      background: rgba(255, 255, 255, 0.05) !important;
      color: var(--text-main) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 8px !important;
      padding: 12px 24px !important;
      font-weight: 600 !important;
      cursor: pointer;
    }

    .modal-actions .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1) !important;
    }
  `]
})
export class InventoryComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private inventoryService = inject(InventoryService);
  private warehouseService = inject(WarehouseService);
  private socketService = inject(WebSocketService);
  private fb = inject(FormBuilder);

  // Signals
  public readonly warehouses = signal<any[]>([]);
  public readonly bins = signal<any[]>([]);
  public readonly skus = signal<any[]>([]);
  public readonly inventoryItems = signal<any[]>([]);
  
  public readonly selectedWh = signal<string>('');
  public readonly lowStockFilter = signal<boolean>(false);
  
  public readonly suggestions = signal<any[]>([]);
  public readonly activeSuggestionsSKU = signal<string | null>(null);

  // Modals
  public readonly isAdjustModalOpen = signal<boolean>(false);
  public adjustForm!: FormGroup;

  // Highlights Map
  private highlights = new Map<string, boolean>();
  private socketSubs: Subscription[] = [];
  
  // Cache of bins mapping binId -> code
  private binCache = new Map<string, string>();

  public ngOnInit(): void {
    this.loadInitialData();
    this.loadInventory();
    this.setupSocketSub();
  }

  public ngOnDestroy(): void {
    this.socketSubs.forEach((s) => s.unsubscribe());
    if (this.selectedWh()) {
      this.socketService.leaveWarehouse(this.selectedWh());
    }
  }

  private loadInitialData(): void {
    this.warehouseService.listWarehouses().subscribe((data) => this.warehouses.set(data));
    this.warehouseService.listSKUs({ limit: 100 }).subscribe((res) => this.skus.set(res.data));
  }

  private loadInventory(): void {
    this.inventoryService
      .getInventory({
        warehouseId: this.selectedWh(),
        lowStock: this.lowStockFilter(),
        limit: 100,
      })
      .subscribe({
        next: (res) => {
          this.inventoryItems.set(res.data);
          // Prefetch bin details to display human readable codes
          this.prefetchBins();
        },
        error: (err) => console.error('Failed to load inventory levels', err),
      });
  }

  private prefetchBins(): void {
    const whId = this.selectedWh();
    if (!whId) return;

    this.warehouseService.listBins(whId).subscribe((binsList) => {
      binsList.forEach((b) => this.binCache.set(b._id, b.code));
    });
  }

  public getBinCode(binId: string): string {
    return this.binCache.get(binId) || '';
  }

  private setupSocketSub(): void {
    // Listen to warehouse-specific updates
    this.socketSubs.push(
      this.socketService.onStockUpdate().subscribe((data) => {
        this.processRealTimeUpdate(data);
      })
    );

    // Listen to global updates
    this.socketSubs.push(
      this.socketService.onGlobalStockUpdate().subscribe((data) => {
        if (!this.selectedWh() || data.warehouseId === this.selectedWh()) {
          this.processRealTimeUpdate(data);
        }
      })
    );
  }

  private processRealTimeUpdate(data: any): void {
    // Update local signal list
    const items = [...this.inventoryItems()];
    let updated = false;

    for (const item of items) {
      if (item.skuId === data.skuId) {
        const binIndex = item.bins.findIndex((b: any) => b.binId === data.binId);
        if (binIndex !== -1) {
          // Update bin stock details
          item.bins[binIndex] = {
            ...item.bins[binIndex],
            quantityOnHand: data.quantityOnHand,
            quantityReserved: data.quantityReserved,
            quantityAvailable: data.quantityAvailable,
          };
          updated = true;
          break;
        } else {
          // New bin allocation for SKU
          item.bins.push({
            binId: data.binId,
            quantityOnHand: data.quantityOnHand,
            quantityReserved: data.quantityReserved,
            quantityAvailable: data.quantityAvailable,
          });
          updated = true;
          break;
        }
      }
    }

    if (updated) {
      this.inventoryItems.set(items);
      
      // Highlight the updated row
      const key = `${data.skuId}-${data.binId}`;
      this.highlights.set(key, true);
      setTimeout(() => this.highlights.delete(key), 1200);
    } else {
      // If SKU was not present in table, reload full inventory list
      this.loadInventory();
    }
  }

  public isHighlighted(skuId: string, binId: string): boolean {
    return this.highlights.has(`${skuId}-${binId}`);
  }

  public onWarehouseChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const whId = target.value;

    if (this.selectedWh()) {
      this.socketService.leaveWarehouse(this.selectedWh());
    }

    this.selectedWh.set(whId);

    if (whId) {
      this.socketService.joinWarehouse(whId);
    }

    this.loadInventory();
  }

  public onLowStockToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.lowStockFilter.set(target.checked);
    this.loadInventory();
  }

  public getSuggestions(skuId: string, warehouseId: string): void {
    this.activeSuggestionsSKU.set(skuId);
    this.inventoryService.getPutawaySuggestions(skuId, warehouseId).subscribe({
      next: (data) => this.suggestions.set(data),
      error: () => this.suggestions.set([]),
    });
  }

  // Adjustment Modal
  public openAdjustModal(): void {
    this.adjustForm = this.fb.group({
      warehouseId: ['', Validators.required],
      binId: ['', Validators.required],
      skuId: ['', Validators.required],
      quantity: [0, [Validators.required, Validators.min(0)]],
      notes: [''],
    });

    this.isAdjustModalOpen.set(true);
  }

  public closeAdjustModal(): void {
    this.isAdjustModalOpen.set(false);
  }

  public onAdjustWhChange(): void {
    const whId = this.adjustForm.get('warehouseId')?.value;
    if (whId) {
      this.warehouseService.listBins(whId).subscribe((data) => this.bins.set(data));
    } else {
      this.bins.set([]);
    }
  }

  public onAdjustSubmit(): void {
    if (this.adjustForm.invalid) return;

    this.inventoryService.adjustStock(this.adjustForm.value).subscribe({
      next: () => {
        this.closeAdjustModal();
        this.loadInventory();
      },
      error: (err) => alert(err?.detail || 'Failed to adjust stock.'),
    });
  }
}
export default InventoryComponent;
