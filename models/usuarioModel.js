const crypto = require('crypto');
const { all, get, run, db } = require('../config/db');

// Agrega la columna institucion si todavia no existe (no rompe datos existentes)
// Migraciones ligeras: si la columna ya existe SQLite devuelve error y la aplicación continúa.
db.run(`ALTER TABLE usuarios ADD COLUMN institucion TEXT`, () => {});
db.run(`ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1`, () => {});
db.run(`ALTER TABLE usuarios ADD COLUMN area TEXT`, () => {});

function hashPassword(password) {
  // Cada contraseña usa una sal distinta; nunca se guarda la contraseña original.
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');

  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = String(passwordHash || '').split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const derivedHash = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (storedBuffer.length !== derivedHash.length) {
    return false;
  }

  // La comparación de tiempo constante reduce filtraciones por diferencias de tiempo.
  return crypto.timingSafeEqual(storedBuffer, derivedHash);
}

const Usuario = {
    guardarCodigoRecuperacion(usuarioId, codigoHash, venceEn) {
    // Solo se guarda el hash del código temporal enviado por correo, no el código legible.
    const query = `
      INSERT INTO recuperaciones_contrasena
      (usuario_id, codigo_hash, vence_en, usado, creado_en)
      VALUES (?, ?, ?, 0, ?)
    `;

    return run(query, [
      usuarioId,
      codigoHash,
      venceEn,
      Date.now()
    ]);
  },

    buscarCodigoRecuperacion(usuarioId, codigoHash) {
    const query = `
      SELECT id, usuario_id, codigo_hash, vence_en, usado
      FROM recuperaciones_contrasena
      WHERE usuario_id = ?
        AND codigo_hash = ?
        AND usado = 0
      ORDER BY id DESC
      LIMIT 1
    `;

    return get(query, [usuarioId, codigoHash]);
  },

marcarCodigoRecuperacionUsado(id) {
  const query = `
    UPDATE recuperaciones_contrasena
    SET usado = 1
    WHERE id = ?
  `;

  return run(query, [id]);
},

  obtenerTodos() {
    // No incluye password_hash: la administración no necesita ni debe recibirlo.
    const query = `
      SELECT id, nombre, correo, rol, nivel, grado, grupo, institucion, area, activo, creado_en
      FROM usuarios
      ORDER BY datetime(creado_en) DESC, id DESC
    `;

    return all(query);
  },

  buscarPorCorreo(correo) {
    const query = `
      SELECT id, nombre, correo, password_hash, rol, nivel, grado, grupo, institucion, area, activo, creado_en
      FROM usuarios
      WHERE correo = ?
    `;

    return get(query, [correo]);
  },

  buscarPorId(id) {
    const query = `
      SELECT id, nombre, correo, password_hash, rol, nivel, grado, grupo, institucion, area, activo, creado_en
      FROM usuarios
      WHERE id = ?
    `;

    return get(query, [id]);
  },

  crear(datos) {
    // La contraseña debe llegar ya transformada por hashPassword desde el controlador.
    const query = `
      INSERT INTO usuarios (nombre, correo, password_hash, rol, nivel, grado, grupo, institucion, area)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return run(query, [
      datos.nombre,
      datos.correo,
      datos.passwordHash,
      datos.rol,
      datos.nivel || null,
      datos.grado || null,
      datos.grupo || null,
      datos.institucion || null,
      datos.area || null
    ]);
  },


  actualizarPassword(usuarioId, passwordHash) {
    const query = `
      UPDATE usuarios
      SET password_hash = ?
      WHERE id = ?
    `;

    return run(query, [passwordHash, usuarioId]);
  },

  actualizarPerfil(usuarioId, datos) {
    return run(
      `
        UPDATE usuarios
        SET nombre = ?, correo = ?, institucion = ?, nivel = ?, grado = ?, grupo = ?
        WHERE id = ?
      `,
      [
        datos.nombre,
        datos.correo,
        datos.institucion || null,
        datos.nivel || null,
        datos.grado || null,
        datos.grupo || null,
        usuarioId
      ]
    );
  },

  actualizarDesdeAdministracion(usuarioId, datos) {
    return run(
      `
        UPDATE usuarios
        SET nombre = ?, correo = ?, rol = ?, institucion = ?, nivel = ?, grado = ?, grupo = ?
        WHERE id = ?
      `,
      [
        datos.nombre,
        datos.correo,
        datos.rol,
        datos.institucion || null,
        datos.nivel || null,
        datos.grado || null,
        datos.grupo || null,
        usuarioId
      ]
    );
  },

  cambiarEstado(usuarioId, activo) {
    return run('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, usuarioId]);
  },

  async eliminarConDatos(usuarioId) {
    await run(
      `DELETE FROM tarea_estados WHERE estudiante_id = ? OR tarea_id IN (SELECT id FROM tareas WHERE profesor_id = ?)`,
      [usuarioId, usuarioId]
    );
    await run(
      `DELETE FROM envios_recordatorios
       WHERE usuario_id = ? OR tarea_id IN (SELECT id FROM tareas WHERE profesor_id = ?)`,
      [usuarioId, usuarioId]
    );
    await run('DELETE FROM preferencias_recordatorios WHERE usuario_id = ?', [usuarioId]);
    await run('DELETE FROM estudiantes_clases WHERE estudiante_id = ? OR clase_id IN (SELECT id FROM clases WHERE profesor_id = ?)', [usuarioId, usuarioId]);
    await run('DELETE FROM tareas WHERE profesor_id = ?', [usuarioId]);
    await run('DELETE FROM clases WHERE profesor_id = ?', [usuarioId]);
    await run('DELETE FROM notas_calendario WHERE usuario_id = ?', [usuarioId]);
    await run('DELETE FROM anotaciones_planeador WHERE usuario_id = ?', [usuarioId]);
    await run('DELETE FROM ia_uso_diario WHERE usuario_id = ?', [usuarioId]);
    await run('DELETE FROM ia_mensajes WHERE conversacion_id IN (SELECT id FROM ia_conversaciones WHERE usuario_id = ?)', [usuarioId]);
    await run('DELETE FROM ia_conversaciones WHERE usuario_id = ?', [usuarioId]);
    await run('DELETE FROM recuperaciones_contrasena WHERE usuario_id = ?', [usuarioId]);
    await run('DELETE FROM eventos_escolares WHERE creado_por = ?', [usuarioId]);
    return run('DELETE FROM usuarios WHERE id = ?', [usuarioId]);
  },

  hashPassword,
  verifyPassword
};

module.exports = Usuario;
