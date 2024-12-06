// init-mongo.js
db.createUser({
  user: 'employee_app',
  pwd: 'employee_pass',
  roles: [
    {
      role: 'readWrite',
      db: 'employee_db'
    }
  ]
});

db = db.getSiblingDB('employee_db');

// Create indexes
db.employees.createIndex({ "email": 1 }, { unique: true });
db.employees.createIndex({ "name": 1 });
db.employees.createIndex({ "class": 1 });
db.employees.createIndex({ "attendance": -1 });

db.attendanceRecords.createIndex({ "employeeId": 1 });
db.attendanceRecords.createIndex({ "date": 1 });
db.attendanceRecords.createIndex({ "employeeId": 1, "date": 1 }, { unique: true });