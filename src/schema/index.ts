import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # Custom Scalars
  scalar Date
  scalar EmailAddress
  scalar PhoneNumber

  # Enums
  enum Role {
    ADMIN
    EMPLOYEE
  }

  enum EmployeeSort {
    NAME_ASC
    NAME_DESC
    AGE_ASC
    AGE_DESC
    CLASS_ASC
    CLASS_DESC
    ATTENDANCE_ASC
    ATTENDANCE_DESC
    CREATED_AT_ASC
    CREATED_AT_DESC
  }

  # Types
  type Employee {
    id: ID!
    name: String!
    age: Int!
    class: String!
    subjects: [String!]!
    email: EmailAddress!
    phone: PhoneNumber
    attendance: Float!
    attendanceRecords: [AttendanceRecord!]!
    lastAttendanceUpdate: Date
    role: Role!
    dateOfJoining: Date!
    createdAt: Date! @cacheControl(maxAge: 60)
    updatedAt: Date! @cacheControl(maxAge: 60)
  }

  type AttendanceRecord {
    id: ID!
    employeeId: ID!
    employee: Employee!
    date: Date!
    present: Boolean!
    notes: String
    createdAt: Date!
    createdBy: ID!
    creator: Employee!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    totalPages: Int!
    totalCount: Int!
    currentPage: Int!
  }

  type EmployeePage {
    edges: [Employee!]!
    pageInfo: PageInfo!
  }

  type EmployeeStats {
    totalEmployees: Int!
    averageAttendance: Float!
    averageAge: Float!
    classDistribution: [ClassCount!]!
    attendanceTrend: [AttendanceTrend!]!
  }

  type ClassCount {
    class: String!
    count: Int!
    averageAttendance: Float!
  }

  type AttendanceTrend {
    date: Date!
    averageAttendance: Float!
    totalPresent: Int!
    totalAbsent: Int!
  }

  type ValidationError {
    field: String
    message: String!
    code: String!
  }

  type MutationResponse {
    success: Boolean!
    message: String
    employee: Employee
    errors: [ValidationError!]
  }

  # Inputs
  input EmployeeFilter {
    name: String
    class: String
    minAge: Int
    maxAge: Int
    minAttendance: Float
    maxAttendance: Float
    subjects: [String!]
    role: Role
    dateRange: DateRangeInput
  }

  input DateRangeInput {
    startDate: Date!
    endDate: Date!
  }

  input CreateEmployeeInput {
    name: String!
    age: Int!
    class: String!
    subjects: [String!]!
    email: EmailAddress!
    phone: PhoneNumber
    role: Role!
    dateOfJoining: Date
  }

  input UpdateEmployeeInput {
    name: String
    age: Int
    class: String
    subjects: [String!]
    email: EmailAddress
    phone: PhoneNumber
    role: Role
    dateOfJoining: Date
  }

  input AttendanceInput {
    employeeId: ID!
    date: Date!
    present: Boolean!
    notes: String
  }

  # Queries
  type Query {
    # Employee queries
    employees(
      filter: EmployeeFilter
      sort: EmployeeSort
      page: Int = 1
      pageSize: Int = 10
    ): EmployeePage! @auth(requires: [ADMIN, EMPLOYEE]) @complexity(multipliers: ["pageSize"])

    employee(id: ID!): Employee @auth(requires: [ADMIN, EMPLOYEE])
    
    # Statistics and analytics
    employeeStats: EmployeeStats! @auth(requires: [ADMIN])
    
    # Attendance queries
    employeeAttendance(
      id: ID!
      dateRange: DateRangeInput
    ): [AttendanceRecord!]! @auth(requires: [ADMIN, EMPLOYEE])
  }

  # Mutations
  type Mutation {
    # Employee mutations
    createEmployee(input: CreateEmployeeInput!): MutationResponse! 
      @auth(requires: [ADMIN])
    
    updateEmployee(id: ID!, input: UpdateEmployeeInput!): MutationResponse! 
      @auth(requires: [ADMIN])
    
    # Attendance mutations
    markAttendance(input: AttendanceInput!): MutationResponse! 
      @auth(requires: [ADMIN])
  }

  # Directives
  directive @auth(requires: [Role!]!) on FIELD_DEFINITION
  directive @complexity(multipliers: [String!]!) on FIELD_DEFINITION
  directive @cacheControl(
    maxAge: Int
    scope: CacheControlScope
  ) on FIELD_DEFINITION | OBJECT | INTERFACE

  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }
`;