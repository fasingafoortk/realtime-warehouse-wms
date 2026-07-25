import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { getBaseUrl } from './api-config';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private apiUrl = `${getBaseUrl()}/api/v1/inventory`;

  constructor(private http: HttpClient) {}

  public getInventory(filters: {
    warehouseId?: string;
    skuId?: string;
    lowStock?: boolean;
    page?: number;
    limit?: number;
  }): Observable<any> {
    let params = new HttpParams();
    if (filters.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters.skuId) params = params.set('skuId', filters.skuId);
    if (filters.lowStock) params = params.set('lowStock', String(filters.lowStock));
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.limit) params = params.set('limit', String(filters.limit));

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public getAuditLogs(filters: {
    skuId?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): Observable<any> {
    let params = new HttpParams();
    if (filters.skuId) params = params.set('skuId', filters.skuId);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.limit) params = params.set('limit', String(filters.limit));

    return this.http.get<any>(`${this.apiUrl}/audit-logs`, { params }).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public getPutawaySuggestions(skuId: string, warehouseId: string): Observable<any[]> {
    const params = new HttpParams()
      .set('skuId', skuId)
      .set('warehouseId', warehouseId);

    return this.http.get<any[]>(`${this.apiUrl}/putaway-suggestions`, { params }).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public adjustStock(adjustment: {
    warehouseId: string;
    binId: string;
    skuId: string;
    quantity: number;
    notes?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/adjust`, adjustment).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }
}
export default InventoryService;
