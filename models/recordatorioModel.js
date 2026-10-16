const { all, get, run } = require('../config/db');

function obtenerRangoRecordatorio(dias = 3) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(hoy.getDate() + dias);

  return {
    desde: hoy.toISOString().slice(0, 10),
    hasta: limite.toISOString().slice(0, 10)
  };
}

const Recordatorio = {
  obtenerRangoRecordatorio,

  async obtenerPreferencia(usuarioId) {
    const preferencia = await get(
      `SELECT correo_activo, dias_anticipacion FROM preferencias_recordatorios WHERE usuario_id = ?`,
      [usuarioId]
    );

    return preferencia || { correo_activo: 1, dias_anticipacion: 3 };
  },

  guardarPreferencia({ usuarioId, correoActivo, diasAnticipacion }) {
    return run(
      `
        INSERT INTO preferencias_recordatorios
          (usuario_id, correo_activo, dias_anticipacion, actualizado_en)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(usuario_id) DO UPDATE SET
          correo_activo = excluded.correo_activo,
          dias_anticipacion = excluded.dias_anticipacion,
          actualizado_en = CURRENT_TIMESTAMP
      `,
      [usuarioId, correoActivo ? 1 : 0, diasAnticipacion]
    );
  },

  fueEnviadoHoy(usuarioId, tareaId, fechaEnvio) {
    return get(
      `SELECT id FROM envios_recordatorios WHERE usuario_id = ? AND tarea_id = ? AND fecha_envio = ?`,
      [usuarioId, tareaId, fechaEnvio]
    );
  },

  registrarEnvio(usuarioId, tareaId, fechaEnvio) {
    return run(
      `INSERT OR IGNORE INTO envios_recordatorios (usuario_id, tarea_id, fecha_envio)
       VALUES (?, ?, ?)`,
      [usuarioId, tareaId, fechaEnvio]
    );
  },

  obtenerParaProfesor(profesorId, dias = 3) {
    const { desde, hasta } = obtenerRangoRecordatorio(dias);

    const query = `
      SELECT id, materia, titulo, fecha_entrega
      FROM tareas
      WHERE profesor_id = ?
        AND date(fecha_entrega) BETWEEN date(?) AND date(?)
      ORDER BY date(fecha_entrega) ASC
    `;

    return all(query, [profesorId, desde, hasta]);
  },

  obtenerParaEstudiante({ estudianteId, grado, grupo }, dias = 3) {
    const { desde, hasta } = obtenerRangoRecordatorio(dias);

    const query = `
      SELECT
        t.id,
        t.materia,
        t.titulo,
        t.fecha_entrega,
        COALESCE(te.estado, 'pendiente') AS estado
      FROM tareas t
      LEFT JOIN tarea_estados te
        ON te.tarea_id = t.id
       AND te.estudiante_id = ?
      WHERE t.grado = ?
        AND t.grupo = ?
        AND date(t.fecha_entrega) BETWEEN date(?) AND date(?)
        AND COALESCE(te.estado, 'pendiente') != 'terminado'
      ORDER BY date(t.fecha_entrega) ASC
    `;

    return all(query, [estudianteId, grado, grupo, desde, hasta]);
  }
};

module.exports = Recordatorio;
