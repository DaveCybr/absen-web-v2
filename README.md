# Aplikasi Absensi

Sistem manajemen kehadiran karyawan dengan Face Recognition dan GPS Validation.

## Tech Stack

### Backend & Database
- **Supabase** - PostgreSQL, Auth, Storage, Realtime

### Web Admin
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Tanstack Query** - Data fetching

### Mobile (Employee)
- **Flutter** - Cross-platform mobile
- **Face++ API** - Face recognition
- **Geolocator** - GPS location

## Features

### ✅ Core Features
- [x] Face Recognition Check-in/Check-out (Face++ API)
- [x] GPS Location Validation
- [x] Leave/Permission Management (Cuti/Izin)
- [x] Role-based Access (Admin/Employee)

### 📊 Admin Panel
- [ ] Dashboard Overview
- [ ] Employee Management (CRUD)
- [ ] Attendance Reports
- [ ] Leave Request Approval
- [ ] Office Settings (GPS, Hours)

### 📱 Mobile App
- [ ] Face Enrollment
- [ ] Check-in with Face + GPS
- [ ] Check-out with Face + GPS
- [ ] Attendance History
- [ ] Leave Request Submission

## Project Structure

```
absensi-app/
├── database/
│   └── 001_initial_schema.sql    # Supabase migration
│
├── web-admin/                     # Next.js Admin Panel
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/           # Login pages
│   │   │   ├── (dashboard)/      # Admin dashboard
│   │   │   └── api/              # API routes
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   └── package.json
│
└── mobile-app/                    # Flutter Employee App
    ├── lib/
    │   ├── config/
    │   ├── models/
    │   ├── providers/
    │   ├── screens/
    │   ├── services/
    │   └── widgets/
    └── pubspec.yaml
```

## Development Phases

### Phase 1: Foundation ✅
- [x] Database schema design
- [x] Project structure setup

### Phase 2: Web Admin
- [ ] Authentication (Supabase Auth)
- [ ] Employee management
- [ ] Office settings
- [ ] Dashboard

### Phase 3: Mobile App
- [ ] Authentication
- [ ] Face enrollment (Face++ API)
- [ ] Check-in/Check-out flow
- [ ] GPS validation

### Phase 4: Advanced Features
- [ ] Leave management
- [ ] Reports & Export
- [ ] Notifications

## Environment Variables

### Web Admin (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Face++ API
FACEPP_API_KEY=your_facepp_api_key
FACEPP_API_SECRET=your_facepp_api_secret
```

### Mobile App
```dart
// lib/config/env.dart
const supabaseUrl = 'your_supabase_url';
const supabaseAnonKey = 'your_anon_key';
const faceppApiKey = 'your_facepp_api_key';
const faceppApiSecret = 'your_facepp_api_secret';
```

## Getting Started

### 1. Setup Database
1. Create new Supabase project
2. Run `database/001_initial_schema.sql` in SQL Editor
3. Enable Row Level Security

### 2. Setup Web Admin
```bash
cd web-admin
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
npm run dev
```

### 3. Setup Mobile App
```bash
cd mobile-app
flutter pub get
# Configure lib/config/env.dart
flutter run
```

## API Endpoints

### Attendance
- `POST /api/attendance/check-in` - Check in with face + location
- `POST /api/attendance/check-out` - Check out with face + location
- `GET /api/attendance/today` - Get today's attendance
- `GET /api/attendance/history` - Get attendance history

### Employees
- `GET /api/employees` - List all employees (admin)
- `POST /api/employees` - Create employee (admin)
- `PUT /api/employees/:id` - Update employee (admin)
- `DELETE /api/employees/:id` - Delete employee (admin)

### Leave
- `GET /api/leave/types` - Get leave types
- `GET /api/leave/balance` - Get leave balance
- `POST /api/leave/request` - Submit leave request
- `PUT /api/leave/request/:id/approve` - Approve request (admin)
- `PUT /api/leave/request/:id/reject` - Reject request (admin)

## License

MIT License - PT Nano Indonesia Sakti
"# absen-web-v2" 
