# Service Management Portal

A full-stack machine service management portal for owners, managers, engineers, and customers.

The portal provides:

- Role-based authentication and protected workspaces
- MongoDB-backed users, machines, service requests, messages, and portal settings
- Owner, manager, engineer, and customer dashboards
- Interactive charts and live database summaries
- User, machine, and service-request management
- Private messaging between permitted portal users
- Owner-controlled running/read-only portal mode
- MongoDB Compass support for inspecting the database directly

## Technology stack

### Frontend

- React
- React Router
- Recharts
- Axios
- Vite

### Backend

- Node.js
- Express
- Mongoose
- JSON Web Tokens
- bcryptjs
- MongoDB

## Project structure

```text
software_project/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── data/
│   │   └── seed.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Machine.js
│   │   ├── Message.js
│   │   ├── ServiceRequest.js
│   │   ├── SystemSetting.js
│   │   └── User.js
│   └── server.js
├── src/
│   ├── components/
│   │   └── Layout.jsx
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── CustomerDashboard.jsx
│   │   ├── EngineerDashboard.jsx
│   │   ├── LoginPage.jsx
│   │   ├── ManagerDashboard.jsx
│   │   ├── OwnerDashboard.jsx
│   │   └── PortalPages.jsx
│   ├── App.jsx
│   └── index.css
├── .env
├── package.json
└── README.md
```

## Requirements

- Node.js 18 or newer
- npm
- MongoDB Server
- MongoDB Compass (recommended for viewing the database)

## MongoDB setup

The project is configured to use the local MongoDB database:

```text
mongodb://127.0.0.1:27017/service_management_portal
```

The MongoDB connection is defined in [.env](./.env):

```env
PORT=5000
JWT_SECRET=service-portal-super-secret
MONGODB_URI=mongodb://127.0.0.1:27017/service_management_portal
```

Start the MongoDB Windows service if it is not already running:

```powershell
Start-Service MongoDB
```

Check its status:

```powershell
Get-Service MongoDB
```

## Open the database in MongoDB Compass

1. Open MongoDB Compass.
2. Paste this connection string:

   ```text
   mongodb://127.0.0.1:27017/service_management_portal
   ```

3. Click **Connect**.
4. Expand the `service_management_portal` database.

Main collections:

| Collection | Purpose |
|---|---|
| `users` | Owner, manager, engineer, and customer accounts |
| `machines` | Customer-owned service equipment |
| `servicerequests` | Maintenance and repair requests |
| `messages` | Private user-to-user messages |
| `systemsettings` | Persistent owner portal status |

## Install dependencies

From the project directory:

```powershell
cd "C:\Users\manya\OneDrive\Desktop\software_project"
npm.cmd install
```

## Run the application

Run frontend and backend together:

```powershell
npm.cmd run dev
```

Or run them separately.

Backend:

```powershell
npm.cmd run server
```

Frontend:

```powershell
npm.cmd run client
```

Open the frontend at:

```text
http://localhost:5173
```

The API runs at:

```text
http://localhost:5000
```

## Demo accounts

The first server start seeds demo records if the database has no users.

| Role | Email | Password |
|---|---|---|
| Owner | `owner@portal.com` | `Password123` |
| Manager | `manager@portal.com` | `Password123` |
| Engineer | `engineer@portal.com` | `Password123` |
| Customer | `customer@portal.com` | `Password123` |

Change demo passwords before using the application outside local development.

## Portal roles

### Owner

The owner has organization-wide visibility and can:

- View live totals and charts
- Manage managers, engineers, and customers
- Add, update, and delete machines
- View and manage service requests
- View private conversations with individual users
- Inspect organization overview data
- View reports and analytics
- Pause or resume the portal

Owner pages:

```text
/owner
/owner/managers
/owner/engineers
/owner/customers
/owner/machines
/owner/service-requests
/owner/messages
/owner/reports
/owner/analytics
/owner/settings
```

### Manager

Managers can work with users and records assigned to their organization:

- Manage engineers and customers
- Manage machines
- Assign engineers to service requests
- Update request status
- View workload and priority charts
- Message individual engineers and customers
- View team workload

Manager pages:

```text
/manager
/manager/engineers
/manager/customers
/manager/requests
/manager/machines
/manager/reports
```

