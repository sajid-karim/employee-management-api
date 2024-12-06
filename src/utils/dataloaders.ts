import DataLoader from 'dataloader';
import { Types } from 'mongoose';
import { Employee } from '../models/employee';
import { AttendanceRecord } from '../models/attendanceRecord';
import { DataLoaders } from '../types';

import { LeanEmployee, LeanAttendanceRecord } from '../types';


export const createDataLoaders = (): DataLoaders => ({
  employeeLoader: new DataLoader<string, LeanEmployee | null>(
    async (ids: readonly string[]) => {
      try {
        const employees = await Employee.find({
          _id: { $in: ids.map(id => new Types.ObjectId(id)) }
        }).lean() as LeanEmployee[];

        const employeeMap = new Map(
          employees.map(employee => {
            if (!employee._id) {
              throw new Error(`Employee missing _id: ${JSON.stringify(employee)}`);
            }
            return [employee._id.toString(), { ...employee, id: employee._id.toString() }] as [string, LeanEmployee];
          })
        );

        return ids.map(id => employeeMap.get(id) || null);
      } catch (error) {
        console.error('Error in employeeLoader:', error);
        throw error;
      }
    },
    {
      cache: true,
      maxBatchSize: 100,
      cacheKeyFn: (key: string) => key.toString()
    }
  ),

  attendanceLoader: new DataLoader<string, LeanAttendanceRecord[]>(
    async (employeeIds: readonly string[]): Promise<LeanAttendanceRecord[][]> => {
      try {
        const records = await AttendanceRecord.find({
          employeeId: { 
            $in: employeeIds.map(id => new Types.ObjectId(id))
          }
        })
        .sort({ date: -1 })
        .lean() as LeanAttendanceRecord[];

        // Initialize empty arrays for all employeeIds
        const recordMap = new Map<string, LeanAttendanceRecord[]>();
        employeeIds.forEach(id => recordMap.set(id, []));

        // Populate the recordMap with attendance records
        records.forEach(record => {
          const employeeId = record.employeeId.toString();
          if (recordMap.has(employeeId)) {
            recordMap.get(employeeId)?.push(record);
          }
        });

        return employeeIds.map(id => recordMap.get(id) || []);
      } catch (error) {
        console.error('Error in attendanceLoader:', error);
        throw error;
      }
    },
    {
      cache: true,
      maxBatchSize: 100,
      cacheKeyFn: (key: string) => key.toString()
    }
  ),
});

export const invalidateLoaderCache = (
  loaders: DataLoaders,
  type: 'employee' | 'attendance',
  id: string
): void => {
  switch (type) {
    case 'employee':
      loaders.employeeLoader.clear(id);
      break;
    case 'attendance':
      loaders.attendanceLoader.clear(id);
      break;
  }
};