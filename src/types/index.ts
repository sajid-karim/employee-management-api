import { Request, Application } from 'express';
import { Document, Model, Types, Query, FlattenMaps, ObjectId } from 'mongoose';
import DataLoader from 'dataloader';

// User and Role types
export type UserRole = 'ADMIN' | 'EMPLOYEE';

// Sorting enum
export enum EmployeeSort {
  NAME_ASC = 'NAME_ASC',
  NAME_DESC = 'NAME_DESC',
  AGE_ASC = 'AGE_ASC',
  AGE_DESC = 'AGE_DESC',
  ATTENDANCE_ASC = 'ATTENDANCE_ASC',
  ATTENDANCE_DESC = 'ATTENDANCE_DESC',
  DATE_JOINED_ASC = 'DATE_JOINED_ASC',
  DATE_JOINED_DESC = 'DATE_JOINED_DESC'
}

export interface User {
  id: string;
  role: UserRole;
  email: string;
  name?: string;
}

// Base interfaces without Document inheritance
export interface IEmployeeBase {
  name: string;
  email: string;
  age: number;
  class: string;
  subjects: string[];
  attendance: number;
  role: UserRole;
  dateOfJoining: Date;
  lastAttendanceUpdate?: Date;
  createdAt: Date;
  updatedAt: Date;
  phone?: string;
}

export interface IAttendanceRecordBase {
  employeeId: Types.ObjectId;
  date: Date;
  present: boolean;
  notes?: string;
  createdAt: Date;
  createdBy: Types.ObjectId;
}

// Mongoose Document interfaces
export interface IEmployee extends Document, IEmployeeBase {
  _id: Types.ObjectId;
  id: string;
  updateAttendancePercentage(): Promise<void>;
}

export interface IAttendanceRecord extends Document, IAttendanceRecordBase {
  _id: Types.ObjectId;
  id: string;
}

// Lean types for DataLoader
export type LeanEmployee = Omit<IEmployeeBase, 'id'> & {
  id: string;
  _id?: Types.ObjectId;
};

export interface LeanAttendanceRecord {
  id: string;
  date: Date;
  employeeId: Types.ObjectId;
}

// Rest of the types remain the same...
export interface CreateEmployeeInput {
  name: string;
  email: string;
  age: number;
  class: string;
  subjects: string[];
  role: UserRole;
  dateOfJoining: Date;
}

export interface UpdateEmployeeInput {
  name?: string;
  email?: string;
  age?: number;
  class?: string;
  subjects?: string[];
  role?: UserRole;
  dateOfJoining?: Date;
}

export interface DateRangeInput {
  startDate: Date;
  endDate: Date;
}

export interface EmployeeFilter {
  name?: string;
  class?: string;
  minAge?: number;
  maxAge?: number;
  minAttendance?: number;
  maxAttendance?: number;
  subjects?: string[];
  role?: UserRole;
  dateRange?: DateRangeInput;
}

export interface AttendanceInput {
  employeeId: string;
  date: Date;
  present: boolean;
  notes?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalPages: number;
  totalCount: number;
  currentPage: number;
}

export interface EmployeePage {
  edges: LeanEmployee[];
  pageInfo: PageInfo;
}

export interface Context {
  user: User | null;
  loaders: DataLoaders;
}

export interface AuthRequest extends Request {
  user?: User;
  app: Application;
}

export interface ValidationError {
  field?: string;
  message: string;
  code: string;
}

export interface GraphQLErrorExtensions {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'BAD_USER_INPUT' | 'INTERNAL_SERVER_ERROR';
  correlationId?: string;
  requiredRoles?: UserRole[];
  validationErrors?: ValidationError[];
}

export interface DataLoaders {
  employeeLoader: DataLoader<string, LeanEmployee | null>;
  attendanceLoader: DataLoader<string, LeanAttendanceRecord[]>;
}

export interface IEmployeeModel extends Model<IEmployee> {
  updateAttendanceStats(employeeId: string): Promise<void>;
  calculateAttendancePercentage(employeeId: string): Promise<number>;
  findById(id: string): Query<(FlattenMaps<IEmployee> & Required<{ _id: ObjectId; }>) | null, any, {}, IEmployee, "findOne">;
}

export interface IAttendanceRecordModel extends Model<IAttendanceRecord> {
  getAttendanceStats(
    employeeId: string, 
    dateRange?: DateRangeInput
  ): Promise<{
    totalDays: number;
    presentDays: number;
    attendancePercentage: number;
  }>;
}