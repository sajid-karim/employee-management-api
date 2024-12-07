# Employee Management API

This service provides GraphQL APIs to manage employee data. The API is hosted at:  
`https://employee-management-api.fly.dev/graphql`

---

## **Getting Started**

### **Step 1: Obtain an Authorization Token**
Before accessing the GraphQL API, you must obtain an authorization token.  

Use the following **curl** command to get the token:

```bash
curl --location 'https://employee-management-api.fly.dev/auth/token' \
--header 'Content-Type: application/json' \
--data-raw '{
  "id": "admin123",
  "role": "ADMIN",
  "email": "admin@example.com",
  "name": "Claro Doe"
}'
```
# Response
The response will include a token, which you must include in the headers of all subsequent API requests.

Example:

```json
{
  "token": "your_access_token_here"
}
```

# Step 2: Access the GraphQL API
Once you have the token, you can interact with the GraphQL API using tools like Postman, curl, or any HTTP client.

## Headers
- Include the token in the Authorization header as follows:

```http
Authorization: Bearer your_access_token_here
```

# GraphQL Operations

## Query Example: Fetch Employee Data
Use the following query to fetch employee details:

Request Body:

```json
{
  "query": "query GetEmployee($id: ID!) { employee(id: $id) { id name age class subjects email phone attendance role dateOfJoining createdAt updatedAt } }",
  "variables": {
    "id": "employee_id_here"
  }
}
```

## Mutation Example: Create a New Employee
Use the following mutation to create a new employee:

Request Body:

```json
{
  "query": "mutation CreateEmployee($input: CreateEmployeeInput!) { createEmployee(input: $input) { success message employee { id name age class subjects email phone attendance role dateOfJoining createdAt updatedAt } errors { field message code } } }",
  "variables": {
    "input": {
      "name": "John Doe",
      "age": 30,
      "class": "10th Grade",
      "subjects": ["Math", "Science"],
      "email": "johndoe@example.com",
      "phone": "1234567890",
      "attendance": 95.5,
      "role": "Teacher",
      "dateOfJoining": "2023-01-01"
    }
  }
}
```

# Step 3: Testing with Postman
1. Open Postman and create a new request.

2. Set the request method to POST and enter the GraphQL endpoint:
https://employee-management-api.fly.dev/graphql
3. Add the Authorization header:
```http
Authorization: Bearer your_access_token_here
```
4. In the Body tab, choose raw and set the format to JSON.
Enter the query or mutation in the body section.

# API Reference
- ## Token Generation:
  - POST https://employee-management-api.fly.dev/auth/token

- ## GraphQL API:
  - POST https://employee-management-api.fly.dev/graphql

- ## Headers
  - Content-Type: application/json
  - Authorization: Bearer <your_access_token>

# Notes
Replace placeholder values (e.g., your_access_token_here, employee_id_here) with actual data. Ensure the input for mutations follows the required schema.