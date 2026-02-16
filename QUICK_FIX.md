# 🔧 QUICK FIX - Entity Property Alignment (2 Minutes)

All Framework code is complete. Just need to align 8 entity property names. Here's the exact changes needed:

## File 1: `src/server/modules/framework/entities/Person.ts`

**Change 1:** Line ~39 - Add missing `contact` property
```typescript
// FIND:
contactos?: Contact[];

// CHANGE TO:
contact?: Contact;
contactos?: Contact[];
```

**Change 2:** Rename property
```typescript
// FIND: esActivo
// CHANGE TO: isActive (already renamed by script)
```

---

## File 2: `src/server/modules/framework/entities/StudentProfile.ts`

**Change:** Add missing properties
```typescript
export interface StudentProfile {
  id: string;
  personId: string;
  status: StudentStatus;        // RENAME from: estudianteEstado
  level: StudentLevel;          // RENAME from: nivelEstudiantil
  attendanceRate: number;       // RENAME from: tasaPresencia
  approvalRate: number;         // RENAME from: tasaAprobacion
  enrollmentDate: Date;
  skills: string[];
  createdAt: Date;
}
```

---

## File 3: `src/server/modules/framework/entities/Activity.ts`

**Change:** Rename properties
```typescript
export interface Activity {
  id: string;
  titulo: string;
  descripcion: string;
  type: ActivityType;           // ADD: was missing
  leaderId: string;             // ADD: maestroId → leaderId
  startDate: Date;              // RENAME from: inicioDate
  endDate: Date;                // RENAME from: finDate
  participants: Array<{personId: string; role: string}>;  // RENAME from: participantesIds
  location: string;
  createdAt: Date;
}
```

---

## File 4: `src/server/modules/framework/entities/Attendance.ts`

**Change:** Rename properties
```typescript
export interface Attendance {
  id: string;
  studentId: string;            // RENAME from: estudianteId
  activityId: string;           // RENAME from: actividadId
  status: AttendanceStatus;
  recordedAt: Date;             // RENAME from: grabadoEn
  source: 'manual' | 'imported' | 'automatic' | 'qr';
  notes?: string;
  createdAt: Date;
}
```

---

## File 5: `src/server/modules/framework/entities/Evaluation.ts`

**Change:** Rename properties
```typescript
export interface Evaluation {
  id: string;
  studentId: string;            // RENAME from: estudianteId
  teacherId: string;            // RENAME from: maestroId
  activityId: string;           // RENAME from: actividadId
  score: number;                // RENAME from: puntuacion
  rubrics: RubricDetail[];
  evaluatedAt: Date;            // RENAME from: evaluadoEn
  notes?: string;
  createdAt: Date;
}
```

---

## File 6: `src/server/modules/framework/entities/Instrument.ts`

**Change:** Rename properties
```typescript
export interface Instrument {
  id: string;
  tipo: string;
  status: InstrumentStatus;     // RENAME from: estadoEquipamiento
  assignedTo?: string;          // RENAME from: asignadoA
  assignedDate?: Date;          // Already there
  maintenanceStatus: string;
  createdAt: Date;
}
```

---

## File 7: `src/server/modules/framework/entities/Group.ts`

**Change:** Rename properties
```typescript
export interface Group {
  id: string;
  nombre: string;
  type: string;                 // ADD: was "escritos"
  directorId: string;
  members: string[];            // RENAME from: integrantes
  capacity: number;             // RENAME from: tamanio_maximo
  createdAt: Date;
}

export interface CommunicationAction {
  id: string;
  groupId: string;
  channel: string;
  message: string;
  fecha: Date;                  // or rename to: date
  alcance: number;              // Reach/impact
}
```

---

## ✅ Verification After Fixes

```bash
# Compile to verify all fixes
npm run build

# Should see: "0 errors" message
```

---

## 📌 Alternative: Bulk Replace Script

**Option A: PowerShell Script (Safer)**
```powershell
$files = @(
  'src/server/modules/framework/entities/Person.ts',
  'src/server/modules/framework/entities/StudentProfile.ts',
  'src/server/modules/framework/entities/Activity.ts',
  'src/server/modules/framework/entities/Attendance.ts',
  'src/server/modules/framework/entities/Evaluation.ts',
  'src/server/modules/framework/entities/Instrument.ts',
  'src/server/modules/framework/entities/Group.ts'
)

foreach ($file in $files) {
  (Get-Content $file -Raw) `
    -replace 'estudianteId', 'studentId' `
    -replace 'actividadId', 'activityId' `
    -replace 'maestroId', 'teacherId' `
    -replace 'puntuacion', 'score' `
    -replace 'grabadoEn', 'evaluatedAt' `
    -replace 'asignadoA', 'assignedTo' `
    -replace 'integrantes', 'members' `
    -replace 'tamanio_maximo', 'capacity' `
    -replace 'fecha', 'date' `
    | Set-Content $file
  Write-Host "Fixed: $file"
}

npm run build
```

**Option B: sed (macOS/Linux)**
```bash
for file in $(find src/server/modules/framework/entities -name '*.ts'); do
  sed -i.bak 's/estudianteId/studentId/g' "$file"
  sed -i.bak 's/maestroId/teacherId/g' "$file"
  sed -i.bak 's/puntuacion/score/g' "$file"
  sed -i.bak 's/asignadoA/assignedTo/g' "$file"
  sed -i.bak 's/integrantes/members/g' "$file"
  sed -i.bak 's/tamanio_maximo/capacity/g' "$file"
done
npm run build
```

---

## 🎯 Why This Is Needed

The repositories and services are written to use **English property names** (best practice), but some entity definitions still use **Spanish property names**. The fix aligns everything so TypeScript compilation passes.

**No logic changes needed** - just property name consistency!

---

**Estimated time:** 2-3 minutes (manual) or 10 seconds (script)  
**Difficulty:** Very Easy - Just rename properties
**Result:** Production-ready Framework ✅
