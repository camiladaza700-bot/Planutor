const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Cuentas mínimas para poder probar la aplicación por primera vez en desarrollo.
const ADMIN_SEMILLA = {
  nombre: 'Administrador PLANUTOR',
  correo: 'admin@planutor.edu',
  passwordHash: 'planutor-admin-demo-2026:bbb81b23a46e4fff4767834c59d4f2f1d84232cfa54ceeffe2f75f3cc8569c69903d00fff4089e9d3782f76728f8543f03edc5ded88e03a9be70704fb2d81c7e'
};

const PROFESOR_SEMILLA = {
  nombre: 'Profesor Demo',
  correo: 'profesor@planutor.edu',
  passwordHash: 'planutor-profe-demo-2026:d5761c61a66d411a0a74a7925ed07a475cc283a2f58ae14947d5cfa3a9bebac93675335f665fc80c306ec1042657819371336f98b972a7fec14947eb9f110878',
  grado: '5',
  grupo: 'General'
};

// La base SQLite se guarda fuera del código para que los datos persistan entre reinicios.
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'planutor.sqlite');

fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath, (error) => {
  if (error) {
    console.error('Error al abrir SQLite:', error.message);
    return;
  }

  console.log(`SQLite listo en ${dbPath}`);
});

// Las funciones de esquema centralizan la estructura inicial de las tablas.
function createUsuariosTable(nombreTabla = 'usuarios') {
  return `
    CREATE TABLE IF NOT EXISTS ${nombreTabla} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('estudiante', 'profesor', 'administrador')),
      nivel TEXT,
      grado TEXT,
      grupo TEXT,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

function createTareasTable(nombreTabla = 'tareas') {
  return `
    CREATE TABLE IF NOT EXISTS ${nombreTabla} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profesor_id INTEGER NOT NULL,
      grado TEXT NOT NULL,
      grupo TEXT NOT NULL,
      materia TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      fecha_entrega TEXT NOT NULL,
      semana_inicio TEXT NOT NULL,
      semana_fin TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profesor_id) REFERENCES usuarios(id)
    )
  `;
}

function seedData() {
  // Las credenciales de demostración solo se restablecen fuera de producción.
  if (process.env.NODE_ENV !== 'production') {
    db.run(
      'UPDATE usuarios SET password_hash = ? WHERE correo = ?',
      [ADMIN_SEMILLA.passwordHash, ADMIN_SEMILLA.correo]
    );
    db.run(
      'UPDATE usuarios SET password_hash = ? WHERE correo = ?',
      [PROFESOR_SEMILLA.passwordHash, PROFESOR_SEMILLA.correo]
    );
  }

  // INSERT OR IGNORE permite ejecutar la inicialización varias veces sin duplicar usuarios.
  db.run(
    `
      UPDATE usuarios
      SET rol = 'administrador'
      WHERE correo = ?
    `,
    [ADMIN_SEMILLA.correo]
  );

  db.run(
    `
      INSERT OR IGNORE INTO usuarios (
        nombre,
        correo,
        password_hash,
        rol
      )
      VALUES (?, ?, ?, 'administrador')
    `,
    [
      ADMIN_SEMILLA.nombre,
      ADMIN_SEMILLA.correo,
      ADMIN_SEMILLA.passwordHash
    ]
  );

  db.run(
    `
      INSERT OR IGNORE INTO usuarios (
        nombre,
        correo,
        password_hash,
        rol,
        grado,
        grupo
      )
      VALUES (?, ?, ?, 'profesor', ?, ?)
    `,
    [
      PROFESOR_SEMILLA.nombre,
      PROFESOR_SEMILLA.correo,
      PROFESOR_SEMILLA.passwordHash,
      PROFESOR_SEMILLA.grado,
      PROFESOR_SEMILLA.grupo
    ]
  );

  db.run(
    `
      UPDATE usuarios
      SET grado = ?, grupo = ?
      WHERE correo = ?
    `,
    [PROFESOR_SEMILLA.grado, PROFESOR_SEMILLA.grupo, PROFESOR_SEMILLA.correo]
  );

  // Completa datos que puedan faltar en tareas creadas antes de agregar grado/grupo.
  db.run(
    `
      UPDATE tareas
      SET
        grado = COALESCE(grado, (
          SELECT u.grado
          FROM usuarios u
          WHERE u.id = tareas.profesor_id
        )),
        grupo = COALESCE(grupo, (
          SELECT u.grupo
          FROM usuarios u
          WHERE u.id = tareas.profesor_id
        ))
      WHERE grado IS NULL OR grupo IS NULL
    `
  );
}

function migrarUsuariosSiHaceFalta() {
  db.get(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'`,
    (error, row) => {
      if (error) {
        console.error('Error al inspeccionar tabla usuarios:', error.message);
        return;
      }

      const definicionUsuarios = row?.sql || '';
      const requiereMigracionUsuarios = !definicionUsuarios.includes("'administrador'");

      if (!requiereMigracionUsuarios) {
        db.run(`ALTER TABLE usuarios ADD COLUMN nivel TEXT`, () => {});
        db.run(`ALTER TABLE usuarios ADD COLUMN grado TEXT`, () => {});
        db.run(`ALTER TABLE usuarios ADD COLUMN grupo TEXT`, () => {});
        migrarTareasSiHaceFalta();
        return;
      }

      db.run('PRAGMA foreign_keys = OFF');
      db.run(createUsuariosTable('usuarios_migracion'));
      db.run(
        `
          INSERT INTO usuarios_migracion (id, nombre, correo, password_hash, rol, nivel, grado, grupo, creado_en)
          SELECT id, nombre, correo, password_hash, rol, nivel, grado, grupo, creado_en
          FROM usuarios
        `
      );
      db.run('DROP TABLE usuarios');
      db.run('ALTER TABLE usuarios_migracion RENAME TO usuarios');
      db.run('PRAGMA foreign_keys = ON');
      migrarTareasSiHaceFalta();
    }
  );
}

