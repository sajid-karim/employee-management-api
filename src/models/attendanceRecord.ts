import mongoose, { Schema, Query } from 'mongoose';
import { validateDate } from '../utils/validation';
import { Employee } from './employee';
import { 
  IAttendanceRecord,
  IAttendanceRecordModel,
  IAttendanceRecordBase,
  DateRangeInput
} from '../types';

type QueryWithHelpers = Query<any, IAttendanceRecord> & {
  byDateRange(startDate: Date, endDate: Date): QueryWithHelpers;
  byEmployee(employeeId: string): QueryWithHelpers;
};

const attendanceRecordSchema = new Schema<IAttendanceRecord, IAttendanceRecordModel>({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee ID is required'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    validate: {
      validator: validateDate,
      message: 'Invalid date or future date not allowed'
    }
  },
  present: {
    type: Boolean,
    required: [true, 'Attendance status is required']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Creator ID is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
attendanceRecordSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceRecordSchema.index({ date: 1 });
attendanceRecordSchema.index({ createdAt: 1 });

// Pre-save middleware
attendanceRecordSchema.pre('save', async function(next) {
  const employee = await Employee.findById(this.employeeId.toString());
  if (!employee) {
    throw new Error('Employee not found');
  }

  if (this.date > new Date()) {
    throw new Error('Future dates are not allowed');
  }

  next();
});

// Post-save middleware
attendanceRecordSchema.post('save', async function(doc: IAttendanceRecord) {
  await Employee.updateAttendanceStats(doc.employeeId.toString());
});

// Static methods
attendanceRecordSchema.statics = {
  async getAttendanceStats(
    this: IAttendanceRecordModel,
    employeeId: string,
    dateRange?: DateRangeInput
  ) {
    const query: Record<string, any> = { 
      employeeId: new mongoose.Types.ObjectId(employeeId) 
    };
    
    if (dateRange) {
      query['date'] = {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate
      };
    }

    const records = await this.find(query);
    const totalDays = records.length;
    const presentDays = records.filter(record => record.present).length;
    const attendancePercentage = totalDays > 0 
      ? (presentDays / totalDays) * 100 
      : 100;

    return {
      totalDays,
      presentDays,
      attendancePercentage
    };
  }
};

// Query helpers
attendanceRecordSchema.query = {
  byDateRange(
    this: QueryWithHelpers,
    startDate: Date,
    endDate: Date
  ): QueryWithHelpers {
    return this.where('date').gte(startDate.getTime()).lte(endDate.getTime());
  },

  byEmployee(
    this: QueryWithHelpers,
    employeeId: string
  ): QueryWithHelpers {
    return this.where('employeeId', new mongoose.Types.ObjectId(employeeId));
  }
};

// Virtuals
attendanceRecordSchema.virtual('formattedDate').get(function(this: IAttendanceRecord) {
  return this.date.toISOString().split('T')[0];
});

// Employee virtual reference
attendanceRecordSchema.virtual('employee', {
  ref: 'Employee',
  localField: 'employeeId',
  foreignField: '_id',
  justOne: true
});

// Creator virtual reference
attendanceRecordSchema.virtual('creator', {
  ref: 'Employee',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

export const AttendanceRecord = mongoose.model<IAttendanceRecord, IAttendanceRecordModel>(
  'AttendanceRecord',
  attendanceRecordSchema
);

export type { IAttendanceRecord, IAttendanceRecordModel, IAttendanceRecordBase };