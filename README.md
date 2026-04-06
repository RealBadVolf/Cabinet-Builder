# ◧ Cabinet Studio

**Parametric frameless (Euro-style) kitchen cabinet design system with automatic cut lists, dado/rabbet joinery, shelf pin layouts, and DXF export for CNC routers.**

Live instance: **https://cab.badvolf.ru:8443**

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Construction Logic](#construction-logic)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Getting Started](#getting-started)
- [User Roles & Access](#user-roles--access)
- [Using the Application](#using-the-application)
- [Configuration Parameters](#configuration-parameters)
- [Door Styles](#door-styles)
- [DXF Layer Reference](#dxf-layer-reference)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Computation Engine](#computation-engine)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Overview

Cabinet Studio is a full-stack web application for designing frameless (European-style) kitchen cabinets. It generates precise cut lists with all joinery operations — dados, rabbets, shelf pin holes, and hinge bores — and exports production-ready DXF files with named layers for direct import into CNC software like Vectric Aspire, VCarve, or any CAM package that reads DXF.

Every dimension is stored and computed in **millimeters**. No imperial. No ISO. Just mm.

The system supports multiple users, project management with multiple cabinets per job, role-based access control, and batch DXF export across cabinets with per-material-thickness file separation.

---

## Features

### Design
- Full parametric configuration of every dimension: height, width, depth, material thickness, dado depth, shelf pin spacing, door overlay, and 30+ other parameters
- 10 built-in door styles: Slab, Shaker, Raised Panel, Flat Panel R&S, Glass Front, Cathedral Arch, Beadboard, Mullion Glass, Louvered, Board & Batten
- Rail & stile door component generation with correct tongue/groove allowances
- Real-time front view and section view SVG visualization with door toggle
- Automatic computation of all derived dimensions

### Production
- Complete cut list with part names, dimensions, quantities, material callouts, and edge banding requirements
- Dado, rabbet, and groove operations with positions, widths, depths, and lengths
- Shelf pin hole layouts following the 32mm system standard
- Hinge cup bore positions (35mm Forstner, configurable boring distance)
- DXF export with operations on separate named layers for CNC toolpath assignment
- Per-thickness DXF separation (18mm case parts on one file, 6mm back panels on another)
- Job-level batch export: select one, several, or all cabinets and export combined DXF per thickness
- Mirrored left/right side panels with correctly positioned operations on inside faces

### Management
- Multi-user system with JWT authentication
- Three roles: admin, manager, user
- Project (job) organization with multiple cabinets per project
- Cabinet duplication for quick variations
- Admin panel for user management

---

## Construction Logic

Cabinet Studio models real-world frameless cabinet construction. Understanding the construction is essential for verifying the output.

### Side Panels (Integrated Toe Kick)

When the toe kick style is set to "integral" (the default), each side panel is cut to the **full cabinet height** (e.g., 760mm) with an L-shaped notch at the bottom-front corner. This notch creates the toe kick recess.

```
                    ┌───────────────────────┐
                    │                       │ ← Full height (760mm)
                    │                       │
                    │     Side Panel         │
                    │                       │
                    │                       │
    Toe kick notch →├────┐                  │
      (100×75mm)    │    │                  │
                    └────┴──────────────────┘
                    ← depth (580mm) →
```

The **left side** has the notch at the bottom-left (front edge). The **right side** is **mirrored** — the notch is at the bottom-right, and all dado/hole positions are flipped on the Y axis so that operations land on the inside face of both panels.

### Joinery on Side Panels

Each side panel receives the following operations:

1. **Bottom panel dado** — A stopped dado at `toeKickHeight` (100mm) from the bottom, running across the depth but stopping before the back panel rabbet. Width = case material thickness (18mm). Depth = dado depth (10mm).

2. **Front nailer dado** — At the top of the panel (18mm from the top edge), running 90mm from the front edge. This captures the front nailer/stretcher.

3. **Rear nailer dado** — At the top of the panel, running 90mm from the rabbet inward. This captures the rear nailer which is used for wall mounting.

4. **Back panel rabbet** — Along the rear edge, running from the top of the panel down to the bottom panel position. Width = back panel thickness + 1mm clearance (7mm). Depth = rabbet depth (10mm).

### Bottom Panel

Sized to fit into the dados on both sides, with dado depth extensions on each side. The front edge is flush with the side panels. The rear edge stops before the back panel rabbet.

```
Bottom width  = internal width + 2 × dado depth
Bottom depth  = cabinet depth - back panel thickness - material thickness + dado depth
```

### Nailers (Stretchers)

Two horizontal stretchers at the top of the cabinet, captured in dados in the side panels. Length extends into the dados on both sides for a strong mechanical connection.

```
Nailer length = internal width + 2 × dado depth
```

The front nailer is set back 3mm from the front edge to allow for scribing to walls. The rear nailer is flush with the rabbet and used for wall mounting.

### Back Panel

A thin panel (typically 6mm) that sits in the rabbet on both side panels. Pin-nailed and glued for rigidity — this is the primary racking brace for the cabinet.

### Adjustable Shelves

Undersized by 1mm from the internal width for clearance, resting on shelf pins. Shelf pin holes follow the 32mm system: rows of 5mm holes at 32mm spacing, starting above the bottom panel and ending below the nailers.

### Fixed Shelves

Oversized by 2 × dado depth to extend into dados on both sides, similar to the bottom panel.

### Door Construction

For **slab (flat panel) doors**: a single rectangular blank is generated with hinge cup bore positions.

For **rail & stile doors** (Shaker, Raised Panel, Glass, etc.): the system generates individual components per door — two rails, two stiles, and a center panel — with correct dimensions including tongue allowances for the panel groove. The hinge cup bores are placed on the **hinge stile** rather than a monolithic door blank. Each door in a double-door configuration gets its own complete set of R&S components.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│    Nginx     │────▶│  Express API │
│  React SPA   │◀────│  (reverse    │◀────│  (Node.js)   │
│              │     │   proxy)     │     │              │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │   MariaDB    │
                                          │              │
                                          └──────────────┘
```

The computation engine runs in **two places**:

1. **Client-side** (`CabinetStudio.jsx`) — for real-time preview, cut list display, and the copy-to-clipboard feature. This works even for anonymous users without saving.

2. **Server-side** (`compute.js`) — for DXF export and database persistence. The server recomputes from the stored cabinet config on every export, so DXF files always reflect the latest computation logic regardless of when the cabinet was created.

---

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Database   | MariaDB 11 (mysql2 driver)                    |
| API        | Node.js 18+ with Express 4                    |
| Auth       | JWT access tokens (24h) + refresh tokens (30d)|
| Frontend   | React 18 + Vite + React Router 6              |
| Styling    | Inline styles + CSS-in-JS (no framework)      |
| Proxy      | Nginx with Let's Encrypt SSL                  |
| Deployment | systemd service + Nginx reverse proxy         |

---

## Directory Structure

```
cabinet-studio/
├── .env.example                 # Environment variable template
├── .gitignore
├── README.md
├── docker-compose.yml           # Optional Docker deployment
├── run-local.sh                 # Local dev startup script
│
├── db/
│   └── schema.sql               # MariaDB schema + seed data (17 tables)
│
├── server/
│   ├── package.json
│   ├── index.js                 # Express entry point, route mounting, static serving
│   ├── db.js                    # MariaDB connection pool (mysql2)
│   ├── compute.js               # Cabinet computation engine
│   ├── Dockerfile
│   ├── middleware/
│   │   └── auth.js              # JWT auth, role checking, token signing
│   └── routes/
│       ├── auth.js              # Register, login, user management
│       ├── jobs.js              # Project CRUD with role-based filtering
│       ├── cabinets.js          # Cabinet CRUD, auto part generation, regeneration
│       └── export.js            # Cut list text, DXF generation, batch export
│
├── client/
│   ├── package.json
│   ├── vite.config.js           # Vite config with API proxy for dev
│   ├── index.html
│   ├── Dockerfile
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── api.js               # API client with token management
│       ├── App.jsx              # Auth, routing, projects, admin panel
│       └── components/
│           └── CabinetStudio.jsx # Full parametric designer UI
│
└── nginx/
    ├── default.conf             # Nginx reverse proxy config
    └── certs/                   # SSL certificates (not in repo)
```

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **MariaDB** 10.6 or later (or MySQL 8+)
- **npm** 8+
- **Nginx** (for production)

### Database Setup

```bash
mysql -u root -p

CREATE DATABASE IF NOT EXISTS cabinet_studio
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cabinet'@'localhost'
  IDENTIFIED BY 'YourPasswordHere';
GRANT ALL PRIVILEGES ON cabinet_studio.* TO 'cabinet'@'localhost';
FLUSH PRIVILEGES;
EXIT;

mysql -u cabinet -pYourPasswordHere cabinet_studio < db/schema.sql
```

The schema seeds: an admin user, 10 door styles, 6 sheet goods, Blum 110° hinge, 5mm shelf pins, and a default DXF layer config.

**Set the admin password** (required after fresh install):

```bash
cd server && npm install
node --input-type=module -e "
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
const hash = await bcrypt.hash('changeme123', 12);
const c = await mysql.createConnection({
  host:'127.0.0.1', user:'cabinet',
  password:'YourPasswordHere', database:'cabinet_studio'
});
await c.query('UPDATE users SET password_hash=? WHERE username=?', [hash,'admin']);
console.log('Admin password set to: changeme123');
process.exit(0);
"
```

### Environment Configuration

```bash
cp .env.example .env
nano .env
```

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=cabinet
DB_PASS=YourPasswordHere
DB_NAME=cabinet_studio
JWT_SECRET=generate-with-openssl-rand-hex-32
PORT=3001
CORS_ORIGIN=https://cab.badvolf.ru:8443
```

Generate a JWT secret: `openssl rand -hex 32`

### Running in Development

```bash
# Terminal 1: API
cd server && node --watch index.js

# Terminal 2: Client (hot reload, proxies /api to :3001)
cd client && npm install && npm run dev
# → http://localhost:5173
```

### Production Deployment

```bash
# 1. Build client
cd client && npm run build && cd ..

# 2. Nginx config
cp nginx/default.conf /etc/nginx/sites-available/cabinet-studio.conf
ln -sf /etc/nginx/sites-available/cabinet-studio.conf /etc/nginx/sites-enabled/

# 3. SSL
certbot --nginx -d cab.badvolf.ru

# 4. systemd service
cat > /etc/systemd/system/cabinet-studio.service << 'EOF'
[Unit]
Description=Cabinet Studio API
After=network.target mariadb.service
[Service]
Type=simple
WorkingDirectory=/path/to/cabinet-studio/server
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/path/to/cabinet-studio/.env
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now cabinet-studio

# 5. Verify
curl http://127.0.0.1:3001/api/health
nginx -t && systemctl reload nginx
```

---

## User Roles & Access

| Role          | Own Projects | All Projects | Admin Panel | DXF Export | Guest Design |
|---------------|:------------:|:------------:|:-----------:|:----------:|:------------:|
| **admin**     | ✓            | ✓            | Full        | ✓          | —            |
| **manager**   | ✓            | ✓ (read)     | Read-only   | ✓          | —            |
| **user**      | ✓            | ✗            | ✗           | ✓          | —            |
| **anonymous** | ✗            | ✗            | ✗           | ✗          | ✓            |

Anonymous users can use the full designer, view cut lists, and copy to clipboard. Saving and DXF export require a free account.

---

## Using the Application

### Guest Mode

Navigate to `/designer` without logging in. Full parametric designer with real-time cut list. Use "Copy" to export as text.

### Projects & Cabinets

1. Sign in → Create a project (code + name) → Add cabinets
2. Click a cabinet card to open the designer
3. Configure all parameters → Save → Export DXF

### DXF Export

**From the designer:** Per-thickness buttons in the header: `[18mm ⬇] [6mm ⬇]`

**From the project page:** Export bar with cabinet selection:
```
Export DXF: [Select All] [Clear] 3 selected   [18mm ⬇] [6mm ⬇]
☑ B1  ☑ B2  ☐ W1  ☑ W2
```
No selection = all cabinets. Parts from multiple cabinets are combined into one DXF per thickness.

---

## Configuration Parameters

All dimensions in millimeters.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `height` | 760 | Overall cabinet height including toe kick |
| `width` | 600 | Overall cabinet width |
| `depth` | 580 | Overall cabinet depth |
| `caseMaterialThickness` | 18 | Side, bottom, shelf, nailer thickness |
| `backPanelThickness` | 6 | Back panel thickness |
| `doorMaterialThickness` | 18 | Door material thickness |
| `dadoDepth` | 10 | Dado cut depth into sides |
| `rabbetDepth` | 10 | Rabbet cut depth for back panel |
| `toeKickHeight` | 100 | Toe kick area height |
| `toeKickRecess` | 75 | Toe kick setback from front |
| `toeKickStyle` | integral | `integral`, `separate_plinth`, `legs`, `none` |
| `shelfCount` | 1 | Number of shelves |
| `shelfType` | adjustable | `adjustable`, `fixed`, `none` |
| `pinDia` | 5 | Shelf pin hole diameter |
| `pinDepth` | 12 | Shelf pin hole depth |
| `pinSpacing` | 32 | Shelf pin hole spacing (32mm system) |
| `pinRowsPerSide` | 2 | Pin hole rows per side |
| `pinInsetFront` | 37 | Pin row inset from front edge |
| `pinInsetRear` | 37 | Pin row inset from rear edge |
| `pinZoneStart` | 80 | Pin zone start above bottom panel |
| `pinZoneEnd` | 80 | Pin zone end below nailer |
| `doorCount` | 1 | Doors: 0, 1, or 2 |
| `doorStyle` | shaker | Door style code |
| `doorOverlay` | 12 | Door overlay per side |
| `doorGap` | 3 | Gap between double doors |
| `doorReveal` | 3 | Gap around door perimeter |
| `nailerHeight` | 90 | Nailer strip height |
| `hingeBoreDia` | 35 | Hinge cup bore diameter |
| `hingeBoreDepth` | 13 | Hinge cup bore depth |
| `hingeBoreFromEdge` | 22 | Hinge bore center from door edge |

---

## Door Styles

| Code | Name | Type | Rail | Stile | Panel |
|------|------|------|------|-------|-------|
| `slab` | Slab | Blank | — | — | Flat solid |
| `shaker` | Shaker | R&S | 65 | 65 | Flat recessed |
| `raised_panel` | Raised Panel | R&S | 70 | 70 | Beveled raised |
| `flat_panel_rs` | Flat Panel R&S | R&S | 60 | 60 | Flat flush |
| `glass_front` | Glass Front | R&S | 55 | 55 | Glass insert |
| `cathedral` | Cathedral Arch | R&S | 75 | 65 | Arched raised |
| `beadboard` | Beadboard | R&S | 55 | 55 | Vertical beads |
| `mullion` | Mullion Glass | R&S | 55 | 55 | Divided glass |
| `louvered` | Louvered | R&S | 60 | 60 | Angled slats |
| `board_batten` | Board & Batten | Blank | — | — | Vertical boards |

Slab/B&B: generates door blanks with hinge bores. R&S styles: generates rails, stiles (hinge stile gets bores), and center panel per door.

---

## DXF Layer Reference

| Layer | Color | Purpose | Toolpath |
|-------|-------|---------|----------|
| `Profile_Cut` | White (7) | Part outer profile | Through-cut |
| `Dado` | Red (1) | Dado channels | Pocket/dado |
| `Rabbet` | Magenta (5) | Back panel rabbet | Pocket |
| `Hinge_Bore` | Yellow (6) | 35mm hinge cups | Drill/pocket |
| `Shelf_Pins` | Green (2) | 5mm pin holes | Drill |
| `Drill` | Cyan (4) | Other drill ops | Drill |
| `Label` | Gray (8) | Part ID text | V-carve or skip |

**DXF coordinate system:** X = part length (height for sides), Y = part width (depth for sides). Right side panels are mirrored on Y.

---

## API Reference

Auth via `Authorization: Bearer <token>` header or `?token=` query param.

### Authentication
| Method | Path | Auth | Body |
|--------|------|------|------|
| `POST` | `/api/auth/register` | No | `{email, username, password, firstName?, lastName?}` |
| `POST` | `/api/auth/login` | No | `{login, password}` |
| `GET` | `/api/auth/me` | Yes | — |

### Jobs
| Method | Path | Auth | Body/Params |
|--------|------|------|-------------|
| `GET` | `/api/jobs` | Yes | Filtered by role |
| `GET` | `/api/jobs/:id` | Yes | — |
| `POST` | `/api/jobs` | Yes | `{jobCode, jobName, description?}` |
| `PUT` | `/api/jobs/:id` | Yes | `{jobName?, status?, notes?, ...}` |
| `DELETE` | `/api/jobs/:id` | Yes | — |

### Cabinets
| Method | Path | Auth | Body/Params |
|--------|------|------|-------------|
| `GET` | `/api/cabinets/job/:jobId` | Yes | — |
| `GET` | `/api/cabinets/:id` | Yes | Full cabinet + parts + ops |
| `POST` | `/api/cabinets/job/:jobId` | Yes | `{cabinetCode, name?, cabinetType, config}` |
| `PUT` | `/api/cabinets/:id` | Yes | `{config?, name?, status?}` — regenerates parts |
| `DELETE` | `/api/cabinets/:id` | Yes | — |
| `POST` | `/api/cabinets/:id/duplicate` | Yes | `{cabinetCode?}` |
| `POST` | `/api/cabinets/:id/regenerate` | Yes | Force recompute from stored config |

### Export
| Method | Path | Auth | Query |
|--------|------|------|-------|
| `GET` | `/api/export/cabinet/:id/cutlist` | Yes | Text file download |
| `GET` | `/api/export/cabinet/:id/dxf` | Yes | `?thickness=18` |
| `GET` | `/api/export/cabinet/:id/dxf-info` | Yes | Returns `{thicknesses:[18,6]}` |
| `GET` | `/api/export/job/:jobId/dxf` | Yes | `?thickness=18&cabinets=1,3,5` |
| `GET` | `/api/export/job/:jobId/dxf-info` | Yes | `?cabinets=1,3` |

### Public (No Auth)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/door-styles` | All active door styles |
| `GET` | `/api/materials` | Material catalog |
| `GET` | `/api/hardware` | Hardware catalog |
| `GET` | `/api/health` | `{status:"ok",db:"connected"}` |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/users` | Admin | List all users |
| `PUT` | `/api/auth/users/:id/role` | Admin | `{role:"admin|manager|user"}` |
| `PUT` | `/api/auth/users/:id/active` | Admin | `{active:true|false}` |

---

## Database Schema

17 tables:

**Auth:** `users`, `refresh_tokens`
**Projects:** `clients`, `jobs`
**Catalogs:** `materials`, `edge_band_materials`, `door_styles`, `hardware_catalog`
**Cabinets:** `cabinets` (config as JSON), `cabinet_parts`, `part_edge_banding`
**Operations:** `dado_operations`, `drill_operations`
**Hardware:** `cabinet_hardware`
**Export:** `dxf_layer_configs`, `dxf_exports`
**Audit:** `audit_log`

Full DDL with constraints, indexes, and seed data in `db/schema.sql`.

---

## Computation Engine

`server/compute.js` exports a single pure function:

```javascript
computeCabinet(config) → { parts, dados, drills, caseH, intW, sideH }
```

- **parts[]** — `{code, name, partType, len, w, t, qty, notes, hasNotch?, mirror?}`
- **dados[]** — `{partCode, opType, cutW, cutD, cutLen, fromEdge, dist, depthStart, dxfX/Y/W/H, note}`
- **drills[]** — `{partCode, opType, dia, dep, heightStart, spacing, count, depthPositions[], note}`

The DXF export route calls this function live on each request — it never reads pre-generated parts from the DB for DXF output. This means updating `compute.js` immediately affects all future exports without needing to regenerate stored data.

---

## Development Workflow

```bash
# Dev servers
cd server && node --watch index.js    # Terminal 1
cd client && npm run dev              # Terminal 2

# After changing compute.js: rebuild client + regenerate DB parts
cd client && npm run build && cd ..
# Then use the regenerate script or hit POST /api/cabinets/:id/regenerate

# Deploy
pkill -f "node index.js"; sleep 1; systemctl restart cabinet-studio
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `EADDRINUSE: port 3001` | `pkill -f "node index.js"; sleep 1; systemctl restart cabinet-studio` |
| API curl hangs | Check `.env` DB credentials, must be in project root |
| Save fails | Check `journalctl -u cabinet-studio -n 30` for SQL errors |
| DXF shows old data | DXF is computed live; rebuild client for cut list preview |
| MariaDB auth fails | `ALTER USER 'cabinet'@'localhost' IDENTIFIED WITH mysql_native_password BY 'pass';` |
| Node can't find modules | Run from `server/` dir where `node_modules` lives |

---

## Roadmap

- [ ] Drawer box calculation (standard, dovetail, undermount slides)
- [ ] 3D WebGL preview (Three.js)
- [ ] Sheet goods nesting optimizer
- [ ] Cost estimation from catalogs
- [ ] PDF shop drawings
- [ ] Cabinet template library
- [ ] Face frame support
- [ ] Corner cabinet geometry
- [ ] G-code direct export
- [ ] Mobile-responsive shop tablet UI

---

## License

Proprietary. All rights reserved.

---

*Built with sawdust, frustration, and an unreasonable number of dado joints.*
