import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { getBaseUrl } from './api-config';

@Injectable({
  providedIn: 'root',
})
export class LogisticsService {
  private inboundUrl = `${getBaseUrl()}/api/v1/inbound`;
  private outboundUrl = `${getBaseUrl()}/api/v1/outbound`;
  private reportsUrl = `${getBaseUrl()}/api/v1/reports`;

  constructor(private http: HttpClient) {}

  // --- INBOUND ---
  public listInbounds(filters: { status?: string; page?: number; limit?: number }): Observable<any> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.limit) params = params.set('limit', String(filters.limit));

    return this.http.get<any>(this.inboundUrl, { params }).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public getInbound(id: string): Observable<any> {
    return this.http.get<any>(`${this.inboundUrl}/${id}`).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public createInbound(data: any): Observable<any> {
    return this.http.post<any>(this.inboundUrl, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public receiveInbound(id: string, data: { warehouseId: string; items: any[] }): Observable<any> {
    return this.http.post<any>(`${this.inboundUrl}/${id}/receive`, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public putawayInbound(id: string, data: { warehouseId: string; putawayInstructions: any[] }): Observable<any> {
    return this.http.post<any>(`${this.inboundUrl}/${id}/putaway`, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  // --- OUTBOUND ---
  public listOrders(filters: { status?: string; page?: number; limit?: number }): Observable<any> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.limit) params = params.set('limit', String(filters.limit));

    return this.http.get<any>(this.outboundUrl, { params }).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public getOrder(id: string): Observable<any> {
    return this.http.get<any>(`${this.outboundUrl}/${id}`).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public createOrder(data: any): Observable<any> {
    return this.http.post<any>(this.outboundUrl, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public reserveOrder(id: string, data: { warehouseId: string }): Observable<any> {
    return this.http.post<any>(`${this.outboundUrl}/${id}/reserve`, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public pickOrder(id: string): Observable<any> {
    return this.http.post<any>(`${this.outboundUrl}/${id}/pick`, {}).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public shipOrder(id: string, data: { warehouseId: string }): Observable<any> {
    return this.http.post<any>(`${this.outboundUrl}/${id}/ship`, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public cancelOrder(id: string, data: { warehouseId: string }): Observable<any> {
    return this.http.post<any>(`${this.outboundUrl}/${id}/cancel`, data).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  // --- REPORTS ---
  public getKPIs(warehouseId?: string): Observable<any> {
    let params = new HttpParams();
    if (warehouseId) params = params.set('warehouseId', warehouseId);

    return this.http.get<any>(`${this.reportsUrl}/kpis`, { params }).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }
}
export default LogisticsService;
