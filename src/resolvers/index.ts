import { GraphQLError } from 'graphql';
import { Employee } from '../models/employee';
import { AttendanceRecord } from '../models/attendanceRecord';
import { 
  Context, 
  EmployeeFilter, 
  EmployeeSort,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  AttendanceInput,
  ValidationError,
  IEmployee
} from '../types';
import { checkRole, canAccessEmployeeData } from '../middleware/auth';
import { validateEmployeeInput, validateAttendanceInput } from '../utils/validation';
import { Types } from 'mongoose';
import { toGraphQLEmployees } from '../utils/transforms';

interface EmployeeQueryResult {
  edges: IEmployee[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    totalPages: number;
    totalCount: number;
    currentPage: number;
  };
}

interface EmployeeStats {
  totalEmployees: number;
  averageAttendance: number;
  averageAge: number;
  classDistribution: Array<{
    class: string;
    count: number;
    averageAttendance: number;
  }>;
  attendanceTrend: Array<{
    date: string;
    averageAttendance: number;
    totalPresent: number;
    totalAbsent: number;
  }>;
}

interface MutationResponse {
  success: boolean;
  message?: string;
  employee?: IEmployee;
  errors?: ValidationError[];
}

export const resolvers = {
  Query: {
    employees: async (
      _: undefined,
      { 
        filter,
        sort,
        page = 1, 
        pageSize = 10 
      }: { 
        filter?: EmployeeFilter;
        sort?: EmployeeSort;
        page: number; 
        pageSize: number;
      },
      context: Context
    ): Promise<EmployeeQueryResult> => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      checkRole(['ADMIN', 'EMPLOYEE'])(context.user);

      const skip = (page - 1) * pageSize;
      
      const query: Record<string, any> = {};
      if (filter) {
        if (filter.name) query['name'] = { $regex: filter.name, $options: 'i' };
        if (filter.class) query['class'] = filter.class;
        if (filter.minAge) query['age'] = { $gte: filter.minAge };
        if (filter.maxAge) query['age'] = { ...query['age'], $lte: filter.maxAge };
        if (filter.minAttendance) query['attendance'] = { $gte: filter.minAttendance };
        if (filter.maxAttendance) query['attendance'] = { ...query['attendance'], $lte: filter.maxAttendance };
        if (filter.subjects?.length) query['subjects'] = { $all: filter.subjects };
        if (filter.role) query['role'] = filter.role;
      }

      const sortObj: Record<string, 1 | -1> = sort 
        ? { [sort.toLowerCase()]: sort.endsWith('_DESC') ? -1 : 1 }
        : { createdAt: -1 };

      try {
        const totalCount = await Employee.countDocuments(query);
        const totalPages = Math.ceil(totalCount / pageSize);

        const employees = await Employee.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(pageSize)
          .lean()
          .exec();

        return {
          edges: toGraphQLEmployees(employees),
          pageInfo: {
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            totalPages,
            totalCount,
            currentPage: page
          }
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new GraphQLError(error.message);
        }
        throw new GraphQLError('An unknown error occurred');
      }
    },

    employee: async (
      _: undefined,
      { id }: { id: string },
      context: Context
    ): Promise<IEmployee | null> => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        if (!canAccessEmployeeData(context.user, id)) {
          throw new GraphQLError('Not authorized', {
            extensions: { code: 'FORBIDDEN' }
          });
        }
        const employee = await context.loaders.employeeLoader.load(id);
        return employee ? {
          ...employee,
          id: employee._id ? employee._id.toString() : null // Safely handle _id
        } as IEmployee : null; // Cast the result to IEmployee
        
        
      } catch (error) {
        if (error instanceof Error) {
          throw new GraphQLError(error.message);
        }
        throw new GraphQLError('An unknown error occurred');
      }
    },

    employeeStats: async (
      _: undefined,
      __: undefined,
      context: Context
    ): Promise<EmployeeStats> => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        checkRole(['ADMIN'])(context.user);

        const [stats] = await Employee.aggregate([
          {
            $group: {
              _id: null,
              totalEmployees: { $sum: 1 },
              averageAttendance: { $avg: '$attendance' },
              averageAge: { $avg: '$age' }
            }
          }
        ]);

        const classDistribution = await Employee.aggregate([
          {
            $group: {
              _id: '$class',
              count: { $sum: 1 },
              averageAttendance: { $avg: '$attendance' }
            }
          }
        ]);

        const attendanceTrend = await AttendanceRecord.aggregate([
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              totalPresent: {
                $sum: { $cond: ['$present', 1, 0] }
              },
              totalAbsent: {
                $sum: { $cond: ['$present', 0, 1] }
              },
              averageAttendance: {
                $avg: { $cond: ['$present', 100, 0] }
              }
            }
          },
          { $sort: { '_id': -1 } },
          { $limit: 30 }
        ]);

        return {
          ...stats,
          classDistribution: classDistribution.map(item => ({
            class: item._id,
            count: item.count,
            averageAttendance: item.averageAttendance
          })),
          attendanceTrend: attendanceTrend.map(item => ({
            date: item._id,
            averageAttendance: item.averageAttendance,
            totalPresent: item.totalPresent,
            totalAbsent: item.totalAbsent
          }))
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new GraphQLError(error.message);
        }
        throw new GraphQLError('An unknown error occurred');
      }
    },

    employeeAttendance: async (
      _: undefined,
      { id }: { id: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        if (!canAccessEmployeeData(context.user, id)) {
          throw new GraphQLError('Not authorized');
        }
        return context.loaders.attendanceLoader.load(id);
      } catch (error) {
        if (error instanceof Error) {
          throw new GraphQLError(error.message);
        }
        throw new GraphQLError('An unknown error occurred');
      }
    }
  },

  Mutation: {
    createEmployee: async (
      _: undefined,
      { input }: { input: CreateEmployeeInput },
      context: Context
    ): Promise<MutationResponse> => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        checkRole(['ADMIN'])(context.user);

        const validationErrors = validateEmployeeInput(input);
        if (validationErrors.length > 0) {
          return {
            success: false,
            errors: validationErrors
          };
        }

        const employee = await Employee.create(input);

        return {
          success: true,
          message: 'Employee created successfully',
          employee
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            success: false,
            message: 'Failed to create employee',
            errors: [{
              message: error.message,
              code: 'INTERNAL_SERVER_ERROR'
            }]
          };
        }
        throw new GraphQLError('An unknown error occurred');
      }
    },

    updateEmployee: async (
      _: undefined,
      { id, input }: { id: string; input: UpdateEmployeeInput },
      context: Context
    ): Promise<MutationResponse> => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        checkRole(['ADMIN'])(context.user);

        const validationErrors = validateEmployeeInput(input);
        if (validationErrors.length > 0) {
          return {
            success: false,
            errors: validationErrors
          };
        }

        const employee = await Employee.findByIdAndUpdate(
          id,
          { $set: input },
          { new: true, runValidators: true }
        );

        if (!employee) {
          return {
            success: false,
            message: 'Employee not found',
            errors: [{
              message: 'Employee not found',
              code: 'NOT_FOUND'
            }]
          };
        }

        return {
          success: true,
          message: 'Employee updated successfully',
          employee
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            success: false,
            message: 'Failed to update employee',
            errors: [{
              message: error.message,
              code: 'INTERNAL_SERVER_ERROR'
            }]
          };
        }
        throw new GraphQLError('An unknown error occurred');
      }
    },

    markAttendance: async (
      _: undefined,
      { input }: { input: AttendanceInput },
      context: Context
    ): Promise<MutationResponse> => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        checkRole(['ADMIN'])(context.user);

        const validationErrors = validateAttendanceInput(input);
        if (validationErrors.length > 0) {
          return {
            success: false,
            errors: validationErrors
          };
        }

        await AttendanceRecord.create({
          ...input,
          createdBy: new Types.ObjectId(context.user.id)
        });

        // Update employee's attendance percentage
        await Employee.updateAttendanceStats(input.employeeId);

        return {
          success: true,
          message: 'Attendance marked successfully'
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            success: false,
            message: 'Failed to mark attendance',
            errors: [{
              message: error.message,
              code: 'INTERNAL_SERVER_ERROR'
            }]
          };
        }
        throw new GraphQLError('An unknown error occurred');
      }
    }
  }
};