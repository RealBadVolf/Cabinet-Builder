-- ============================================================================
-- CABINET SHOP MANAGEMENT SYSTEM — MariaDB Schema v2
-- ============================================================================
-- All dimensions in MILLIMETERS (DECIMAL(10,2))
-- Deploy: mysql -u root -p < schema.sql
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS cabinet_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cabinet_studio;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 0: USERS & AUTH
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE users (
    user_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,                  -- bcrypt
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    role            ENUM('admin','manager','user') NOT NULL DEFAULT 'user',
    is_active       BOOLEAN DEFAULT TRUE,
    avatar_url      VARCHAR(500),
    last_login_at   DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE refresh_tokens (
    token_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    token_hash      VARCHAR(255) NOT NULL,                  -- SHA-256 of refresh token
    expires_at      DATETIME NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at      DATETIME,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed admin user (password: changeme123 — CHANGE THIS)
-- bcrypt hash of 'changeme123' with 12 rounds
INSERT INTO users (email, username, password_hash, first_name, role)
VALUES ('admin@badvolf.ru', 'admin',
        '$2b$12$LJ3m4ys4DzOHGS8GZSKzxOIqOvT.GpFONpnXvZQ8EBMhxHDVcW6Kq',
        'Admin', 'admin');


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 1: CLIENTS & JOBS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE clients (
    client_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED,                           -- owner
    company_name    VARCHAR(200),
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    address_line1   VARCHAR(255),
    address_line2   VARCHAR(255),
    city            VARCHAR(100),
    province_state  VARCHAR(100),
    postal_code     VARCHAR(20),
    country         VARCHAR(100) DEFAULT 'Canada',
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE jobs (
    job_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,                  -- owner
    job_code        VARCHAR(50) NOT NULL,                   -- "2026-042"
    client_id       INT UNSIGNED,
    job_name        VARCHAR(255) NOT NULL,
    description     TEXT,

    status          ENUM('quote','approved','in_progress','cnc_ready',
                         'cutting','assembly','finishing','installed',
                         'complete','cancelled')
                    DEFAULT 'quote',

    quote_date      DATE,
    approved_date   DATE,
    due_date        DATE,
    completed_date  DATE,

    material_cost   DECIMAL(12,2) DEFAULT 0,
    hardware_cost   DECIMAL(12,2) DEFAULT 0,
    labour_cost     DECIMAL(12,2) DEFAULT 0,
    markup_pct      DECIMAL(5,2)  DEFAULT 0,
    quoted_price    DECIMAL(12,2) DEFAULT 0,
    tax_rate        DECIMAL(5,2)  DEFAULT 0,

    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL,

    UNIQUE KEY uq_user_job_code (user_id, job_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 2: MATERIALS, EDGE BANDING, DOOR STYLES, HARDWARE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE materials (
    material_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    material_code   VARCHAR(50) UNIQUE,
    name            VARCHAR(255) NOT NULL,
    category        ENUM('sheet_good','solid_wood','mdf','melamine',
                         'particle_board','hdf','acrylic','metal','other')
                    NOT NULL,
    sheet_length    DECIMAL(10,2),
    sheet_width     DECIMAL(10,2),
    thickness       DECIMAL(10,2) NOT NULL,
    has_grain       BOOLEAN DEFAULT TRUE,
    grain_direction ENUM('length','width','none') DEFAULT 'length',
    cost_per_sheet  DECIMAL(10,2) DEFAULT 0,
    cost_per_sqm    DECIMAL(10,2) DEFAULT 0,
    vendor          VARCHAR(200),
    vendor_sku      VARCHAR(100),
    weight_per_sqm  DECIMAL(10,2),
    color           VARCHAR(100),
    finish          VARCHAR(100),
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE edge_band_materials (
    edge_band_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    material_type   ENUM('pvc','abs','veneer','solid_wood',
                         'acrylic','melamine','other') DEFAULT 'pvc',
    width           DECIMAL(10,2) NOT NULL,
    thickness       DECIMAL(10,2) NOT NULL,
    color           VARCHAR(100),
    color_match_material_id INT UNSIGNED,
    application     ENUM('iron_on','pre_glued','hot_melt','pressure_sensitive')
                    DEFAULT 'pre_glued',
    cost_per_meter  DECIMAL(10,4) DEFAULT 0,
    vendor          VARCHAR(200),
    vendor_sku      VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (color_match_material_id) REFERENCES materials(material_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE door_styles (
    door_style_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    style_code      VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    construction    ENUM('slab','rail_and_stile','board_and_batten',
                         'louvered','glass_frame','applied_moulding')
                    NOT NULL DEFAULT 'slab',
    rail_width      DECIMAL(10,2),
    stile_width     DECIMAL(10,2),
    top_rail_width  DECIMAL(10,2),
    bottom_rail_width DECIMAL(10,2),
    panel_type      ENUM('flat_recessed','flat_flush','raised','glass',
                         'beadboard','mullion','cathedral_arch','louver',
                         'board_batten','none')
                    DEFAULT 'flat_recessed',
    panel_material_separate BOOLEAN DEFAULT FALSE,
    panel_thickness DECIMAL(10,2),
    panel_raise_height DECIMAL(10,2),
    panel_tongue_depth DECIMAL(10,2) DEFAULT 10,
    panel_groove_width  DECIMAL(10,2),
    panel_groove_depth  DECIMAL(10,2) DEFAULT 10,
    panel_groove_offset DECIMAL(10,2),
    rs_joinery      ENUM('cope_and_stick','mortise_tenon','dowel',
                         'biscuit','pocket_screw','mitered','domino')
                    DEFAULT 'cope_and_stick',
    rs_tenon_length DECIMAL(10,2),
    mullion_count_h SMALLINT UNSIGNED DEFAULT 0,
    mullion_count_v SMALLINT UNSIGNED DEFAULT 0,
    mullion_width   DECIMAL(10,2),
    mullion_profile ENUM('flat','ogee','bead','none') DEFAULT 'none',
    inner_edge_profile  ENUM('square','ogee','bead','cove','chamfer','roundover','none') DEFAULT 'square',
    outer_edge_profile  ENUM('square','ogee','bead','cove','chamfer','roundover','none') DEFAULT 'square',
    profile_depth   DECIMAL(10,2),
    applied_moulding    BOOLEAN DEFAULT FALSE,
    moulding_profile    VARCHAR(100),
    moulding_inset      DECIMAL(10,2),
    louver_slat_width   DECIMAL(10,2),
    louver_slat_spacing DECIMAL(10,2),
    louver_slat_angle   DECIMAL(10,2),
    bead_spacing    DECIMAL(10,2),
    bead_width      DECIMAL(10,2),
    cost_adder      DECIMAL(10,2) DEFAULT 0,
    is_system       BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE hardware_catalog (
    hardware_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hardware_code   VARCHAR(50) UNIQUE,
    name            VARCHAR(255) NOT NULL,
    category        ENUM('hinge','drawer_slide','shelf_pin','cam_lock',
                         'confirmat','dowel','domino','biscuit',
                         'pull','knob','leg_leveler','hanging_bracket',
                         'toe_kick_clip','push_latch','soft_close_damper',
                         'drawer_box','lazy_susan','pullout','tray_divider',
                         'waste_bin','appliance_lift','other')
                    NOT NULL,
    hinge_type      ENUM('full_overlay','half_overlay','inset',
                         'bi_fold','blind_corner','pie_corner')
                    DEFAULT NULL,
    hinge_angle     SMALLINT UNSIGNED DEFAULT NULL,
    hinge_soft_close BOOLEAN DEFAULT NULL,
    hinge_bore_diameter DECIMAL(10,2) DEFAULT NULL,
    hinge_bore_depth    DECIMAL(10,2) DEFAULT NULL,
    hinge_bore_from_edge DECIMAL(10,2) DEFAULT NULL,
    hinge_cup_depth     DECIMAL(10,2) DEFAULT NULL,
    slide_type      ENUM('side_mount','undermount','center_mount')
                    DEFAULT NULL,
    slide_extension ENUM('three_quarter','full','over_travel')
                    DEFAULT NULL,
    slide_length    DECIMAL(10,2) DEFAULT NULL,
    slide_load_rating DECIMAL(10,2) DEFAULT NULL,
    slide_soft_close BOOLEAN DEFAULT NULL,
    slide_clearance  DECIMAL(10,2) DEFAULT NULL,
    pin_type        ENUM('spoon','cylindrical','locking','glass_shelf')
                    DEFAULT NULL,
    pin_diameter    DECIMAL(10,2) DEFAULT NULL,
    pin_hole_depth  DECIMAL(10,2) DEFAULT NULL,
    length          DECIMAL(10,2),
    width           DECIMAL(10,2),
    height          DECIMAL(10,2),
    weight          DECIMAL(10,2),
    cost_each       DECIMAL(10,4) DEFAULT 0,
    pack_qty        INT UNSIGNED DEFAULT 1,
    cost_per_pack   DECIMAL(10,4) DEFAULT 0,
    vendor          VARCHAR(200),
    vendor_sku      VARCHAR(100),
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 3: CABINETS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE cabinets (
    cabinet_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_id          INT UNSIGNED NOT NULL,
    cabinet_code    VARCHAR(50) NOT NULL,
    name            VARCHAR(255),

    cabinet_type    ENUM('base','wall','tall','vanity','drawer_base',
                         'sink_base','corner_base','corner_wall',
                         'appliance_garage','open_shelf','wine_rack',
                         'fridge_surround','oven_tower','pantry',
                         'island','peninsula','desk','other')
                    NOT NULL DEFAULT 'base',
    construction    ENUM('frameless','face_frame') NOT NULL DEFAULT 'frameless',

    height          DECIMAL(10,2) NOT NULL,
    width           DECIMAL(10,2) NOT NULL,
    depth           DECIMAL(10,2) NOT NULL,

    -- All construction params as JSON for flexibility
    -- Contains: materialThicknesses, dado/rabbet, toe kick, shelves,
    --           shelf pins, doors, drawers, nailers, hardware boring, etc.
    config          JSON NOT NULL,

    case_material_id      INT UNSIGNED,
    back_material_id      INT UNSIGNED,
    door_material_id      INT UNSIGNED,
    door_style_id         INT UNSIGNED,
    shelf_material_id     INT UNSIGNED,

    position_label  VARCHAR(100),
    position_x      DECIMAL(10,2) DEFAULT 0,
    position_y      DECIMAL(10,2) DEFAULT 0,
    position_z      DECIMAL(10,2) DEFAULT 0,
    rotation_deg    DECIMAL(10,2) DEFAULT 0,

    status          ENUM('draft','calculated','cnc_exported',
                         'cut','assembled','finished','installed')
                    DEFAULT 'draft',
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
    FOREIGN KEY (case_material_id) REFERENCES materials(material_id) ON DELETE SET NULL,
    FOREIGN KEY (back_material_id) REFERENCES materials(material_id) ON DELETE SET NULL,
    FOREIGN KEY (door_material_id) REFERENCES materials(material_id) ON DELETE SET NULL,
    FOREIGN KEY (door_style_id) REFERENCES door_styles(door_style_id) ON DELETE SET NULL,
    FOREIGN KEY (shelf_material_id) REFERENCES materials(material_id) ON DELETE SET NULL,

    UNIQUE KEY uq_job_cabinet_code (job_id, cabinet_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 4: PARTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE cabinet_parts (
    part_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cabinet_id      INT UNSIGNED NOT NULL,
    part_code       VARCHAR(50) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    part_type       ENUM('side_left','side_right','bottom','top',
                         'fixed_shelf','adjustable_shelf','nailer_front',
                         'nailer_rear','nailer_mid','back_panel',
                         'toe_kick','stretcher','filler','scribing_strip',
                         'door','drawer_front','drawer_side_left',
                         'drawer_side_right','drawer_back','drawer_bottom',
                         'partition','divider','light_rail','valance',
                         'countertop_buildup','rail','stile','center_panel',
                         'custom','other')
                    NOT NULL,
    material_id     INT UNSIGNED,
    finished_length DECIMAL(10,2) NOT NULL,
    finished_width  DECIMAL(10,2) NOT NULL,
    thickness       DECIMAL(10,2) NOT NULL,
    cut_length      DECIMAL(10,2),
    cut_width       DECIMAL(10,2),
    grain_direction ENUM('length','width','any') DEFAULT 'length',
    quantity        SMALLINT UNSIGNED DEFAULT 1,
    is_nested       BOOLEAN DEFAULT FALSE,
    is_cut          BOOLEAN DEFAULT FALSE,
    is_machined     BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (cabinet_id) REFERENCES cabinets(cabinet_id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE SET NULL,
    UNIQUE KEY uq_cabinet_part_code (cabinet_id, part_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE part_edge_banding (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    part_id         INT UNSIGNED NOT NULL,
    edge            ENUM('length1','length2','width1','width2') NOT NULL,
    edge_band_id    INT UNSIGNED NOT NULL,
    pre_applied     BOOLEAN DEFAULT FALSE,
    notes           VARCHAR(255),
    FOREIGN KEY (part_id) REFERENCES cabinet_parts(part_id) ON DELETE CASCADE,
    FOREIGN KEY (edge_band_id) REFERENCES edge_band_materials(edge_band_id) ON DELETE CASCADE,
    UNIQUE KEY uq_part_edge (part_id, edge)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 5: MACHINING OPERATIONS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE dado_operations (
    dado_op_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    part_id         INT UNSIGNED NOT NULL,
    operation_type  ENUM('dado','rabbet','groove','stopped_dado',
                         'stopped_rabbet','tongue','slot') NOT NULL,
    bit_diameter    DECIMAL(10,2),
    cut_width       DECIMAL(10,2) NOT NULL,
    cut_depth       DECIMAL(10,2) NOT NULL,
    cut_length      DECIMAL(10,2),
    from_reference_edge ENUM('top','bottom','left','right','front','rear') NOT NULL,
    distance_from_edge  DECIMAL(10,2) NOT NULL DEFAULT 0,
    orientation     ENUM('across_width','along_length','across_face','diagonal') NOT NULL,
    start_offset    DECIMAL(10,2) DEFAULT 0,
    stop_offset     DECIMAL(10,2) DEFAULT 0,
    receives_part_id INT UNSIGNED,
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES cabinet_parts(part_id) ON DELETE CASCADE,
    FOREIGN KEY (receives_part_id) REFERENCES cabinet_parts(part_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE drill_operations (
    drill_op_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    part_id         INT UNSIGNED NOT NULL,
    operation_type  ENUM('shelf_pin_line','hinge_bore','cam_lock',
                         'dowel','confirmat','system_hole',
                         'wire_grommet','custom') NOT NULL,
    hole_diameter   DECIMAL(10,2) NOT NULL,
    hole_depth      DECIMAL(10,2) NOT NULL,
    drill_face      ENUM('face','edge_length1','edge_length2',
                         'edge_width1','edge_width2') DEFAULT 'face',
    center_x        DECIMAL(10,2),
    center_y        DECIMAL(10,2),
    line_orientation ENUM('vertical','horizontal') DEFAULT 'vertical',
    line_start_x    DECIMAL(10,2),
    line_start_y    DECIMAL(10,2),
    hole_spacing    DECIMAL(10,2),
    hole_count      SMALLINT UNSIGNED,
    repeat_count    SMALLINT UNSIGNED DEFAULT 1,
    repeat_offset   DECIMAL(10,2),
    from_reference_edge ENUM('top','bottom','left','right','front','rear'),
    hardware_id     INT UNSIGNED,
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES cabinet_parts(part_id) ON DELETE CASCADE,
    FOREIGN KEY (hardware_id) REFERENCES hardware_catalog(hardware_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 6: HARDWARE ASSIGNMENTS & DXF EXPORTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE cabinet_hardware (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cabinet_id      INT UNSIGNED NOT NULL,
    hardware_id     INT UNSIGNED NOT NULL,
    quantity        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    location        VARCHAR(255),
    notes           VARCHAR(255),
    FOREIGN KEY (cabinet_id) REFERENCES cabinets(cabinet_id) ON DELETE CASCADE,
    FOREIGN KEY (hardware_id) REFERENCES hardware_catalog(hardware_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dxf_layer_configs (
    layer_config_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_name         VARCHAR(100) NOT NULL,
    is_default          BOOLEAN DEFAULT FALSE,
    layer_profile_cut   VARCHAR(100) DEFAULT 'Profile_Cut',
    layer_dado          VARCHAR(100) DEFAULT 'Dado',
    layer_rabbet        VARCHAR(100) DEFAULT 'Rabbet',
    layer_groove        VARCHAR(100) DEFAULT 'Groove',
    layer_pocket        VARCHAR(100) DEFAULT 'Pocket',
    layer_drill         VARCHAR(100) DEFAULT 'Drill',
    layer_hinge_bore    VARCHAR(100) DEFAULT 'Hinge_Bore',
    layer_shelf_pins    VARCHAR(100) DEFAULT 'Shelf_Pins',
    layer_cam_lock      VARCHAR(100) DEFAULT 'Cam_Lock',
    layer_engrave       VARCHAR(100) DEFAULT 'Engrave',
    layer_label         VARCHAR(100) DEFAULT 'Label',
    layer_reference     VARCHAR(100) DEFAULT 'Reference',
    notes               TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dxf_exports (
    export_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_id          INT UNSIGNED,
    cabinet_id      INT UNSIGNED,
    part_id         INT UNSIGNED,
    filename        VARCHAR(500) NOT NULL,
    file_path       VARCHAR(1000),
    file_hash       CHAR(64),
    export_scope    ENUM('single_part','cabinet','job','nested_sheet') NOT NULL,
    layer_config_id INT UNSIGNED,
    sheet_material_id INT UNSIGNED,
    sheet_index     SMALLINT UNSIGNED,
    utilization_pct DECIMAL(5,2),
    exported_by     INT UNSIGNED,
    exported_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE SET NULL,
    FOREIGN KEY (cabinet_id) REFERENCES cabinets(cabinet_id) ON DELETE SET NULL,
    FOREIGN KEY (part_id) REFERENCES cabinet_parts(part_id) ON DELETE SET NULL,
    FOREIGN KEY (exported_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (sheet_material_id) REFERENCES materials(material_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 7: AUDIT LOG
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
    log_id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED,
    table_name      VARCHAR(100) NOT NULL,
    record_id       INT UNSIGNED NOT NULL,
    action          ENUM('insert','update','delete') NOT NULL,
    old_values      JSON,
    new_values      JSON,
    changed_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 8: VIEWS
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_job_cut_list AS
SELECT j.job_id, j.job_code, j.job_name, j.user_id,
    c.cabinet_id, c.cabinet_code, c.name AS cabinet_name, c.cabinet_type,
    p.part_id, p.part_code, p.name AS part_name, p.part_type,
    p.quantity, p.finished_length, p.finished_width, p.thickness,
    p.grain_direction, m.name AS material_name, p.is_cut, p.is_machined
FROM jobs j
JOIN cabinets c ON c.job_id = j.job_id
JOIN cabinet_parts p ON p.cabinet_id = c.cabinet_id
LEFT JOIN materials m ON m.material_id = p.material_id
ORDER BY j.job_code, c.cabinet_code, p.part_type;

CREATE OR REPLACE VIEW v_job_hardware_list AS
SELECT j.job_code, j.job_name, j.user_id,
    h.category, h.name AS hardware_name, h.hardware_code,
    SUM(ch.quantity) AS total_qty, h.cost_each,
    SUM(ch.quantity) * h.cost_each AS total_cost, h.vendor
FROM cabinet_hardware ch
JOIN cabinets c ON c.cabinet_id = ch.cabinet_id
JOIN jobs j ON j.job_id = c.job_id
JOIN hardware_catalog h ON h.hardware_id = ch.hardware_id
GROUP BY j.job_code, j.job_name, j.user_id, h.hardware_id
ORDER BY j.job_code, h.category;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 9: SEED DATA
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO dxf_layer_configs (config_name, is_default, notes)
VALUES ('Vectric Aspire Default', TRUE, 'Standard Aspire layer naming');

INSERT INTO hardware_catalog (hardware_code, name, category, pin_type, pin_diameter, pin_hole_depth, cost_each)
VALUES ('SHELF-PIN-5MM', '5mm Shelf Pin (Spoon)', 'shelf_pin', 'spoon', 5, 12, 0.15);

INSERT INTO hardware_catalog (hardware_code, name, category, hinge_type, hinge_angle, hinge_soft_close,
    hinge_bore_diameter, hinge_bore_depth, hinge_bore_from_edge, cost_each)
VALUES ('BLUM-71B3550', 'Blum 110° Clip Top SC', 'hinge', 'full_overlay', 110, TRUE, 35, 13, 22, 4.50);

INSERT INTO materials (material_code, name, category, sheet_length, sheet_width, thickness,
    has_grain, grain_direction, cost_per_sheet) VALUES
('PLY-BBIRCH-18', '18mm Baltic Birch', 'sheet_good', 2440, 1220, 18, TRUE, 'length', 85.00),
('PLY-BBIRCH-12', '12mm Baltic Birch', 'sheet_good', 2440, 1220, 12, TRUE, 'length', 65.00),
('PLY-BBIRCH-6',  '6mm Baltic Birch',  'sheet_good', 2440, 1220, 6,  TRUE, 'length', 35.00),
('MEL-WHITE-18',  '18mm White Melamine','melamine',   2440, 1220, 18, FALSE,'none', 45.00),
('MDF-18',        '18mm MDF',          'mdf',        2440, 1220, 18, FALSE,'none', 38.00),
('HDF-3',         '3mm HDF',           'hdf',        2440, 1220, 3,  FALSE,'none', 12.00);

INSERT INTO door_styles (style_code, name, description, construction, rail_width, stile_width,
    panel_type, rs_joinery, inner_edge_profile, is_system) VALUES
('slab',          'Slab',            'Flat panel, clean modern look.',          'slab', NULL, NULL, 'none', 'cope_and_stick', 'none', TRUE),
('shaker',        'Shaker',          'Recessed flat panel, square frame.',      'rail_and_stile', 65, 65, 'flat_recessed', 'cope_and_stick', 'square', TRUE),
('raised_panel',  'Raised Panel',    'Beveled raised center, traditional.',     'rail_and_stile', 70, 70, 'raised', 'cope_and_stick', 'ogee', TRUE),
('flat_panel_rs', 'Flat Panel R&S',  'Rail & stile, flush flat panel.',         'rail_and_stile', 60, 60, 'flat_flush', 'cope_and_stick', 'square', TRUE),
('glass_front',   'Glass Front',     'Rail & stile with glass insert.',         'glass_frame', 55, 55, 'glass', 'cope_and_stick', 'ogee', TRUE),
('cathedral',     'Cathedral Arch',  'Arched top rail, raised panel.',          'rail_and_stile', 75, 65, 'cathedral_arch', 'cope_and_stick', 'ogee', TRUE),
('beadboard',     'Beadboard',       'Vertical beaded planks in frame.',        'rail_and_stile', 55, 55, 'beadboard', 'cope_and_stick', 'square', TRUE),
('mullion',       'Mullion Glass',   'Divided glass panes in frame.',           'glass_frame', 55, 55, 'mullion', 'cope_and_stick', 'ogee', TRUE),
('louvered',      'Louvered',        'Angled horizontal slats in frame.',       'louvered', 60, 60, 'louver', 'mortise_tenon', 'square', TRUE),
('board_batten',  'Board & Batten',  'Vertical boards with battens.',           'board_and_batten', NULL, NULL, 'board_batten', 'cope_and_stick', 'none', TRUE);

SET FOREIGN_KEY_CHECKS = 1;
