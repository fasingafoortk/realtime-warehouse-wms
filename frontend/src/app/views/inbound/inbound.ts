import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { LogisticsService } from '../../services/logistics.service';
import { WarehouseService } from '../../services/warehouse.service';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-inbound',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="inbound-container">
      <div class="glass-panel tools-panel">
        <div class="filters">
          <button (click)="setStatusFilter('')" [class.btn-active]="!statusFilter()" class="btn-tab">All</button>
          <button (click)="setStatusFilter('PENDING')" [class.btn-active]="statusFilter() === 'PENDING'" class="btn-tab">Pending</button>
          <button (click)="setStatusFilter('RECEIVED')" [class.btn-active]="statusFilter() === 'RECEIVED'" class="btn-tab">Received</button>
          <button (click)="setStatusFilter('PUTAWAY')" [class.btn-active]="statusFilter() === 'PUTAWAY'" class="btn-tab">Putaway</button>
        </div>
        <button *ngIf="authService.isAdmin() || authService.isManager()" (click)="openCreateModal()" class="btn-primary">
          📥 New Inbound manifest
        </button>
      </div>

      <div class="logistics-layout">
        <!-- Manifests List -->
        <div class="glass-panel list-panel">
          <h2>Inbound Shipments</h2>
          <div class="table-container">
            <table *ngIf="inbounds().length > 0; else emptyInbounds">
              <thead>
                <tr>
                  <th>Ref Number</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of inbounds()" (click)="selectInbound(item)" class="clickable-row" [class.selected]="selectedInbound()?._id === item._id">
                  <td><strong class="text-white">{{ item.referenceNumber }}</strong></td>
                  <td>{{ item.supplierName }}</td>
                  <td><span class="badge" [ngClass]="getStatusClass(item.status)">{{ item.status }}</span></td>
                  <td>{{ item.items.length }} SKU(s)</td>
                  <td>{{ item.createdAt | date:'shortDate' }}</td>
                </tr>
              </tbody>
            </table>
            <ng-template #emptyInbounds>
              <div class="empty-state">
                <p>No inbound shipments found.</p>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Details & Operations Wizard -->
        <div class="glass-panel details-panel" *ngIf="selectedInbound() as ib">
          <div class="panel-header border">
            <h2>Manifest: {{ ib.referenceNumber }}</h2>
            <span class="badge" [ngClass]="getStatusClass(ib.status)">{{ ib.status }}</span>
          </div>

          <div class="meta-section">
            <div class="meta-row">
              <span class="lbl">Supplier:</span>
              <strong class="val">{{ ib.supplierName }}</strong>
            </div>
            <div class="meta-row" *ngIf="ib.receivedAt">
              <span class="lbl">Received Dock:</span>
              <span class="val">{{ ib.receivedAt | date:'medium' }}</span>
            </div>
            <div class="meta-row" *ngIf="ib.putawayAt">
              <span class="lbl">Putaway:</span>
              <span class="val">{{ ib.putawayAt | date:'medium' }}</span>
            </div>
          </div>

          <!-- Wizard Forms -->
          <!-- State 1: PENDING -> RECEIVED -->
          <div class="wizard-box" *ngIf="ib.status === 'PENDING' && !authService.isAuditor()">
            <h3>🚢 Port of Entry: Receive items at dock</h3>
            <p>Verify item quantities from the supplier manifest before adding to dock storage.</p>
            
            <form [formGroup]="receiveForm" (ngSubmit)="onReceiveSubmit()" class="wizard-form">
              <div class="form-group">
                <label for="rx-wh">Receiving Warehouse</label>
                <select id="rx-wh" formControlName="warehouseId">
                  <option value="">Select Warehouse</option>
                  <option *ngFor="let wh of warehouses()" [value]="wh._id">{{ wh.name }}</option>
                </select>
              </div>

              <div formArrayName="items" class="manifest-list">
                <div class="manifest-row" *ngFor="let item of rxItems.controls; let idx = index" [formGroupName]="idx">
                  <span class="manifest-sku">{{ getSKUCode(idx, 'rx') }}</span>
                  <div class="manifest-inputs">
                    <span>Expected: {{ ib.items[idx].quantityExpected }}</span>
                    <input type="number" formControlName="quantityReceived" min="0" placeholder="Qty Received" />
                  </div>
                </div>
              </div>

              <button type="submit" [disabled]="receiveForm.invalid" class="btn-primary full-width">
                Confirm Dock Receipt
              </button>
            </form>
          </div>

          <!-- State 2: RECEIVED -> PUTAWAY -->
          <div class="wizard-box" *ngIf="ib.status === 'RECEIVED' && !authService.isAuditor()">
            <h3>📦 Directed Putaway Wizard</h3>
            <p>Assign destination storage bins. Click "Suggest" to run directed slotting suggestions based on size capacity rules.</p>

            <form [formGroup]="putawayForm" (ngSubmit)="onPutawaySubmit()" class="wizard-form">
              <div class="form-group">
                <label for="pa-wh">Target Warehouse</label>
                <!-- Lock to the warehouse where it was received -->
                <select id="pa-wh" formControlName="warehouseId" (change)="onPutawayWhChange()">
                  <option value="">Select Warehouse</option>
                  <option *ngFor="let wh of warehouses()" [value]="wh._id">{{ wh.name }}</option>
                </select>
              </div>

              <div formArrayName="putawayInstructions" class="manifest-list">
                <div class="manifest-row border" *ngFor="let item of paInstructions.controls; let idx = index" [formGroupName]="idx">
                  <div class="man-info">
                    <span class="manifest-sku">{{ getSKUCode(idx, 'pa') }}</span>
                    <span>Received: {{ ib.items[idx].quantityReceived }} unit(s)</span>
                  </div>
                  <div class="man-actions">
                    <button type="button" (click)="autoSuggestBin(idx)" class="btn-action">Suggest</button>
                    <select formControlName="destinationBinId">
                      <option value="">Target Bin</option>
                      <option *ngFor="let bin of bins()" [value]="bin._id">{{ bin.code }}</option>
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" [disabled]="putawayForm.invalid" class="btn-primary full-width">
                Complete Putaway Transfer
              </button>
            </form>
          </div>

          <!-- Items View List -->
          <div class="items-list-box">
            <h3>Manifest Items</h3>
            <div class="item-card glass-card" *ngFor="let item of ib.items">
              <div class="item-card-header">
                <strong>{{ item.skuId?.code || 'SKU' }}</strong>
                <span>{{ item.skuId?.name || '' }}</span>
              </div>
              <div class="item-card-body">
                <span>Expected: <strong>{{ item.quantityExpected }}</strong></span>
                <span>Received: <strong>{{ item.quantityReceived }}</strong></span>
                <span *ngIf="item.destinationBinId">Target: <strong>{{ getBinCode(item.destinationBinId) }}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Inbound Modal (Admin/Manager Only) -->
      <div class="modal-backdrop" *ngIf="isCreateModalOpen()">
        <div class="glass-panel modal-card">
          <h2>📥 Create Inbound Shipment</h2>
          <p class="modal-desc">Create supplier booking for upcoming inventory arrivals.</p>

          <form [formGroup]="createForm" (ngSubmit)="onCreateSubmit()" class="modal-form">
            <div class="form-group">
              <label for="cr-sup">Supplier Name</label>
              <input id="cr-sup" type="text" formControlName="supplierName" placeholder="e.g. Acme Corp" />
            </div>

            <div class="form-group">
              <label for="cr-ref">Reference Number</label>
              <input id="cr-ref" type="text" formControlName="referenceNumber" placeholder="e.g. INB-9981-PO" />
            </div>

            <div formArrayName="items" class="manifest-form-list">
              <h3>Items manifest</h3>
              <div class="form-item-row" *ngFor="let item of crItems.controls; let idx = index" [formGroupName]="idx">
                <select formControlName="skuId">
                  <option value="">Select SKU</option>
                  <option *ngFor="let s of skus()" [value]="s._id">{{ s.code }}</option>
                </select>
                <input type="number" formControlName="quantityExpected" min="1" placeholder="Expected" />
                <button type="button" (click)="removeCreateItem(idx)" class="btn-delete">×</button>
              </div>
              <button type="button" (click)="addCreateItem()" class="btn-secondary add-btn">
                + Add SKU
              </button>
            </div>

            <div class="modal-actions">
              <button type="button" (click)="closeCreateModal()" class="btn-secondary">Cancel</button>
              <button type="submit" [disabled]="createForm.invalid" class="btn-primary">Create manifest</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .inbound-container {
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
    
    .manifest-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 250px;
      overflow-y: auto;
      margin-bottom: 10px;
      padding-right: 5px;
    }
    
    .manifest-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: rgba(17, 24, 39, 0.3);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
    
    .manifest-row.border {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    
    .man-info {
      display: flex;
      justify-content: space-between;
      width: 100%;
      font-size: 0.85rem;
    }
    
    .man-actions {
      display: flex;
      gap: 10px;
      width: 100%;
    }
    
    .man-actions select {
      flex: 1;
      padding: 8px 12px;
      font-size: 0.85rem;
    }
    
    .man-actions .btn-action {
      padding: 8px 16px;
    }
    
    .manifest-sku {
      font-weight: 700;
      color: #fff;
      font-size: 0.9rem;
    }
    
    .manifest-inputs {
      display: flex;
      align-items: center;
      gap: 15px;
      font-size: 0.85rem;
    }
    
    .manifest-inputs input {
      width: 100px;
      padding: 8px 12px;
      font-size: 0.85rem;
      text-align: center;
    }
    
    .full-width { width: 100%; }
    
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
    
    .item-card-body {
      display: flex;
      gap: 20px;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    
    .item-card-body strong { color: #fff; }
    
    .btn-action {
      background: rgba(20, 184, 166, 0.08);
      border: 1px solid rgba(20, 184, 166, 0.2);
      color: #14b8a6;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .btn-action:hover {
      background: #14b8a6;
      color: #fff;
    }
    
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
    
    /* Backdrop & layouts */
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
      max-width: 550px;
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

    @media (max-width: 768px) {
      .logistics-layout {
        flex-direction: column;
        align-items: stretch;
      }
      .details-panel {
        position: static;
        width: 100%;
      }
      .tools-panel {
        flex-direction: column;
        gap: 15px;
        align-items: flex-start;
      }
    }
  `]
})
export class InboundComponent implements OnInit {
  public authService = inject(AuthService);
  private logisticsService = inject(LogisticsService);
  private warehouseService = inject(WarehouseService);
  private inventoryService = inject(InventoryService);
  private fb = inject(FormBuilder);

  // Signals
  public readonly inbounds = signal<any[]>([]);
  public readonly selectedInbound = signal<any | null>(null);
  public readonly statusFilter = signal<string>('');
  
  public readonly warehouses = signal<any[]>([]);
  public readonly bins = signal<any[]>([]);
  public readonly skus = signal<any[]>([]);

  // Wizard forms
  public receiveForm!: FormGroup;
  public putawayForm!: FormGroup;

  // Create manifest modal
  public readonly isCreateModalOpen = signal<boolean>(false);
  public createForm!: FormGroup;
  
  // Cache of bins mapping
  private binCache = new Map<string, string>();

  public ngOnInit(): void {
    this.loadInbounds();
    this.loadInitialData();
  }

  public loadInbounds(): void {
    this.logisticsService.listInbounds({ status: this.statusFilter(), limit: 50 }).subscribe({
      next: (res) => this.inbounds.set(res.data),
    });
  }

  private loadInitialData(): void {
    this.warehouseService.listWarehouses().subscribe((data) => {
      this.warehouses.set(data);
      if (data.length > 0) {
        if (this.receiveForm && !this.receiveForm.get('warehouseId')?.value) {
          this.receiveForm.patchValue({ warehouseId: data[0]._id });
        }
        if (this.putawayForm && !this.putawayForm.get('warehouseId')?.value) {
          this.putawayForm.patchValue({ warehouseId: data[0]._id });
          this.onPutawayWhChange();
        }
      }
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
    this.loadInbounds();
  }

  public selectInbound(ib: any): void {
    this.selectedInbound.set(ib);
    
    const firstWhId = this.warehouses().length > 0 ? this.warehouses()[0]._id : '';

    // Initialize receive form
    this.receiveForm = this.fb.group({
      warehouseId: [firstWhId, Validators.required],
      items: this.fb.array(
        ib.items.map((item: any) =>
          this.fb.group({
            skuId: [item.skuId?._id || item.skuId, Validators.required],
            quantityReceived: [item.quantityExpected, [Validators.required, Validators.min(0)]],
          })
        )
      ),
    });

    // Initialize putaway form
    this.putawayForm = this.fb.group({
      warehouseId: [firstWhId, Validators.required],
      putawayInstructions: this.fb.array(
        ib.items.map((item: any) =>
          this.fb.group({
            skuId: [item.skuId?._id || item.skuId, Validators.required],
            destinationBinId: ['', Validators.required],
          })
        )
      ),
    });

    if (firstWhId) {
      this.onPutawayWhChange();
    }
  }

  // Getters for form arrays
  public get rxItems(): FormArray {
    return this.receiveForm.get('items') as FormArray;
  }

  public get paInstructions(): FormArray {
    return this.putawayForm.get('putawayInstructions') as FormArray;
  }

  public getSKUCode(index: number, formType: 'rx' | 'pa'): string {
    const ib = this.selectedInbound();
    if (!ib) return '';
    const item = ib.items[index];
    return item?.skuId?.code || 'SKU';
  }

  public getStatusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'badge-pending';
      case 'RECEIVED': return 'badge-received';
      case 'PUTAWAY': return 'badge-putaway';
      default: return '';
    }
  }

  public onReceiveSubmit(): void {
    if (this.receiveForm.invalid) return;
    const ib = this.selectedInbound();
    if (!ib) return;

    this.logisticsService.receiveInbound(ib._id, this.receiveForm.value).subscribe({
      next: (res) => {
        this.selectInbound(res);
        this.loadInbounds();
      },
      error: (err) => alert(err?.detail || 'Failed to receive inbound shipment.'),
    });
  }

  public onPutawayWhChange(): void {
    const whId = this.putawayForm.get('warehouseId')?.value;
    if (whId) {
      this.warehouseService.listBins(whId).subscribe((data) => {
        // filter out receiving docks
        this.bins.set(data.filter((b) => !b.isReceivingDock));
      });
    } else {
      this.bins.set([]);
    }
  }

  public autoSuggestBin(idx: number): void {
    const whId = this.putawayForm.get('warehouseId')?.value;
    if (!whId) {
      alert('Please select a target warehouse first.');
      return;
    }
    const ib = this.selectedInbound();
    if (!ib) return;
    
    const skuId = ib.items[idx].skuId?._id || ib.items[idx].skuId;
    
    this.inventoryService.getPutawaySuggestions(skuId, whId).subscribe({
      next: (suggestions) => {
        if (suggestions.length > 0) {
          const group = this.paInstructions.at(idx) as FormGroup;
          group.patchValue({ destinationBinId: suggestions[0].binId });
        } else {
          alert('No bins with capacity found in this warehouse.');
        }
      },
      error: () => alert('Failed to query suggested putaway slots.')
    });
  }

  public onPutawaySubmit(): void {
    if (this.putawayForm.invalid) return;
    const ib = this.selectedInbound();
    if (!ib) return;

    this.logisticsService.putawayInbound(ib._id, this.putawayForm.value).subscribe({
      next: (res) => {
        this.selectInbound(res);
        this.loadInbounds();
      },
      error: (err) => alert(err?.detail || 'Failed to put away items.'),
    });
  }

  // Create Inbound Modal
  public openCreateModal(): void {
    this.createForm = this.fb.group({
      supplierName: ['', Validators.required],
      referenceNumber: ['', Validators.required],
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
      quantityExpected: [10, [Validators.required, Validators.min(1)]],
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

    this.logisticsService.createInbound(this.createForm.value).subscribe({
      next: () => {
        this.closeCreateModal();
        this.loadInbounds();
      },
      error: (err) => alert(err?.detail || 'Failed to create manifest.'),
    });
  }
}
export default InboundComponent;
