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

  avatarOptions = [
    { id: 'avatar_1', emoji: '🧑‍💻', color: '#4f46e5' },
    { id: 'avatar_2', emoji: '👩‍💼', color: '#db2777' },
    { id: 'avatar_3', emoji: '🧑‍🚀', color: '#0ea5e9' },
    { id: 'avatar_4', emoji: '🦁', color: '#f59e0b' },
    { id: 'avatar_5', emoji: '🦊', color: '#10b981' },
    { id: 'avatar_6', emoji: '🐼', color: '#8b5cf6' },
    { id: 'avatar_7', emoji: '🦄', color: '#ec4899' },
    { id: 'avatar_8', emoji: '🐨', color: '#64748b' }
  ];

  getAvatarForUser(userId?: number, emailId?: string): { emoji: string; color: string } {
    let avatarId = '';
    if (userId) {
      avatarId = localStorage.getItem(`re360_avatar_${userId}`) || '';
    }
    if (!avatarId && emailId) {
      avatarId = localStorage.getItem(`re360_avatar_${emailId}`) || '';
    }
    
    if (!avatarId) {
      // Deterministic fallback based on userId
      const index = (userId || 0) % this.avatarOptions.length;
      return this.avatarOptions[index];
    }

    const matched = this.avatarOptions.find(opt => opt.id === avatarId);
    return matched || this.avatarOptions[0];
  }
}