### Engineer

Engineers can:

- View assigned requests
- Track open and in-progress work
- Resolve assigned requests
- View assigned machines
- View their manager and team overview
- Message their manager

Engineer pages:

```text
/engineer
/engineer/assigned-requests
/engineer/machines
/engineer/activity
```

### Customer

Customers can:

- View their machines
- Create service requests
- Track request status
- Approve completed work
- Message their manager or assigned engineer

Customer pages:

```text
/customer
/customer/machines
/customer/service-requests
/customer/messages
```

## Portal running/read-only mode

The owner can pause the portal from:

```text
/owner/settings
```

When paused:

- All users can still view dashboards and records.
- Managers, engineers, and customers cannot create, update, or delete records.
- The owner can still make changes.
- Every signed-in portal displays `Portal running` or `Portal paused`.
- The status is stored in the `systemsettings` MongoDB collection.

The API endpoints are:

```text
GET   /api/system-status
PATCH /api/system-status
```

Only the owner can update the system status.

## Messaging

Messages are stored in MongoDB and are restricted by role and relationship.

Message endpoints:

```text
GET  /api/message-contacts
GET  /api/messages
GET  /api/messages?contactId=<userId>
POST /api/messages
```

The `contactId` filter loads one private conversation only. It prevents the owner or another user from viewing unrelated conversations in the selected conversation view.

## Important API endpoints

### Authentication

```text
POST /api/auth/login
GET  /api/auth/me
```

### Dashboards

```text
GET /api/dashboard
```

Dashboard responses include:

- Summary counts
- Recent requests
- Status breakdown
- Priority breakdown
- Engineer workload
- Manager request volume
- Monthly request totals

### Users

```text
GET    /api/users
POST   /api/users
PATCH  /api/users/:id
DELETE /api/users/:id
```

Role-specific routes:

```text
GET    /api/managers
GET    /api/engineers
POST   /api/engineers
PATCH  /api/engineers/:id
DELETE /api/engineers/:id
GET    /api/customers
POST   /api/customers
PATCH  /api/customers/:id
DELETE /api/customers/:id
```

### Machines

```text
GET    /api/machines
POST   /api/machines
PATCH  /api/machines/:id
DELETE /api/machines/:id
```

### Service requests

```text
GET   /api/service-requests
POST  /api/service-requests
PATCH /api/service-requests/:id
```

### Health check

```text
GET /api/health
```

## Testing the API with PowerShell

Login:

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:5000/api/auth/login" `
  -ContentType "application/json" `
  -Body (@{
    email = "owner@portal.com"
    password = "Password123"
  } | ConvertTo-Json)

$headers = @{
  Authorization = "Bearer $($login.token)"
}
```

Read dashboard data:

```powershell
Invoke-RestMethod `
  -Headers $headers `
  -Uri "http://localhost:5000/api/dashboard"
```

Read users:

```powershell
Invoke-RestMethod `
  -Headers $headers `
  -Uri "http://localhost:5000/api/users"
```

Read messages:

```powershell
Invoke-RestMethod `
  -Headers $headers `
  -Uri "http://localhost:5000/api/messages"
```

## Build the frontend

```powershell
npm.cmd run build
```

The production files are generated in:

```text
dist/
```

## Database notes

- The server seeds demo data only when the database contains no users.
- Existing database records are preserved on later restarts.
- Deleting users can also remove related machines depending on the route used.
- Deleting machines removes related service requests.
- Passwords are hashed with bcrypt before storage.
- JWT tokens expire after eight hours.
- Do not commit `.env` or database credentials.

## Troubleshooting

### MongoDB connection failed

Check the MongoDB service:

```powershell
Get-Service MongoDB
```

Start it:

```powershell
Start-Service MongoDB
```

Check the configured connection:

```powershell
Get-Content ".env"
```

### Port 5000 is already in use

Find the process:

```powershell
Get-NetTCPConnection -LocalPort 5000
```

Then stop the specific process if necessary:

```powershell
Stop-Process -Id <PROCESS_ID>
```

### The database is empty

Make sure MongoDB is running, then restart the backend:

```powershell
npm.cmd run server
```

The demo seed runs automatically when no users exist.
