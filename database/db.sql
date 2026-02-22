buatkan aplikasi absensi sesuai database ini

-- =====================================================

-- APLIKASI ABSENSI - FULL DATABASE SCHEMA

-- Database: PostgreSQL (Supabase)

-- Version: 1.0.0

-- =====================================================

-- Enable extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================

-- 1. EMPLOYEES TABLE

-- =====================================================

CREATE TABLE employees (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    

    -- Basic Info

    name VARCHAR(255) NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,

    phone VARCHAR(20),

    

    -- Organization

    department VARCHAR(100),

    position VARCHAR(100),

    

    -- Face Recognition (Face++ API)

    face_token VARCHAR(255),           -- Face++ face_token

    face_image_url TEXT,               -- URL foto wajah tersimpan

    

    -- Status

    is_active BOOLEAN DEFAULT true,

    role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),

    

    -- Timestamps

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()

);

-- Indexes

CREATE INDEX idx_employees_user_id ON employees(user_id);

CREATE INDEX idx_employees_email ON employees(email);

CREATE INDEX idx_employees_department ON employees(department);

CREATE INDEX idx_employees_is_active ON employees(is_active);

CREATE INDEX idx_employees_role ON employees(role);

-- =====================================================

-- 2. OFFICE SETTINGS TABLE

-- =====================================================

CREATE TABLE office_settings (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    

    -- Office Info

    office_name VARCHAR(255) DEFAULT 'Kantor',

    office_address TEXT,

    

    -- GPS Location

    latitude DECIMAL(10, 8) NOT NULL,

    longitude DECIMAL(11, 8) NOT NULL,

    radius_meters INTEGER DEFAULT 100,        -- Radius area absen dalam meter

    

    -- Working Hours (default)

    default_check_in TIME DEFAULT '08:00:00',

    default_check_out TIME DEFAULT '17:00:00',

    late_tolerance_minutes INTEGER DEFAULT 15,

    

    -- Face Recognition Settings

    face_similarity_threshold DECIMAL(3, 2) DEFAULT 0.80,  -- 80% similarity

    

    -- Timestamps

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()

);

-- =====================================================

-- 3. ATTENDANCES TABLE (Unified - NO SPLIT!)

-- =====================================================

CREATE TABLE attendances (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    

    -- Date (untuk query per hari)

    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,

    

    -- Check In

    check_in_time TIMESTAMPTZ,

    check_in_latitude DECIMAL(10, 8),

    check_in_longitude DECIMAL(11, 8),

    check_in_photo_url TEXT,

    check_in_face_verified BOOLEAN DEFAULT false,

    check_in_location_verified BOOLEAN DEFAULT false,

    

    -- Check Out

    check_out_time TIMESTAMPTZ,

    check_out_latitude DECIMAL(10, 8),

    check_out_longitude DECIMAL(11, 8),

    check_out_photo_url TEXT,

    check_out_face_verified BOOLEAN DEFAULT false,

    check_out_location_verified BOOLEAN DEFAULT false,

    

    -- Calculated Fields

    late_minutes INTEGER DEFAULT 0,

    early_leave_minutes INTEGER DEFAULT 0,

    work_duration_minutes INTEGER,            -- Dihitung saat check-out

    

    -- Status

    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'leave', 'half_day')),

    notes TEXT,

    

    -- Timestamps

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    

    -- Constraint: 1 attendance per employee per day

    UNIQUE(employee_id, attendance_date)

);

-- Indexes

CREATE INDEX idx_attendances_employee_id ON attendances(employee_id);

CREATE INDEX idx_attendances_date ON attendances(attendance_date);

CREATE INDEX idx_attendances_status ON attendances(status);

CREATE INDEX idx_attendances_employee_date ON attendances(employee_id, attendance_date);

-- =====================================================

-- 4. LEAVE TYPES TABLE

-- =====================================================

CREATE TABLE leave_types (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    

    name VARCHAR(100) NOT NULL,               -- "Cuti Tahunan", "Sakit", "Izin"

    code VARCHAR(20) UNIQUE NOT NULL,         -- "ANNUAL", "SICK", "PERMIT"

    description TEXT,

    

    -- Quota

    default_quota INTEGER DEFAULT 0,          -- Kuota default per tahun

    is_paid BOOLEAN DEFAULT true,             -- Apakah dibayar

    requires_attachment BOOLEAN DEFAULT false, -- Perlu lampiran (surat dokter, dll)

    

    -- Status

    is_active BOOLEAN DEFAULT true,

    

    -- Timestamps

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()

);

