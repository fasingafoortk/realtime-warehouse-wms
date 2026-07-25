import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject, Observable } from 'rxjs';
import { getBaseUrl } from './api-config';

export interface IStockUpdateEvent {
  skuId: string;
  binId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
}

export interface IGlobalStockUpdateEvent extends IStockUpdateEvent {
  warehouseId: string;
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private socket: Socket | null = null;
  private serverUrl = getBaseUrl();

  private stockUpdate$ = new Subject<IStockUpdateEvent>();
  private globalStockUpdate$ = new Subject<IGlobalStockUpdateEvent>();

  public connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected. Client ID:', this.socket?.id);
    });

    this.socket.on('stock:update', (data: IStockUpdateEvent) => {
      console.log('Received stock:update:', data);
      this.stockUpdate$.next(data);
    });

    this.socket.on('stock:global_update', (data: IGlobalStockUpdateEvent) => {
      console.log('Received stock:global_update:', data);
      this.globalStockUpdate$.next(data);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public joinWarehouse(warehouseId: string): void {
    if (this.socket) {
      this.socket.emit('join:warehouse', warehouseId);
      console.log(`Requested to join warehouse room: ${warehouseId}`);
    }
  }

  public leaveWarehouse(warehouseId: string): void {
    if (this.socket) {
      this.socket.emit('leave:warehouse', warehouseId);
      console.log(`Requested to leave warehouse room: ${warehouseId}`);
    }
  }

  public onStockUpdate(): Observable<IStockUpdateEvent> {
    return this.stockUpdate$.asObservable();
  }

  public onGlobalStockUpdate(): Observable<IGlobalStockUpdateEvent> {
    return this.globalStockUpdate$.asObservable();
  }
}
export default WebSocketService;
