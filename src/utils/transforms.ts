import { LeanEmployee, IEmployee } from '../types';

export const toGraphQLEmployee = (employee: any): LeanEmployee => ({
  ...employee,
  id: employee._id.toString(),
  _id: undefined
});

export const toGraphQLEmployees = (employees: any[]): IEmployee[] => {

  return employees.map(employee => ({

    ...employee,

    id: employee._id.toString()

  })) as IEmployee[];
};