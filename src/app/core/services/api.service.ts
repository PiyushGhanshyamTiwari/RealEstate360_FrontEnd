import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AccountOfficerInputDto, AccountOfficerOutputDto,
  AmenityInputDTO, AmenityOutputDTO,
  ApplicationInputDTO, ApplicationOutputDTO,
  AuditLogResponseDTO,
  InvoiceDefaultersOutputDto, InvoiceOutputDTO,
  LeaseOutputDTO,
  LedgerEntryOutputDto,
  MaintenanceLogRequestDTO, MaintenanceLogResponseDTO,
  MaintenanceScheduleResponseDTO, ManagerAssignRequestDTO,
  TechnicianStatusUpdateDTO, TenantIssueRequestDTO,
  PropertyInputDTO, PropertyOutputDTO,
  TechnicianInputDTO, TechnicianOutputDTO,
  TenantProfileOutputDTO,
  UnitInputDTO, UnitOutputDTO
} from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8080';

  // --- Account Officer Controller ---
  addOfficer(input: AccountOfficerInputDto): Observable<AccountOfficerOutputDto> {
    return this.http.post<AccountOfficerOutputDto>(`${this.baseUrl}/api/v1/account-officer`, input);
  }

  getAllOfficers(): Observable<AccountOfficerOutputDto[]> {
    return this.http.get<AccountOfficerOutputDto[]>(`${this.baseUrl}/api/v1/account-officer`);
  }

  getOfficerById(userId: number): Observable<AccountOfficerOutputDto> {
    return this.http.get<AccountOfficerOutputDto>(`${this.baseUrl}/api/v1/account-officer/${userId}`);
  }

  getOfficerLedgerEntries(userId: number): Observable<LedgerEntryOutputDto[]> {
    return this.http.get<LedgerEntryOutputDto[]>(`${this.baseUrl}/api/v1/account-officer/${userId}/ledger-entries`);
  }

  // --- Amenity Controller ---
  addAmenity(input: AmenityInputDTO, unitId: number): Observable<AmenityOutputDTO> {
    return this.http.post<AmenityOutputDTO>(`${this.baseUrl}/api/v1/amenity/register/${unitId}`, input);
  }

  // --- Application Controller ---
  submitApplication(input: ApplicationInputDTO): Observable<ApplicationOutputDTO> {
    return this.http.post<ApplicationOutputDTO>(`${this.baseUrl}/api/v1/application/application`, input);
  }

  getApplicationsByUnitId(unitId: number): Observable<ApplicationOutputDTO[]> {
    return this.http.get<ApplicationOutputDTO[]>(`${this.baseUrl}/api/v1/application/unitId/${unitId}`);
  }

  updateStatusOfApplication(applicationId: number, status: string): Observable<ApplicationOutputDTO> {
    return this.http.put<ApplicationOutputDTO>(`${this.baseUrl}/api/v1/application/${applicationId}/${status}`, {});
  }

  getApplicationByTenantId(userId: number): Observable<ApplicationOutputDTO[]> {
    return this.http.get<ApplicationOutputDTO[]>(`${this.baseUrl}/api/v1/application/userId/${userId}`);
  }

  getApplicationByApplicationId(applicationId: number): Observable<ApplicationOutputDTO> {
    return this.http.get<ApplicationOutputDTO>(`${this.baseUrl}/api/v1/application/applicationId/${applicationId}`);
  }

  // --- Audit Log Controller ---
  getAuditLogs(logType?: string, logValue?: string): Observable<AuditLogResponseDTO[]> {
    let params = new HttpParams();
    if (logType) params = params.set('logType', logType);
    if (logValue) params = params.set('logValue', logValue);
    return this.http.get<AuditLogResponseDTO[]>(`${this.baseUrl}/api/v1/audit-logs/all`, { params });
  }

  // --- Invoice Controller ---
  listInvoiceWithLeaseId(leaseId: number): Observable<InvoiceOutputDTO[]> {
    return this.http.get<InvoiceOutputDTO[]>(`${this.baseUrl}/api/v1/invoice/leaseId/${leaseId}`);
  }

  updateInvoiceStatus(invoiceId: number, status: string, officerId: number): Observable<InvoiceOutputDTO> {
    let params = new HttpParams().set('officerId', officerId.toString());
    return this.http.put<InvoiceOutputDTO>(`${this.baseUrl}/api/v1/invoice/${invoiceId}/${status}`, {}, { params });
  }

  getDefaulters(): Observable<InvoiceDefaultersOutputDto[]> {
    return this.http.get<InvoiceDefaultersOutputDto[]>(`${this.baseUrl}/api/v1/invoice/defaulters`);
  }

  // --- Lease Controller ---
  updateLeaseStatus(leaseId: number, status: string): Observable<LeaseOutputDTO> {
    return this.http.put<LeaseOutputDTO>(`${this.baseUrl}/api/v1/lease/${leaseId}/${status}`, {});
  }

  // --- Ledger Entry Controller ---
  getLedgerEntriesByMonthAndYear(month: number, year: number): Observable<LedgerEntryOutputDto[]> {
    return this.http.get<LedgerEntryOutputDto[]>(`${this.baseUrl}/api/v1/ledger/${month}/${year}`);
  }

  // --- Maintenance Log Controller ---
  addMaintenanceLog(input: MaintenanceLogRequestDTO): Observable<MaintenanceLogResponseDTO> {
    return this.http.post<MaintenanceLogResponseDTO>(`${this.baseUrl}/maintenance-logs/technician`, input);
  }

  getLogsByScheduleId(scheduleId: number, pageNo = 0, pageSize = 10): Observable<any> {
    let params = new HttpParams()
      .set('pageNo', pageNo.toString())
      .set('pageSize', pageSize.toString());
    return this.http.get<any>(`${this.baseUrl}/maintenance-logs/schedule/${scheduleId}`, { params });
  }

  // --- Maintenance Schedule Controller ---
  createScheduleByTenant(input: TenantIssueRequestDTO): Observable<MaintenanceScheduleResponseDTO> {
    return this.http.post<MaintenanceScheduleResponseDTO>(`${this.baseUrl}/maintenance-schedules/tenant`, input);
  }

  assignByManager(scheduleId: number, input: ManagerAssignRequestDTO): Observable<MaintenanceScheduleResponseDTO> {
    return this.http.put<MaintenanceScheduleResponseDTO>(`${this.baseUrl}/maintenance-schedules/${scheduleId}/assign`, input);
  }

  updateByTechnician(scheduleId: number, userId: number, input: TechnicianStatusUpdateDTO): Observable<MaintenanceScheduleResponseDTO> {
    let params = new HttpParams().set('userId', userId.toString());
    return this.http.put<MaintenanceScheduleResponseDTO>(`${this.baseUrl}/maintenance-schedules/${scheduleId}/status`, input, { params });
  }

  getScheduleById(scheduleId: number): Observable<MaintenanceScheduleResponseDTO> {
    return this.http.get<MaintenanceScheduleResponseDTO>(`${this.baseUrl}/maintenance-schedules/${scheduleId}`);
  }

  getAllSchedules(status?: string, severity?: string): Observable<MaintenanceScheduleResponseDTO[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (severity) params = params.set('severity', severity);
    return this.http.get<MaintenanceScheduleResponseDTO[]>(`${this.baseUrl}/maintenance-schedules`, { params });
  }

  // --- Property Controller ---
  addProperty(input: PropertyInputDTO, ownerId: number): Observable<PropertyOutputDTO> {
    return this.http.post<PropertyOutputDTO>(`${this.baseUrl}/api/v1/property/register/${ownerId}`, input);
  }

  findPropertyByCity(city: string): Observable<PropertyOutputDTO[]> {
    return this.http.get<PropertyOutputDTO[]>(`${this.baseUrl}/api/v1/property/city/${city}`);
  }

  findPropertyByState(state: string): Observable<PropertyOutputDTO[]> {
    return this.http.get<PropertyOutputDTO[]>(`${this.baseUrl}/api/v1/property/state/${state}`);
  }

  findPropertyByOwnerId(ownerId: number): Observable<PropertyOutputDTO[]> {
    return this.http.get<PropertyOutputDTO[]>(`${this.baseUrl}/api/v1/property/ownerId/${ownerId}`);
  }

  // --- Property Photo Controller ---
  uploadPhoto(unitId: number, file: File, uploadedBy: string, caption?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', uploadedBy);
    if (caption) {
      formData.append('caption', caption);
    }
    return this.http.post<any>(`${this.baseUrl}/api/v1/propertyphoto/upload/${unitId}`, formData);
  }

  downloadPhoto(photoId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/api/v1/propertyphoto/download/${photoId}`, {
      responseType: 'blob'
    });
  }

  download(photoId:number):any{
    return this.http.get(`${this.baseUrl}/api/v1/propertyphoto/views/${photoId}`);
  }
  // --- Technician Controller ---
  createTechnician(input: TechnicianInputDTO): Observable<TechnicianOutputDTO> {
    return this.http.post<TechnicianOutputDTO>(`${this.baseUrl}/technicians`, input);
  }

  getTechnicianById(userId: number): Observable<TechnicianOutputDTO> {
    return this.http.get<TechnicianOutputDTO>(`${this.baseUrl}/technicians/${userId}`);
  }

  getAllTechnicians(): Observable<TechnicianOutputDTO[]> {
    return this.http.get<TechnicianOutputDTO[]>(`${this.baseUrl}/technicians`);
  }

  searchTechnicians(specialization: string, city: string): Observable<TechnicianOutputDTO[]> {
    let params = new HttpParams()
      .set('specialization', specialization)
      .set('city', city);
    return this.http.get<TechnicianOutputDTO[]>(`${this.baseUrl}/technicians/search`, { params });
  }

  getTechnicianSchedules(userId: number): Observable<MaintenanceScheduleResponseDTO[]> {
    return this.http.get<MaintenanceScheduleResponseDTO[]>(`${this.baseUrl}/technicians/${userId}/getAllSchedules`);
  }

  // --- Tenant Profile Controller ---
  addTenantProfile(userId: number, address: string, documentType: string, file: File): Observable<TenantProfileOutputDTO> {
    const formData = new FormData();
    formData.append('userId', userId.toString());
    formData.append('address', address);
    formData.append('documentType', documentType);
    formData.append('documentFileRef', file);
    // Note: Request header boundary is auto-generated by the browser when setting body as FormData
    return this.http.post<TenantProfileOutputDTO>(`${this.baseUrl}/api/v1/tenant/register`, formData);
  }

  getAllTenants(): Observable<TenantProfileOutputDTO[]> {
    return this.http.get<TenantProfileOutputDTO[]>(`${this.baseUrl}/api/v1/tenant/all`);
  }

  getTenantById(tenantId: number): Observable<TenantProfileOutputDTO> {
    return this.http.get<TenantProfileOutputDTO>(`${this.baseUrl}/api/v1/tenant/tenantId/${tenantId}`);
  }

  getTenantByUserId(userId: number): Observable<TenantProfileOutputDTO> {
    return this.http.get<TenantProfileOutputDTO>(`${this.baseUrl}/api/v1/tenant/userId/${userId}`);
  }

  // --- Unit Controller ---
  addUnit(input: UnitInputDTO): Observable<UnitOutputDTO> {
    return this.http.post<UnitOutputDTO>(`${this.baseUrl}/api/v1/unit/register`, input);
  }

  getAllUnits(): Observable<UnitOutputDTO[]> {
    return this.http.get<UnitOutputDTO[]>(`${this.baseUrl}/api/v1/unit/all`);
  }

  filterUnits(
    type?: string,
    minRent?: number,
    maxRent?: number,
    propertyId?: number,
    propertyName?: string,
    city?: string,
    status?: string
  ): Observable<UnitOutputDTO[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    if (minRent !== undefined && minRent !== null) params = params.set('minRent', minRent.toString());
    if (maxRent !== undefined && maxRent !== null) params = params.set('maxRent', maxRent.toString());
    if (propertyId !== undefined && propertyId !== null) params = params.set('propertyId', propertyId.toString());
    if (propertyName) params = params.set('propertyName', propertyName);
    if (city) params = params.set('city', city);
    if (status) params = params.set('status', status);

    return this.http.get<UnitOutputDTO[]>(`${this.baseUrl}/api/v1/unit/filter`, { params });
  }

  updateUnit(unitId: number, input: UnitInputDTO): Observable<UnitOutputDTO> {
    return this.http.put<UnitOutputDTO>(`${this.baseUrl}/api/v1/unit/${unitId}`, input);
  }

  updateUser(userId: number, input: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/api/v1/user/${userId}`, input);
  }
}
