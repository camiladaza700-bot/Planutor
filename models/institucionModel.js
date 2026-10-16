const { all, get, run } = require('../config/db');

const Institucion = {
  obtenerTodas() {
    return all(`
      SELECT i.id, i.nombre, i.creado_en, COUNT(u.id) AS usuarios_asignados
      FROM instituciones i
      LEFT JOIN usuarios u ON u.institucion = i.nombre
      GROUP BY i.id
      ORDER BY i.nombre COLLATE NOCASE ASC
    `);
  },

  buscarPorNombre(nombre) {
    return get('SELECT id, nombre FROM instituciones WHERE lower(nombre) = lower(?)', [nombre]);
  },

  crear(nombre) {
    return run('INSERT INTO instituciones (nombre) VALUES (?)', [nombre]);
  },

  async actualizar(id, nombre) {
    const anterior = await get('SELECT nombre FROM instituciones WHERE id = ?', [id]);
    if (!anterior) return { changes: 0 };
    await run('UPDATE instituciones SET nombre = ? WHERE id = ?', [nombre, id]);
    await run('UPDATE usuarios SET institucion = ? WHERE institucion = ?', [nombre, anterior.nombre]);
    return { changes: 1 };
  },

  eliminar(id) {
    return run('DELETE FROM instituciones WHERE id = ?', [id]);
  }
};

module.exports = Institucion;
