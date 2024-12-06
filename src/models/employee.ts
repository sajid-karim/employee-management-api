import mongoose, { Schema } from 'mongoose';
import { validateEmail, validatePhone } from '../utils/validation';
import { UserRole, IEmployeeBase, IEmployee, IEmployeeModel } from '../types';

const employeeSchema = new Schema<IEmployee, IEmployeeModel>({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: validateEmail,
      message: 'Please enter a valid email address'
    }
  },
  age: { 
    type: Number, 
    required: [true, 'Age is required'],
    min: [18, 'Age must be at least 18'],
    max: [70, 'Age cannot exceed 70']
  },
  phone: {
    type: String,
    validate: {
      validator: validatePhone,
      message: 'Please enter a valid phone number'
    }
  },
  class: { 
    type: String, 
    required: [true, 'Class is required'],
    trim: true
  },
  subjects: [{
    type: String,
    trim: true
  }],
  attendance: { 
    type: Number, 
    default: 100,
    min: [0, 'Attendance cannot be negative'],
    max: [100, 'Attendance cannot exceed 100']
  },
  role: { 
    type: String, 
    enum: {
      values: ['ADMIN', 'EMPLOYEE'] as UserRole[],
      message: '{VALUE} is not a valid role'
    },
    required: true 
  },
  dateOfJoining: {
    type: Date,
    default: Date.now,
    required: true
  },
  lastAttendanceUpdate: {
    type: Date
  }
}, 
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(_doc, ret) {
        ret['id'] = ret['_id'].toString();
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform: function(_doc, ret) {
        ret['id'] = ret['_id'].toString();
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      }
    }
});

// Indexes
employeeSchema.index({ name: 1 });
employeeSchema.index({ email: 1 }, { unique: true });
employeeSchema.index({ class: 1 });
employeeSchema.index({ attendance: -1 });

// Virtual for attendance records
employeeSchema.virtual('attendanceRecords', {
  ref: 'AttendanceRecord',
  localField: '_id',
  foreignField: 'employeeId'
});

// Instance methods
employeeSchema.methods = {
  async updateAttendancePercentage(this: IEmployee): Promise<void> {
    const AttendanceRecord = mongoose.model('AttendanceRecord');
    const records = await AttendanceRecord.find({ 
      employeeId: this._id 
    });
    
    if (records.length === 0) {
      this.attendance = 100;
    } else {
      const presentDays = records.filter(record => record.present).length;
      this.attendance = (presentDays / records.length) * 100;
    }
    
    this.lastAttendanceUpdate = new Date();
    await this.save();
  }
};

// Static methods
employeeSchema.statics = {
  async updateAttendanceStats(this: IEmployeeModel, employeeId: string): Promise<void> {
    const employee = await this.findById(employeeId);
    if (employee) {
      await employee.updateAttendancePercentage();
    }
  },

  async calculateAttendancePercentage(this: IEmployeeModel, employeeId: string): Promise<number> {
    const employee = await this.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }
    await employee.updateAttendancePercentage();
    return employee.attendance;
  }
};

export const Employee = mongoose.model<IEmployee, IEmployeeModel>('Employee', employeeSchema);

export type { IEmployeeBase, IEmployee, IEmployeeModel };