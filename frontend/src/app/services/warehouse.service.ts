import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { getBaseUrl } from './api-config';

@Injectable({
  providedIn: 'root',
})
export class WarehouseService {
  private whUrl = `${getBaseUrl()}/api/v1/warehouses`;
  private skuUrl = `${getBaseUrl()}/api/v1/skus`;

  constructor(private http: HttpClient) {}

  // --- WAREHOUSES ---
  public listWarehouses(): Observable<any[]> {
    return this.http.get<any[]>(this.whUrl).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public createWarehouse(data: { code: string; name: string; address: string }): Observable<any> {
    return this.http.post<any>(this.whUrl, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  // --- ZONES ---
  public listZones(warehouseId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.whUrl}/${warehouseId}/zones`).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public createZone(warehouseId: string, data: { code: string; name: string; allowedCategories?: string[] }): Observable<any> {
    return this.http.post<any>(`${this.whUrl}/${warehouseId}/zones`, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  // --- BINS ---
  public listBins(warehouseId: string, zoneId?: string): Observable<any[]> {
    const url = zoneId 
      ? `${this.whUrl}/${warehouseId}/zones/${zoneId}/bins` 
      : `${this.whUrl}/${warehouseId}/bins`;
    return this.http.get<any[]>(url).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public createBin(warehouseId: string, zoneId: string, data: { code: string; maxWeight?: number; maxVolume?: number; isReceivingDock?: boolean }): Observable<any> {
    return this.http.post<any>(`${this.whUrl}/${warehouseId}/zones/${zoneId}/bins`, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  // --- SKUS ---
  public listSKUs(filters?: { page?: number; limit?: number; search?: string; category?: string }): Observable<any> {
    let params = new HttpParams();
    if (filters?.page) params = params.set('page', String(filters.page));
    if (filters?.limit) params = params.set('limit', String(filters.limit));
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.category) params = params.set('category', filters.category);

    return this.http.get<any>(this.skuUrl, { params }).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public createSKU(data: any): Observable<any> {
    return this.http.post<any>(this.skuUrl, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }
}
export default WarehouseService;
