export enum UserRole {
  SUPPLIER = 'SUPPLIER',
  CONSUMER = 'CONSUMER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface IUser {
  id: string;
  did: string | null;
  role: UserRole;
  name: string;
  email: string;
  organization: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organization: string;
}

export interface ILoginDto {
  email: string;
  password: string;
}

export interface IAuthResponse {
  accessToken: string;
  user: Omit<IUser, 'createdAt' | 'updatedAt'>;
}

export interface IDIDCredential {
  id: string;
  userId: string;
  did: string;
  publicKey: string;
  status: 'ACTIVE' | 'REVOKED';
  issuedAt: Date;
}