-- Default leave types

INSERT INTO leave_types (name, code, description, default_quota, is_paid, requires_attachment) VALUES

('Cuti Tahunan', 'ANNUAL', 'Cuti tahunan karyawan', 12, true, false),

('Sakit', 'SICK', 'Izin sakit dengan atau tanpa surat dokter', 12, true, true),

('Izin', 'PERMIT', 'Izin keperluan pribadi', 6, false, false),

('Cuti Melahirkan', 'MATERNITY', 'Cuti melahirkan untuk karyawan wanita', 90, true, true),

('Cuti Menikah', 'MARRIAGE', 'Cuti untuk pernikahan', 3, true, true);

-- =====================================================

-- 5. LEAVE BALANCES TABLE

-- =====================================================

CREATE TABLE leave_balances (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,

    

    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

    

    -- Quota

    quota INTEGER DEFAULT 0,                  -- Total kuota

    used INTEGER DEFAULT 0,                   -- Sudah dipakai

    remaining INTEGER GENERATED ALWAYS AS (quota - used) STORED,

    

    -- Timestamps

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    

    -- Constraint: 1 balance per employee per leave type per year

    UNIQUE(employee_id, leave_type_id, year)

);

-- Indexes

CREATE INDEX idx_leave_balances_employee ON leave_balances(employee_id);

CREATE INDEX idx_leave_balances_year ON leave_balances(year);

-- =====================================================

-- 6. LEAVE REQUESTS TABLE

-- =====================================================

CREATE TABLE leave_requests (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,

    

    -- Date Range

    start_date DATE NOT NULL,

    end_date DATE NOT NULL,

    total_days INTEGER NOT NULL,

    

    -- Request Details

    reason TEXT,

    attachment_url TEXT,                      -- Lampiran (surat dokter, dll)

    

    -- Approval

    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

    approved_by UUID REFERENCES employees(id),

    approved_at TIMESTAMPTZ,

    rejection_reason TEXT,

    

    -- Timestamps

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    

    -- Constraint: end_date >= start_date

    CHECK (end_date >= start_date)

);

-- Indexes

CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);

CREATE INDEX idx_leave_requests_status ON leave_requests(status);

CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- =====================================================

-- 7. FUNCTIONS & TRIGGERS

-- =====================================================

-- Auto-update updated_at timestamp

CREATE OR REPLACE FUNCTION update_updated_at()

RETURNS TRIGGER AS $$

BEGIN

    NEW.updated_at = NOW();

    RETURN NEW;

END;

$$ LANGUAGE plpgsql;

-- Apply trigger to all tables

CREATE TRIGGER tr_employees_updated_at

    BEFORE UPDATE ON employees

    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_office_settings_updated_at

    BEFORE UPDATE ON office_settings

    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_attendances_updated_at

    BEFORE UPDATE ON attendances

    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_leave_types_updated_at

    BEFORE UPDATE ON leave_types

    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_leave_balances_updated_at

    BEFORE UPDATE ON leave_balances

    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_leave_requests_updated_at

    BEFORE UPDATE ON leave_requests

    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function: Calculate work duration on check-out

CREATE OR REPLACE FUNCTION calculate_work_duration()

RETURNS TRIGGER AS $$

BEGIN

    IF NEW.check_out_time IS NOT NULL AND NEW.check_in_time IS NOT NULL THEN

        NEW.work_duration_minutes = EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 60;

    END IF;

    RETURN NEW;

END;

$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calculate_work_duration

    BEFORE UPDATE ON attendances

    FOR EACH ROW

    WHEN (NEW.check_out_time IS DISTINCT FROM OLD.check_out_time)

    EXECUTE FUNCTION calculate_work_duration();

-- Function: Initialize leave balances for new employee

CREATE OR REPLACE FUNCTION init_leave_balances()

RETURNS TRIGGER AS $$

BEGIN

    INSERT INTO leave_balances (employee_id, leave_type_id, year, quota)

    SELECT 

        NEW.id,

        lt.id,

        EXTRACT(YEAR FROM CURRENT_DATE),

        lt.default_quota

    FROM leave_types lt

    WHERE lt.is_active = true;

    

    RETURN NEW;

END;

$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_init_leave_balances

    AFTER INSERT ON employees

    FOR EACH ROW EXECUTE FUNCTION init_leave_balances();

