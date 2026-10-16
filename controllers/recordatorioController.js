const Usuario = require('../models/usuarioModel');
const Recordatorio = require('../models/recordatorioModel');

async function listar(req, res) {
  // Esta ruta devuelve JSON para componentes que consultan recordatorios sin recargar la página.
  const usuarioId = Number(req.query.usuarioId);

  if (!usuarioId) {
    res.status(400).json({ error: 'usuarioId es obligatorio.' });
    return;
  }

  try {
    const usuario = await Usuario.buscarPorId(usuarioId);

    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    // Cada usuario decide cuántos días antes desea recibir la alerta.
    const preferencia = await Recordatorio.obtenerPreferencia(usuario.id);
    let recordatorios = [];

    if (usuario.rol === 'profesor') {
      recordatorios = await Recordatorio.obtenerParaProfesor(
        usuario.id,
        preferencia.dias_anticipacion
      );
    } else if (usuario.rol === 'estudiante') {
      recordatorios = await Recordatorio.obtenerParaEstudiante({
        estudianteId: usuario.id,
        grado: usuario.grado,
        grupo: usuario.grupo
      }, preferencia.dias_anticipacion);
    }

    res.json({ recordatorios, preferencia });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No fue posible obtener los recordatorios.' });
  }
}

async function mostrarPagina(req, res) {
  const usuarioId = Number(req.params.userId);

  try {
    const usuario = await Usuario.buscarPorId(usuarioId);
    if (!usuario || !['profesor', 'estudiante'].includes(usuario.rol)) {
      return res.status(404).send('Usuario no encontrado.');
    }

    const preferencia = await Recordatorio.obtenerPreferencia(usuario.id);
    const recordatorios = usuario.rol === 'profesor'
      ? await Recordatorio.obtenerParaProfesor(usuario.id, preferencia.dias_anticipacion)
      : await Recordatorio.obtenerParaEstudiante({
          estudianteId: usuario.id,
          grado: usuario.grado,
          grupo: usuario.grupo
        }, preferencia.dias_anticipacion);

    res.render('recordatorios', {
      usuario,
      recordatorios,
      preferencia,
      mensaje: req.query.mensaje || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible cargar los recordatorios.');
  }
}

async function guardarConfiguracion(req, res) {
  const usuarioId = Number(req.params.userId);
  const dias = Number(req.body.diasAnticipacion);

  if (![1, 3, 7].includes(dias)) {
    return res.status(400).send('La anticipación debe ser de 1, 3 o 7 días.');
  }

  try {
    const usuario = await Usuario.buscarPorId(usuarioId);
    if (!usuario || !['profesor', 'estudiante'].includes(usuario.rol)) {
      return res.status(404).send('Usuario no encontrado.');
    }

    // "on" solo llega desde un checkbox marcado; lo convertimos a booleano explícito.
    await Recordatorio.guardarPreferencia({
      usuarioId,
      correoActivo: req.body.correoActivo === 'on',
      diasAnticipacion: dias
    });
    res.redirect(`/recordatorios/${usuarioId}?mensaje=Preferencias+actualizadas.`);
  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible guardar las preferencias.');
  }
}

module.exports = { listar, mostrarPagina, guardarConfiguracion };
