const { all, get, run } = require('../config/db');

const IA = {
  crearConversacion(usuarioId, titulo) {
    return run(
      `INSERT INTO ia_conversaciones (usuario_id, titulo) VALUES (?, ?)`,
      [usuarioId, titulo]
    );
  },

  obtenerConversaciones(usuarioId) {
    // Ordena por la última interacción para que la conversación reciente aparezca primero.
    return all(
      `SELECT id, titulo, creado_en, actualizado_en
       FROM ia_conversaciones WHERE usuario_id = ?
       ORDER BY datetime(actualizado_en) DESC, id DESC`,
      [usuarioId]
    );
  },

  buscarConversacion(id, usuarioId) {
    // La condición de usuario evita que alguien abra una conversación ajena por su ID.
    return get(
      `SELECT id, usuario_id, titulo FROM ia_conversaciones WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );
  },

  obtenerMensajes(conversacionId, limite = 12) {
    // Solo se manda un historial corto a Gemini para controlar el consumo de tokens.
    return all(
      `SELECT rol, contenido, creado_en FROM (
         SELECT id, rol, contenido, creado_en
         FROM ia_mensajes WHERE conversacion_id = ?
         ORDER BY id DESC LIMIT ?
       ) ORDER BY id ASC`,
      [conversacionId, limite]
    );
  },

  async guardarIntercambio(conversacionId, pregunta, respuesta) {
    // Cada consulta genera dos mensajes: uno del usuario y otro del asistente.
    await run(
      `INSERT INTO ia_mensajes (conversacion_id, rol, contenido) VALUES (?, 'usuario', ?)`,
      [conversacionId, pregunta]
    );
    await run(
      `INSERT INTO ia_mensajes (conversacion_id, rol, contenido) VALUES (?, 'asistente', ?)`,
      [conversacionId, respuesta]
    );
    return run(
      `UPDATE ia_conversaciones SET actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
      [conversacionId]
    );
  },

  async eliminarConversacion(id, usuarioId) {
    // Primero se eliminan los mensajes porque SQLite no tiene borrado en cascada en esta tabla.
    const conversacion = await get(
      `SELECT id FROM ia_conversaciones WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );
    if (!conversacion) return { changes: 0 };
    await run('DELETE FROM ia_mensajes WHERE conversacion_id = ?', [id]);
    return run('DELETE FROM ia_conversaciones WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  },

  usosHoy(usuarioId, fecha) {
    return get(
      `SELECT solicitudes FROM ia_uso_diario WHERE usuario_id = ? AND fecha = ?`,
      [usuarioId, fecha]
    );
  },

  registrarUso(usuarioId, fecha) {
    // UPSERT: crea el contador del día o incrementa el existente de forma atómica.
    return run(
      `INSERT INTO ia_uso_diario (usuario_id, fecha, solicitudes)
       VALUES (?, ?, 1)
       ON CONFLICT(usuario_id, fecha) DO UPDATE SET solicitudes = solicitudes + 1`,
      [usuarioId, fecha]
    );
  }
};

module.exports = IA;
