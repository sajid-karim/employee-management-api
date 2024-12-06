import { GraphQLError } from 'graphql';
import { 
  CreateEmployeeInput, 
  UpdateEmployeeInput, 
  AttendanceInput, 
  ValidationError, 
} from '../types';

// Regular expressions for validation
const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s-]{10,}$/,
  NAME: /^[a-zA-Z\s-]{2,50}$/,
  CLASS_NAME: /^[a-zA-Z0-9\s-]{2,30}$/,
  SUBJECT: /^[a-zA-Z0-9\s-&]{2,50}$/
} as const;

// Validation constraints
const CONSTRAINTS = {
  AGE: {
    MIN: 18,
    MAX: 70
  },
  ATTENDANCE: {
    MIN: 0,
    MAX: 100
  },
  SUBJECTS: {
    MIN: 1,
    MAX: 10
  },
  NAME: {
    MIN: 2,
    MAX: 50
  }
} as const;

// Utility validation functions
export const validateEmail = (email: string): boolean => {
  return REGEX.EMAIL.test(email);
};

export const validatePhone = (phone: string): boolean => {
  return REGEX.PHONE.test(phone);
};

export const validateName = (name: string): boolean => {
  return REGEX.NAME.test(name);
};

export const validateAge = (age: number): boolean => {
  return age >= CONSTRAINTS.AGE.MIN && age <= CONSTRAINTS.AGE.MAX;
};

export const validateClass = (className: string): boolean => {
  return REGEX.CLASS_NAME.test(className);
};

export const validateSubject = (subject: string): boolean => {
  return REGEX.SUBJECT.test(subject);
};

export const validateSubjects = (subjects: string[]): boolean => {
  return subjects.length >= CONSTRAINTS.SUBJECTS.MIN && 
         subjects.length <= CONSTRAINTS.SUBJECTS.MAX &&
         subjects.every(validateSubject);
};

export const validateAttendancePercentage = (attendance: number): boolean => {
  return attendance >= CONSTRAINTS.ATTENDANCE.MIN && 
         attendance <= CONSTRAINTS.ATTENDANCE.MAX;
};

export const validateDate = (date: Date): boolean => {
  return date instanceof Date && 
         !isNaN(date.getTime()) && 
         date <= new Date();
};

// Main validation functions for inputs
export const validateEmployeeInput = (
  input: Partial<CreateEmployeeInput | UpdateEmployeeInput>
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if ('name' in input && input.name !== undefined) {
    if (!validateName(input.name)) {
      errors.push({
        field: 'name',
        message: 'Name must be 2-50 characters long and contain only letters, spaces, and hyphens',
        code: 'INVALID_NAME'
      });
    }
  }

  if ('age' in input && input.age !== undefined) {
    if (!validateAge(input.age)) {
      errors.push({
        field: 'age',
        message: `Age must be between ${CONSTRAINTS.AGE.MIN} and ${CONSTRAINTS.AGE.MAX}`,
        code: 'INVALID_AGE'
      });
    }
  }

  if ('email' in input && input.email !== undefined) {
    if (!validateEmail(input.email)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }
  }

  if ('phone' in input && input.phone !== undefined) {
    if (typeof input.phone === 'string' && !validatePhone(input.phone)) {
      errors.push({
        field: 'phone',
        message: 'Invalid phone number format',
        code: 'INVALID_PHONE'
      });
    }
  }

  if ('class' in input && input.class !== undefined) {
    if (!validateClass(input.class)) {
      errors.push({
        field: 'class',
        message: 'Invalid class name format',
        code: 'INVALID_CLASS'
      });
    }
  }

  if ('subjects' in input && input.subjects !== undefined) {
    if (!validateSubjects(input.subjects)) {
      errors.push({
        field: 'subjects',
        message: `Must have ${CONSTRAINTS.SUBJECTS.MIN}-${CONSTRAINTS.SUBJECTS.MAX} valid subjects`,
        code: 'INVALID_SUBJECTS'
      });
    }
  }

  return errors;
};

export const validateAttendanceInput = (input: AttendanceInput): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!validateDate(input.date)) {
    errors.push({
      field: 'date',
      message: 'Invalid date or future date not allowed',
      code: 'INVALID_DATE'
    });
  }

  if (input.notes && input.notes.length > 500) {
    errors.push({
      field: 'notes',
      message: 'Notes cannot exceed 500 characters',
      code: 'INVALID_NOTES'
    });
  }

  return errors;
};

// Helper function to throw GraphQL error if validation fails
export const throwIfValidationErrors = (errors: ValidationError[]): void => {
  if (errors.length > 0) {
    throw new GraphQLError('Validation failed', {
      extensions: {
        code: 'BAD_USER_INPUT',
        errors
      }
    });
  }
};

type ValidatableField = 'email' | 'phone' | 'name' | 'age';

// Function to validate individual fields
export const validateField = (
  fieldName: ValidatableField, 
  value: unknown
): ValidationError | null => {
  switch (fieldName) {
    case 'email':
      return typeof value === 'string' && validateEmail(value) ? null : {
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      };
    case 'phone':
      return typeof value === 'string' && validatePhone(value) ? null : {
        field: 'phone',
        message: 'Invalid phone number format',
        code: 'INVALID_PHONE'
      };
    case 'name':
      return typeof value === 'string' && validateName(value) ? null : {
        field: 'name',
        message: 'Invalid name format',
        code: 'INVALID_NAME'
      };
    case 'age':
      return typeof value === 'number' && validateAge(value) ? null : {
        field: 'age',
        message: `Age must be between ${CONSTRAINTS.AGE.MIN} and ${CONSTRAINTS.AGE.MAX}`,
        code: 'INVALID_AGE'
      };
  }
};

// Export constants for use in other files
export const ValidationConstraints = CONSTRAINTS;
export const ValidationRegex = REGEX;

// Type exports
export type { ValidationError };