function migrarTareasSiHaceFalta() {
  db.get(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tareas'`,
    (error, row) => {
      if (error) {
        console.error('Error al inspeccionar tabla tareas:', error.message);
        return;
      }

      const definicionTareas = row?.sql || '';

      const requiereMigracionTareas =
        !definicionTareas.includes('grado TEXT') ||
        !definicionTareas.includes('grupo TEXT');

      if (requiereMigracionTareas) {
        db.run('PRAGMA foreign_keys = OFF');

        db.run(createTareasTable('tareas_migracion'));

        db.run(
          `
            INSERT INTO tareas_migracion (
              id,
              profesor_id,
              grado,
              grupo,
              materia,
              titulo,
              descripcion,
              fecha_entrega,
              semana_inicio,
              semana_fin,
              creado_en
            )
            SELECT
              t.id,
              t.profesor_id,
              COALESCE(u.grado, 'Sin grado'),
              COALESCE(u.grupo, 'Sin grupo'),
              t.materia,
              t.titulo,
              t.descripcion,
              t.fecha_entrega,
              t.semana_inicio,
              t.semana_fin,
              t.creado_en
            FROM tareas t
            LEFT JOIN usuarios u ON u.id = t.profesor_id
          `,
          (error) => {
            if (error) {
              console.error('Error al migrar tareas:', error.message);
              return;
            }

            db.run('DROP TABLE tareas');

            db.run('ALTER TABLE tareas_migracion RENAME TO tareas');

            db.run('PRAGMA foreign_keys = ON');

            agregarClaseIdATareas();
          }
        );

        return;
      }

      agregarClaseIdATareas();
    }
  );
}

function agregarClaseIdATareas() {
  db.all(`PRAGMA table_info(tareas)`, [], (error, columnas) => {
    if (error) {
      console.error('Error al revisar columnas de tareas:', error.message);
      return;
    }

    const tieneClaseId = columnas.some(
      columna => columna.name === 'clase_id'
    );

    if (tieneClaseId) {
      seedData();
      return;
    }

    db.run(
      `ALTER TABLE tareas ADD COLUMN clase_id INTEGER`,
      (error) => {
        if (error) {
          console.error('Error al agregar clase_id:', error.message);
          return;
        }

        console.log('Columna clase_id agregada a tareas.');
        seedData();
      }
    );
  });
}

db.serialize(() => {
  db.run(createUsuariosTable());
  db.run(createTareasTable());

    db.run(`
    CREATE TABLE IF NOT EXISTS clases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profesor_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      grado TEXT NOT NULL,
      codigo TEXT NOT NULL UNIQUE,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profesor_id) REFERENCES usuarios(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS estudiantes_clases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clase_id INTEGER NOT NULL,
      estudiante_id INTEGER NOT NULL,
      unido_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (clase_id, estudiante_id),
      FOREIGN KEY (clase_id) REFERENCES clases(id),
      FOREIGN KEY (estudiante_id) REFERENCES usuarios(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tarea_estados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tarea_id INTEGER NOT NULL,
      estudiante_id INTEGER NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'en proceso', 'terminado')),
      actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tarea_id, estudiante_id),
      FOREIGN KEY (tarea_id) REFERENCES tareas(id),
      FOREIGN KEY (estudiante_id) REFERENCES usuarios(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notas_calendario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      titulo TEXT NOT NULL,
      origen TEXT NOT NULL DEFAULT 'personal',
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS recuperaciones_contrasena (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      codigo_hash TEXT NOT NULL,
      vence_en INTEGER NOT NULL,
      usado INTEGER NOT NULL DEFAULT 0,
      creado_en INTEGER NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS preferencias_recordatorios (
      usuario_id INTEGER PRIMARY KEY,
      correo_activo INTEGER NOT NULL DEFAULT 1,
      dias_anticipacion INTEGER NOT NULL DEFAULT 3,
      actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS envios_recordatorios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      tarea_id INTEGER NOT NULL,
      fecha_envio TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (usuario_id, tarea_id, fecha_envio),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (tarea_id) REFERENCES tareas(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS instituciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ia_conversaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ia_mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversacion_id INTEGER NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('usuario', 'asistente')),
      contenido TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversacion_id) REFERENCES ia_conversaciones(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ia_uso_diario (
      usuario_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      solicitudes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (usuario_id, fecha),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  migrarUsuariosSiHaceFalta();
});

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        id: this.lastID,
        changes: this.changes
      });
    });
  });
}

function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

module.exports = {
  db,
  dbPath,
  run,
  get,
  all
};
