import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { LogisticsService } from '../../services/logistics.service';
import { WarehouseService } from '../../services/warehouse.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-outbound',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="outbound-container">
      <div class="glass-panel tools-panel">
        <div class="filters">
          <button (click)="setStatusFilter('')" [class.btn-active]="!statusFilter()" class="btn-tab">All</button>
          <button (click)="setStatusFilter('PENDING')" [class.btn-active]="statusFilter() === 'PENDING'" class="btn-tab">Pending</button>
          <button (click)="setStatusFilter('RESERVED')" [class.btn-active]="statusFilter() === 'RESERVED'" class="btn-tab">Reserved</button>
          <button (click)="setStatusFilter('PICKED')" [class.btn-active]="statusFilter() === 'PICKED'" class="btn-tab">Picked</button>
          <button (click)="setStatusFilter('SHIPPED')" [class.btn-active]="statusFilter() === 'SHIPPED'" class="btn-tab">Shipped</button>
        </div>
        <button *ngIf="authService.isAdmin() || authService.isManager()" (click)="openCreateModal()" class="btn-primary">
          📤 New Outbound Order
        </button>
      </div>

      <div class="logistics-layout">
        <!-- Orders List -->
        <div class="glass-panel list-panel">
          <h2>Customer Orders</h2>
          <div class="table-container">
            <table *ngIf="orders().length > 0; else emptyOrders">
              <thead>
                <tr>
                  <th>Order Code</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Fulfillment</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of orders()" (click)="selectOrder(item)" class="clickable-row" [class.selected]="selectedOrder()?._id === item._id">
                  <td><strong class="text-white">{{ item.orderNumber }}</strong></td>
                  <td>{{ item.customerName }}</td>
                  <td><span class="badge" [ngClass]="getStatusClass(item.status)">{{ item.status }}</span></td>
                  <td>{{ item.items.length }} SKU(s)</td>
                  <td>
                    <!-- Display date dynamically -->
                    <span *ngIf="item.shippedAt; else noShip">Shipped {{ item.shippedAt | date:'shortDate' }}</span>
                    <ng-template #noShip>
                      <span class="text-muted">In Progress</span>
                    </ng-template>
                  </td>
                </tr>
              </tbody>
            </table>
            <ng-template #emptyOrders>
              <div class="empty-state">
                <p>No customer orders found.</p>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Details & Operations Wizard -->
        <div class="glass-panel details-panel" *ngIf="selectedOrder() as order">
          <div class="panel-header border">
            <h2>Order: {{ order.orderNumber }}</h2>
            <span class="badge" [ngClass]="getStatusClass(order.status)">{{ order.status }}</span>
          </div>

          <div class="meta-section">
            <div class="meta-row">
              <span class="lbl">Customer:</span>
              <strong class="val">{{ order.customerName }}</strong>
            </div>
            <div class="meta-row" *ngIf="order.assignedPickerId">
              <span class="lbl">Assigned Picker:</span>
              <span class="val">{{ order.assignedPickerId.name }}</span>
            </div>
            <div class="meta-row" *ngIf="order.reservedAt">
              <span class="lbl">Stock Reserved:</span>
              <span class="val">{{ order.reservedAt | date:'shortTime' }}</span>
            </div>
            <div class="meta-row" *ngIf="order.shippedAt">
              <span class="lbl">Shipped Date:</span>
              <span class="val">{{ order.shippedAt | date:'medium' }}</span>
            </div>
          </div>

          <!-- Wizard Forms -->
          <!-- State 1: PENDING -> RESERVED (Allocate Stock) -->
          <div class="wizard-box" *ngIf="order.status === 'PENDING' && !authService.isAuditor()">
            <h3>🔒 Lock Inventory Reservations</h3>
            <p>Execute FIFO allocation. Bins containing the oldest stock are automatically selected first.</p>

            <form [formGroup]="actionForm" (ngSubmit)="onReserveSubmit()" class="wizard-form">
              <div class="form-group">
                <label for="act-wh">Select Facility</label>
                <select id="act-wh" formControlName="warehouseId">
                  <option value="">Choose Warehouse</option>
                  <option *ngFor="let wh of warehouses()" [value]="wh._id">{{ wh.name }}</option>
                </select>
              </div>
              <button type="submit" [disabled]="actionForm.invalid" class="btn-primary full-width">
                Reserve Bins & Allocate Stock
              </button>
            </form>
          </div>

          <!-- State 2: RESERVED -> PICKED -->
          <div class="wizard-box" *ngIf="order.status === 'RESERVED' && !authService.isAuditor()">
            <h3>🏃 Picking Route Checklist</h3>
            <p>Navigate to the designated bins to retrieve stock. Mark as picked when physical assembly is complete.</p>

            <div class="pick-list">
              <div class="pick-item border" *ngFor="let item of order.items">
                <strong class="text-white">{{ item.skuId?.code }}</strong>
                <div class="allocation-rows">
                  <div class="alloc-row" *ngFor="let a of item.allocations">
                    <span>Bin: <strong class="text-white monospace">{{ getBinCode(a.binId) }}</strong></span>
                    <span>Quantity to Pick: <strong class="text-white">{{ a.quantity }}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <button type="button" (click)="onPickSubmit()" class="btn-primary full-width">
              Confirm Pick Assembly Complete
            </button>
            <button type="button" (click)="onCancelSubmit()" class="btn-secondary full-width margin-top">
              Cancel Order (Release Stock)
            </button>
          </div>

          <!-- State 3: PICKED -> SHIPPED -->
          <div class="wizard-box" *ngIf="order.status === 'PICKED' && !authService.isAuditor()">
            <h3>🚚 Dispatch & Loading Dock</h3>
            <p>Confirm loading dock carrier pickup. This physically decrements warehouse stock levels.</p>

            <form [formGroup]="actionForm" (ngSubmit)="onShipSubmit()" class="wizard-form">
              <input type="hidden" formControlName="warehouseId" />
              <button type="submit" class="btn-primary full-width">
                Dispatched / Ship Order
              </button>
            </form>
          </div>

          <!-- Items View List -->
          <div class="items-list-box">
            <h3>Ordered Manifest Items</h3>
            <div class="item-card glass-card" *ngFor="let item of order.items">
              <div class="item-card-header">
                <strong>{{ item.skuId?.code || 'SKU' }}</strong>
                <span>{{ item.skuId?.name || '' }}</span>
              </div>
              <div class="item-card-body flex-col">
                <div class="body-row">
                  <span>Requested: <strong>{{ item.quantityRequested }}</strong></span>
                  <span>Reserved: <strong>{{ item.quantityReserved }}</strong></span>
                </div>
                <div class="allocations-sub" *ngIf="item.allocations.length > 0">
                  <span class="sub-title">Allocated Bins:</span>
                  <div class="sub-row" *ngFor="let a of item.allocations">
                    <span>Bin: <span class="monospace">{{ getBinCode(a.binId) }}</span></span>
                    <span>Reserved: <strong>{{ a.quantity }}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Order Modal (Admin/Manager Only) -->
      <div class="modal-backdrop" *ngIf="isCreateModalOpen()">
        <div class="glass-panel modal-card">
          <h2>📤 Create Customer Outbound Order</h2>
          <p class="modal-desc">Book customer order details to initialize picking pipeline.</p>

          <form [formGroup]="createForm" (ngSubmit)="onCreateSubmit()" class="modal-form">
            <div class="form-group">
              <label for="cr-cust">Customer Name</label>
              <input id="cr-cust" type="text" formControlName="customerName" placeholder="e.g. Amazon Fulfillment" />
            </div>

            <div class="form-group">
              <label for="cr-ord">Order Number</label>
              <input id="cr-ord" type="text" formControlName="orderNumber" placeholder="e.g. ORD-1029-NY" />
            </div>

            <div formArrayName="items" class="manifest-form-list">
              <h3>Items Requested</h3>
              <div class="form-item-row" *ngFor="let item of crItems.controls; let idx = index" [formGroupName]="idx">
                <select formControlName="skuId">
                  <option value="">Select SKU</option>
                  <option *ngFor="let s of skus()" [value]="s._id">{{ s.code }}</option>
                </select>
                <input type="number" formControlName="quantityRequested" min="1" placeholder="Quantity" />
                <button type="button" (click)="removeCreateItem(idx)" class="btn-delete">×</button>
              </div>
              <button type="button" (click)="addCreateItem()" class="btn-secondary add-btn">
                + Add SKU
              </button>
            </div>

            <div class="modal-actions">
              <button type="button" (click)="closeCreateModal()" class="btn-secondary">Cancel</button>
              <button type="submit" [disabled]="createForm.invalid" class="btn-primary">Book Order</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .outbound-container {
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
    
    .btn-tab {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 8px 16px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 6px;
      transition: all var(--transition-fast);
    }
    
    .btn-tab:hover { color: #fff; }
    .btn-tab.btn-active {
      background: rgba(99, 102, 241, 0.1);
      color: var(--primary);
    }
    
    .logistics-layout {
      display: flex;
      gap: 25px;
      align-items: flex-start;
    }
    
    .list-panel {
      flex: 1.2;
      padding: 25px;
    }
    
    .details-panel {
      flex: 1;
      padding: 25px;
      position: sticky;
      top: 110px;
      animation: slideIn var(--transition-normal);
    }
    
    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    .clickable-row {
      cursor: pointer;
    }
    
    .clickable-row.selected td {
      background-color: rgba(99, 102, 241, 0.05);
      border-bottom-color: rgba(99, 102, 241, 0.2);
    }
    
    .meta-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 0;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 20px;
    }
    
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
    }
    
    .meta-row .lbl { color: var(--text-muted); }
    .meta-row .val { color: #fff; }
    
    .wizard-box {
      background: rgba(99, 102, 241, 0.04);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 25px;
    }
    
    .wizard-box h3 {
      font-size: 0.95rem;
      margin-bottom: 6px;
      color: #fff;
    }
    
    .wizard-box p {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    
    .wizard-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .full-width { width: 100%; }
    .margin-top { margin-top: 10px; }
    
    .pick-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 18px;
      max-height: 250px;
      overflow-y: auto;
    }
    
    .pick-item {
      padding: 10px 14px;
      background: rgba(17, 24, 39, 0.3);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }
    
    .pick-item.border {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .allocation-rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .alloc-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    
    .monospace { font-family: monospace; }
    
    .items-list-box h3 {
      font-size: 0.95rem;
      margin-bottom: 15px;
    }
    
    .item-card {
      padding: 14px 18px;
      margin-bottom: 12px;
    }
    
    .item-card-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      margin-bottom: 8px;
    }
    
    .item-card-header strong { color: #fff; }
    
    .item-card-body.flex-col {
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    
    .body-row {
      display: flex;
      gap: 20px;
    }
    
    .body-row strong { color: #fff; }
    
    .allocations-sub {
      border-top: 1px dashed var(--border-color);
      padding-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .sub-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    
    .sub-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
    }
    
    .sub-row strong { color: #fff; }
    
    /* Create Modal styles */
    .manifest-form-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .manifest-form-list h3 {
      font-size: 0.9rem;
      margin-bottom: 5px;
    }
    
    .form-item-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    .form-item-row select {
      flex: 2;
    }
    
    .form-item-row input {
      flex: 1;
    }
    
    .btn-delete {
      background: rgba(244, 63, 94, 0.1);
      border: 1px solid rgba(244, 63, 94, 0.2);
      color: var(--accent);
      width: 44px;
      height: 44px;
      border-radius: 8px;
      font-size: 1.5rem;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
    }
    
    .btn-delete:hover {
      background: var(--accent);
      color: #fff;
    }
    
    .add-btn {
      width: 100%;
      padding: 10px;
      font-size: 0.85rem;
    }
    
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .modal-card {
      width: 100%;
      max-width: 550px;
      padding: 35px;
    }
    
    .modal-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 25px;
    }
    
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 15px;
      margin-top: 10px;
    }
  `]
})
export class OutboundComponent implements OnInit {
  public authService = inject(AuthService);
  private logisticsService = inject(LogisticsService);
  private warehouseService = inject(WarehouseService);
  private fb = inject(FormBuilder);

  // Signals
  public readonly orders = signal<any[]>([]);
  public readonly selectedOrder = signal<any | null>(null);
  public readonly statusFilter = signal<string>('');
  
  public readonly warehouses = signal<any[]>([]);
  public readonly skus = signal<any[]>([]);

  // Action forms
  public actionForm!: FormGroup;

  // Create order modal
  public readonly isCreateModalOpen = signal<boolean>(false);
  public createForm!: FormGroup;
  
  // Cache of bins mapping
  private binCache = new Map<string, string>();

  public ngOnInit(): void {
    this.loadOrders();
    this.loadInitialData();
  }

  public loadOrders(): void {
    this.logisticsService.listOrders({ status: this.statusFilter(), limit: 50 }).subscribe({
      next: (res) => this.orders.set(res.data),
    });
  }

  private loadInitialData(): void {
    this.warehouseService.listWarehouses().subscribe((data) => {
      this.warehouses.set(data);
      // Prefetch bin details
      data.forEach((w) => {
        this.warehouseService.listBins(w._id).subscribe((bList) => {
          bList.forEach((b) => this.binCache.set(b._id, b.code));
        });
      });
    });
    
    this.warehouseService.listSKUs({ limit: 100 }).subscribe((res) => this.skus.set(res.data));
  }

  public getBinCode(binId: string): string {
    return this.binCache.get(binId) || binId;
  }

  public setStatusFilter(status: string): void {
    this.statusFilter.set(status);
    this.loadOrders();
  }

  public selectOrder(order: any): void {
    this.selectedOrder.set(order);
    
    // Default to the first warehouse or preset if known
    this.actionForm = this.fb.group({
      warehouseId: [order.warehouseId || '', Validators.required],
    });

    if (order.status === 'PICKED' || order.status === 'RESERVED') {
      // Find the warehouse id from allocations if possible
      const binId = order.items[0]?.allocations[0]?.binId;
      if (binId) {
        // Find which warehouse this bin belongs to by searching binCache (or since we know allocations are in active warehouse, set it)
        // For convenience in UI, we can just preset the first warehouse or let them select.
        // In backend, we know allocations are in specific warehouse. We will populate a default.
        this.warehouseService.listWarehouses().subscribe((whs) => {
          if (whs.length > 0) {
            this.actionForm.patchValue({ warehouseId: whs[0]._id });
          }
        });
      }
    }
  }

  public getStatusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'badge-pending';
      case 'RESERVED': return 'badge-reserved';
      case 'PICKED': return 'badge-picked';
      case 'SHIPPED': return 'badge-shipped';
      case 'CANCELLED': return 'badge-cancelled';
      default: return '';
    }
  }

  public onReserveSubmit(): void {
    if (this.actionForm.invalid) return;
    const order = this.selectedOrder();
    if (!order) return;

    this.logisticsService.reserveOrder(order._id, this.actionForm.value).subscribe({
      next: (res) => {
        this.selectOrder(res);
        this.loadOrders();
      },
      error: (err) => alert(err?.detail || 'Failed to reserve stock. Verify quantities in bins.'),
    });
  }

  public onPickSubmit(): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.logisticsService.pickOrder(order._id).subscribe({
      next: (res) => {
        this.selectOrder(res);
        this.loadOrders();
      },
      error: (err) => alert(err?.detail || 'Failed to complete picking.'),
    });
  }

  public onShipSubmit(): void {
    if (this.actionForm.invalid) return;
    const order = this.selectedOrder();
    if (!order) return;

    this.logisticsService.shipOrder(order._id, this.actionForm.value).subscribe({
      next: (res) => {
        this.selectOrder(res);
        this.loadOrders();
      },
      error: (err) => alert(err?.detail || 'Failed to ship order.'),
    });
  }

  public onCancelSubmit(): void {
    if (this.actionForm.invalid) return;
    const order = this.selectedOrder();
    if (!order) return;

    this.logisticsService.cancelOrder(order._id, this.actionForm.value).subscribe({
      next: (res) => {
        this.selectOrder(res);
        this.loadOrders();
      },
      error: (err) => alert(err?.detail || 'Failed to cancel order.'),
    });
  }

  // Create Order Modal
  public openCreateModal(): void {
    this.createForm = this.fb.group({
      customerName: ['', Validators.required],
      orderNumber: ['', Validators.required],
      items: this.fb.array([]),
    });

    this.addCreateItem();
    this.isCreateModalOpen.set(true);
  }

  public closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  public get crItems(): FormArray {
    return this.createForm.get('items') as FormArray;
  }

  public addCreateItem(): void {
    const group = this.fb.group({
      skuId: ['', Validators.required],
      quantityRequested: [5, [Validators.required, Validators.min(1)]],
    });
    this.crItems.push(group);
  }

  public removeCreateItem(idx: number): void {
    if (this.crItems.length > 1) {
      this.crItems.removeAt(idx);
    }
  }

  public onCreateSubmit(): void {
    if (this.createForm.invalid) return;

    this.logisticsService.createOrder(this.createForm.value).subscribe({
      next: () => {
        this.closeCreateModal();
        this.loadOrders();
      },
      error: (err) => alert(err?.detail || 'Failed to create order.'),
    });
  }
}
export default OutboundComponent;
