import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { getBaseUrl } from './api-config';

export interface IUserPayload {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Warehouse Manager' | 'Picker' | 'Auditor';
}

export interface IAuthResponse {
  user: IUserPayload;
  accessToken: string;
  refreshToken: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${getBaseUrl()}/api/v1/auth`;

  // Signals
  public readonly currentUser = signal<IUserPayload | null>(null);
  public readonly accessToken = signal<string | null>(null);
  
  public readonly isAuthenticated = computed(() => this.currentUser() !== null);
  public readonly isAdmin = computed(() => this.currentUser()?.role === 'Admin');
  public readonly isAuditor = computed(() => this.currentUser()?.role === 'Auditor');
  public readonly isPicker = computed(() => this.currentUser()?.role === 'Picker');
  public readonly isManager = computed(() => this.currentUser()?.role === 'Warehouse Manager');

  constructor(private http: HttpClient) {
    this.loadSession();
  }

  public login(credentials: { email: string; password: string }): Observable<IAuthResponse> {
    return this.http.post<IAuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((res) => this.setSession(res)),
      catchError((err) => throwError(() => err.error))
    );
  }

  public register(user: { email: string; name: string; password: string; role: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user).pipe(
      catchError((err) => throwError(() => err.error))
    );
  }

  public refreshToken(): Observable<{ accessToken: string; refreshToken: string }> {
    const refreshToken = getCookie('rf_token');
    if (!refreshToken) {
      this.clearSession();
      return throwError(() => new Error('No refresh token available.'));
    }

    return this.http.post<{ accessToken: string; refreshToken: string }>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap((res) => {
        this.accessToken.set(res.accessToken);
        setCookie('rf_token', res.refreshToken, 7);
      }),
      catchError((err) => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  public logout(): void {
    const userId = this.currentUser()?.id;
    if (userId) {
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
        next: () => this.clearSession(),
        error: () => this.clearSession()
      });
    } else {
      this.clearSession();
    }
  }

  private setSession(auth: IAuthResponse): void {
    this.currentUser.set(auth.user);
    this.accessToken.set(auth.accessToken);
    setCookie('user', JSON.stringify(auth.user), 7);
    setCookie('rf_token', auth.refreshToken, 7);
  }

  private clearSession(): void {
    this.currentUser.set(null);
    this.accessToken.set(null);
    eraseCookie('user');
    eraseCookie('rf_token');
  }

  private loadSession(): void {
    const userStr = getCookie('user');
    const rfToken = getCookie('rf_token');

    if (userStr && rfToken) {
      try {
        const user = JSON.parse(userStr);
        this.currentUser.set(user);
        this.refreshToken().subscribe({
          error: () => this.clearSession()
        });
      } catch {
        this.clearSession();
      }
    }
  }
}

// Cookie Helpers
export const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export const setCookie = (name: string, value: string, days?: number): void => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax" + secure;
};

export const eraseCookie = (name: string): void => {
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}
export default AuthService;
