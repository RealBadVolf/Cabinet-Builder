# ◧ Cabinet Studio

Parametric frameless cabinet design system with automatic cut lists, dado/rabbet joinery calculations, shelf pin layouts, and DXF export for Vectric Aspire.

**Live at:** https://cab.badvolf.ru

---

## Architecture

```
cabinet-studio/
├── db/
│   └── schema.sql          # MariaDB schema (users, jobs, cabinets, parts, operations)
├── server/
│   ├── index.js             # Express API entry point
│   ├── db.js                # MariaDB connection pool
│   ├── compute.js           # Cabinet computation engine (parts, dados, drills)
│   ├── middleware/
│   │   └── auth.js          # JWT auth + role middleware
│   └── routes/
│       ├── auth.js          # Register, login, user management
│       ├── jobs.js          # Project CRUD
│       ├── cabinets.js      # Cabinet CRUD + auto-part generation
│       └── export.js        # Cut list text + DXF file generation
├── client/
│   └── src/
│       ├── App.jsx          # React app (auth, routing, project mgmt, admin)
│       └── api.js           # API client with token management
├── nginx/
│   └── default.conf         # Reverse proxy config for cab.badvolf.ru
├── docker-compose.yml       # Full stack orchestration
└── .env.example             # Environment variable template
```

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Database | MariaDB 11                          |
| API      | Node.js + Express                   |
| Auth     | JWT (access + refresh tokens)       |
| Frontend | React 18 + Vite + React Router      |
| Proxy    | Nginx                               |
| Deploy   | Docker Compose                      |

## User Roles

| Role      | Can See             | Can Edit            | Admin Panel |
|-----------|---------------------|---------------------|-------------|
| `admin`   | All projects        | All projects        | Yes (full)  |
| `manager` | All projects        | Assigned + own      | Yes (read)  |
| `user`    | Own projects only   | Own projects only   | No          |
| Anonymous | Designer only       | N/A (no saving)     | No          |

Anonymous users can use the full designer, export cut lists and DXF files, but cannot save to the database. Registration is free.

---

## Quick Start (Development)

### 1. Database

```bash
# Start MariaDB (or use existing)
docker run -d --name cabinet-db \
  -e MARIADB_ROOT_PASSWORD=rootpass \
  -e MARIADB_DATABASE=cabinet_studio \
  -e MARIADB_USER=cabinet \
  -e MARIADB_PASSWORD=cabinet \
  -p 3306:3306 \
  mariadb:11

# Load schema
mysql -h 127.0.0.1 -u cabinet -pcabinet cabinet_studio < db/schema.sql
```

### 2. Server

```bash
cd server
cp ../.env.example .env   # Edit values
npm install
npm run dev               # http://localhost:3001
```

### 3. Client

```bash
cd client
npm install
npm run dev               # http://localhost:5173 (proxies API to :3001)
```

---

## Production Deployment

### 1. Prepare

```bash
cp .env.example .env
# Edit .env — CHANGE ALL PASSWORDS AND JWT_SECRET
# Generate JWT secret:
openssl rand -hex 32
```

### 2. SSL Certificates (Let's Encrypt)

```bash
mkdir -p nginx/certs
# Using certbot:
certbot certonly --standalone -d cab.badvolf.ru
cp /etc/letsencrypt/live/cab.badvolf.ru/fullchain.pem nginx/certs/
cp /etc/letsencrypt/live/cab.badvolf.ru/privkey.pem nginx/certs/

# Then uncomment the HTTPS server block in nginx/default.conf
```

### 3. Deploy

```bash
docker compose up -d --build
```

### 4. Verify

```bash
curl https://cab.badvolf.ru/api/health
# {"status":"ok","db":"connected"}
```

---

## Default Admin Account

| Field    | Value               |
|----------|---------------------|
| Username | `admin`             |
| Email    | `admin@badvolf.ru`  |
| Password | `changeme123`       |

**Change this password immediately after first login.**

---

## API Endpoints

### Auth
```
POST /api/auth/register     { email, username, password, firstName, lastName }
POST /api/auth/login         { login, password }
GET  /api/auth/me            → current user
GET  /api/auth/users         → admin: list all users
PUT  /api/auth/users/:id/role    { role }
PUT  /api/auth/users/:id/active  { active }
```

### Jobs (Projects)
```
GET    /api/jobs             → list (filtered by role)
POST   /api/jobs             { jobCode, jobName, description }
GET    /api/jobs/:id
PUT    /api/jobs/:id         { jobName, status, notes, ... }
DELETE /api/jobs/:id
```

### Cabinets
```
GET    /api/cabinets/job/:jobId     → list cabinets in job
POST   /api/cabinets/job/:jobId     { cabinetCode, name, cabinetType, config }
GET    /api/cabinets/:id            → cabinet + parts + operations
PUT    /api/cabinets/:id            { config, ... }  → regenerates parts
DELETE /api/cabinets/:id
POST   /api/cabinets/:id/duplicate  { cabinetCode }
```

### Export
```
GET /api/export/cabinet/:id/cutlist  → text file download
GET /api/export/cabinet/:id/dxf     → DXF file (all parts, layered)
GET /api/export/part/:partId/dxf    → DXF for single part
```

### Public (no auth)
```
GET /api/door-styles     → all active door styles
GET /api/materials       → all active materials
GET /api/hardware        → all active hardware catalog
GET /api/health          → server + db status
```

---

## DXF Layer Naming (Vectric Aspire)

Each exported DXF uses named layers that map directly to Aspire toolpaths:

| Layer         | Color | Purpose                     |
|---------------|-------|-----------------------------|
| Profile_Cut   | White | Outer part profile (through cut) |
| Dado          | Red   | Dado channels               |
| Rabbet        | Magenta | Rabbet cuts               |
| Drill         | Cyan  | Generic drill holes         |
| Hinge_Bore    | Yellow | 35mm hinge cup bores       |
| Shelf_Pins    | Green | 5mm shelf pin holes         |
| Label         | Gray  | Part ID text (engrave)      |
| Reference     | —     | Non-cutting reference lines |

Layer names are configurable in the `dxf_layer_configs` table.

---

## Database Schema Highlights

- **25+ tables** covering clients, jobs, cabinets, parts, joinery operations, hardware, materials, door styles, edge banding, nesting, DXF exports, finishes, and audit logging
- **All dimensions in mm** (DECIMAL(10,2))
- **Cabinet `config` stored as JSON** for flexibility — the computation engine reads it and generates parts/operations
- **10 built-in door styles** seeded with correct rail/stile dimensions and joinery methods
- **Views** for cut lists, hardware shopping lists, and material needs estimates

---

## Next Steps

- [ ] Integrate the full CabinetStudio React component into the designer page
- [ ] Sheet goods nesting optimizer
- [ ] 3D WebGL preview (Three.js)
- [ ] Drawer box auto-calculation
- [ ] Cost estimation from material + hardware catalog
- [ ] PDF report generation (cut list + shop drawings)
- [ ] Import/export cabinet templates