-- Function: Update leave balance on request approval

CREATE OR REPLACE FUNCTION update_leave_balance_on_approval()

RETURNS TRIGGER AS $$

BEGIN

    -- When status changes to approved

    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN

        UPDATE leave_balances

        SET used = used + NEW.total_days

        WHERE employee_id = NEW.employee_id

          AND leave_type_id = NEW.leave_type_id

          AND year = EXTRACT(YEAR FROM NEW.start_date);

    END IF;

    

    -- When approved request is cancelled

    IF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN

        UPDATE leave_balances

        SET used = used - OLD.total_days

        WHERE employee_id = OLD.employee_id

          AND leave_type_id = OLD.leave_type_id

          AND year = EXTRACT(YEAR FROM OLD.start_date);

    END IF;

    

    RETURN NEW;

END;

$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_leave_balance

    AFTER UPDATE ON leave_requests

    FOR EACH ROW EXECUTE FUNCTION update_leave_balance_on_approval();

-- =====================================================

-- 8. ROW LEVEL SECURITY (RLS)

-- =====================================================

-- Enable RLS

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- Employees policies

CREATE POLICY "Users can view own employee data"

    ON employees FOR SELECT

    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all employees"

    ON employees FOR SELECT

    USING (

        EXISTS (

            SELECT 1 FROM employees e 

            WHERE e.user_id = auth.uid() AND e.role = 'admin'

        )

    );

CREATE POLICY "Admins can manage employees"

    ON employees FOR ALL

    USING (

        EXISTS (

            SELECT 1 FROM employees e 

            WHERE e.user_id = auth.uid() AND e.role = 'admin'

        )

    );

-- Attendances policies

CREATE POLICY "Users can view own attendances"

    ON attendances FOR SELECT

    USING (

        employee_id IN (

            SELECT id FROM employees WHERE user_id = auth.uid()

        )

    );

CREATE POLICY "Users can insert own attendances"

    ON attendances FOR INSERT

    WITH CHECK (

        employee_id IN (

            SELECT id FROM employees WHERE user_id = auth.uid()

        )

    );

CREATE POLICY "Users can update own attendances"

    ON attendances FOR UPDATE

    USING (

        employee_id IN (

            SELECT id FROM employees WHERE user_id = auth.uid()

        )

    );

CREATE POLICY "Admins can manage all attendances"

    ON attendances FOR ALL

    USING (

        EXISTS (

            SELECT 1 FROM employees e 

            WHERE e.user_id = auth.uid() AND e.role = 'admin'

        )

    );

-- Leave requests policies

CREATE POLICY "Users can view own leave requests"

    ON leave_requests FOR SELECT

    USING (

        employee_id IN (

            SELECT id FROM employees WHERE user_id = auth.uid()

        )

    );

CREATE POLICY "Users can create own leave requests"

    ON leave_requests FOR INSERT

    WITH CHECK (

        employee_id IN (

            SELECT id FROM employees WHERE user_id = auth.uid()

        )

    );

CREATE POLICY "Admins can manage all leave requests"

    ON leave_requests FOR ALL

    USING (

        EXISTS (

            SELECT 1 FROM employees e 

            WHERE e.user_id = auth.uid() AND e.role = 'admin'

        )

    );

-- Leave balances policies

CREATE POLICY "Users can view own leave balances"

    ON leave_balances FOR SELECT

    USING (

        employee_id IN (

            SELECT id FROM employees WHERE user_id = auth.uid()

        )

    );

CREATE POLICY "Admins can manage all leave balances"

    ON leave_balances FOR ALL

    USING (

        EXISTS (

            SELECT 1 FROM employees e 

            WHERE e.user_id = auth.uid() AND e.role = 'admin'

        )

    );

-- =====================================================

-- 9. INITIAL OFFICE SETTINGS

-- =====================================================

-- Insert default office settings (update with your actual coordinates)

INSERT INTO office_settings (

    office_name,

    office_address,

    latitude,

    longitude,

    radius_meters,

    default_check_in,

    default_check_out,

    late_tolerance_minutes,

    face_similarity_threshold

) VALUES (

    'PT Nano Indonesia Sakti',

    'Jember, East Java, Indonesia',

    -8.1845,           -- Latitude Jember (update sesuai lokasi)

    113.6681,          -- Longitude Jember (update sesuai lokasi)

    100,               -- 100 meter radius

    '08:00:00',

    '17:00:00',

    15,

    0.80

);