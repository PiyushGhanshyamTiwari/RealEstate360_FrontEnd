export interface User {
  userId?: number;
  userName: string;
  emailId: string;
  phone: number;
  role: string;
  status: string;
  registeredOn?: string;
}

export interface LoginDTO {
  emailId: string;
  password?: string;
}

export interface LoginResponseDTO {
  userId: number;
  userName: string;
  emailId: string;
  phone: number;
  role: string;
  token: string;
}

export interface RegistrationInputDTO {
  userName: string;
  emailId: string;
  phone: string;
  role: string;
  password?: string;
  status?: string;
}

export interface RegistrationOutputDTO {
  userId: number;
  userName: string;
  emailId: string;
  phone: number;
  role: string;
  registeredOn: string;
  status: string;
}

export interface AccountOfficerInputDto {
  userId: number;
  fullName: string;
  address: string;
}

export interface AccountOfficerOutputDto {
  officerId: number;
  fullName: string;
  emailId: string;
  phone: number;
  address: string;
  createdAt: string;
}

export interface AmenityInputDTO {
  name: string;
  description: string;
  createdAt?: string;
}

export interface AmenityOutputDTO {
  amenityId: number;
  unitId: number;
  name: string;
  description: string;
  createdAt: string;
  type?: string;
  areaSqFt?: number;
  floor?: number;
  rentAmount?: number;
  depositAmount?: number;
}

export interface ApplicationInputDTO {
  unitId: number;
  userId: number;
  startDate: string;
  endDate: string;
}

export interface ApplicationOutputDTO {
  applicationId: number;
  unitId: number;
  userId: number;
  startDate: string;
  endDate: string;
  submittedAt: string;
  status: string;
  type?: string;
  propertyName?: string;
  address?: string;
  city?: string;
}

export interface AuditLogResponseDTO {
  auditId: number;
  userId?: number;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  status: string;
  timestamp: string;
}

export interface InvoiceDefaultersOutputDto {
  invoiceId: number;
  leaseId: number;
  tenantId: number;
  tenantName: string;
  emailId: string;
  phoneNo: number;
  dueDate: string;
  amountDue: number;
}

export interface InvoiceInputDTO {
  tenantId: number;
  leaseId: number;
}

export interface InvoiceOutputDTO {
  invoiceId: number;
  tenantId: number;
  leaseId: number;
  periodStart: string;
  periodEnd: string;
  amountDue: number;
  dueDate: string;
  status: string;
  generatedAt: string;
}

export interface LeaseInputDTO {
  unitId: number;
  tenantId: number;
}

export interface LeaseOutputDTO {
  leaseId: number;
  unitId: number;
  ownerId: number;
  ownerName: string;
  tenantId: number;
  tenantName: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  depositAmount: number;
  status: string;
  createdAt: string;
}

export interface LedgerEntryOutputDto {
  ledgerEntryId: number;
  invoiceId: number;
  accountOfficerId?: number;
  accountOfficerName?: string;
  unitType: string;
  amountPaid: number;
  profitPercent: number;
  profitAmount: number;
  description: string;
  createdAt: string;
}

export interface MaintenanceLogRequestDTO {
  scheduleId: number;
  remarks: string;
}

export interface MaintenanceLogResponseDTO {
  logId: number;
  scheduleId: number;
  remarks: string;
  logDate: string;
}

export interface MaintenanceScheduleResponseDTO {
  scheduleId: number;
  userId: number;
  unitId?: number;
  technicianUserId?: number;
  issueDescription: string;
  category: string;
  severity: string;
  status: string;
  scheduledDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerAssignRequestDTO {
  userId: number;
  severity: string;
}

export interface TechnicianStatusUpdateDTO {
  status: string;
}

export interface TenantIssueRequestDTO {
  userId: number;
  unitId: number;
  issueDescription: string;
  category: string;
}

export interface PropertyInputDTO {
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyPostalCode: string;
  propertyCountry: string;
}

export interface PropertyOutputDTO {
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyPostalCode: string;
  propertyCountry: string;
  createdAt: string;
  updatedAt: string;
  ownerId: number;
}

export interface TechnicianInputDTO {
  userId: number;
  specialization: string;
  city: string;
  hireDate: string;
}

export interface TechnicianOutputDTO {
  technicianId: number;
  userId: number;
  specialization: string;
  hireDate: string;
  city: string;
}

export interface TenantProfileInputDTO {
  userId: number;
  address: string;
  documentType: string;
  documentFileRef?: any;
}

export interface TenantProfileOutputDTO {
  tenantId: number;
  address: string;
  createdAt: string;
  documentType: string;
  documentFileRef: string;
  userName: string;
  phone: number;
  emailId: string;
}

export interface UnitInputDTO {
  type: string;
  areaSqFt: number;
  floor: number;
  rentAmount: number;
  depositAmount: number;
  status?: string;
  availableFrom: string;
  propertyId: number;
}

export interface UnitOutputDTO {
  unitId: number;
  type: string;
  areaSqFt: number;
  floor: number;
  rentAmount: number;
  depositAmount: number;
  status: string;
  availableFrom: string;
  createdAt: string;
  updatedAt: string;
  propertyId: number;
  propertyName: string;
  propertyCity: string;
  propertyState: string;
  propertyPostalCode: string;
  propertyCountry: string;
  amenities?: string[];
  propertyPhotos?: { [key: number]: string };
}
