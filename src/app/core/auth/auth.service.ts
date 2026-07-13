import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { LoginDTO, LoginResponseDTO, RegistrationInputDTO, RegistrationOutputDTO } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/v1/user'; // Default Spring Boot backend url

  private currentUserSubject = new BehaviorSubject<LoginResponseDTO | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    const storedUser = localStorage.getItem('re360_user');
    if (storedUser) {
      try {
        this.currentUserSubject.next(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('re360_user');
      }
    }
  }

  public get currentUserValue(): LoginResponseDTO | null {
    return this.currentUserSubject.value;
  }

  public get token(): string | null {
    return this.currentUserValue?.token || null;
  }

  public get isAuthenticated(): boolean {
    return !!this.token;
  }

  public get userRole(): string | null {
    return this.currentUserValue?.role || null;
  }

  public get userId(): number | null {
    return this.currentUserValue?.userId || null;
  }

  register(input: RegistrationInputDTO): Observable<RegistrationOutputDTO> {
    return this.http.post<RegistrationOutputDTO>(`${this.apiUrl}/register`, input);
  }

  login(input: LoginDTO): Observable<LoginResponseDTO> {
    return this.http.post<LoginResponseDTO>(`${this.apiUrl}/login`, input).pipe(
      tap(response => {
        if (response && response.token) {
          localStorage.setItem('re360_user', JSON.stringify(response));
          this.currentUserSubject.next(response);
        }
      })
    );
  }

  updateUser(userId: number, input: RegistrationInputDTO): Observable<RegistrationOutputDTO> {
    return this.http.put<RegistrationOutputDTO>(`${this.apiUrl}/${userId}`, input).pipe(
      tap(response => {
        // If current user is updated, update name, phone, etc., in localstorage
        const current = this.currentUserValue;
        if (current && current.userId === userId) {
          current.userName = response.userName;
          current.emailId = response.emailId;
          current.phone = response.phone;
          current.role = response.role;
          localStorage.setItem('re360_user', JSON.stringify(current));
          this.currentUserSubject.next(current);
        }
      })
    );
  }

  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/all`);
  }

  logout(): void {
    localStorage.removeItem('re360_user');
    this.currentUserSubject.next(null);
  }
}
