const Usuario = require('../models/usuarioModel');
const Tarea = require('../models/tareaModel');
const Clase = require('../models/claseModel');

function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function mostrarError(res, estado, mensaje, volverA = '/') {
  res.status(estado).render('error', {
    titulo: 'Aviso',
    mensaje,
    volverA,
    volverTexto: 'Volver'
  });
}

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

function filtrarTareas(tareas, filtro, rol) {
  const hoy = fechaHoy();

  if (filtro === 'proximas') {
    return tareas.filter(tarea =>
      tarea.fecha_entrega >= hoy &&
      (rol !== 'estudiante' || tarea.estado !== 'terminado')
    );
  }

  if (filtro === 'vencidas') {
    return tareas.filter(tarea =>
      tarea.fecha_entrega < hoy &&
      (rol !== 'estudiante' || tarea.estado !== 'terminado') &&
      (rol !== 'profesor' || Number(tarea.terminados) < Number(tarea.estudiantes_asignados))
    );
  }

  if (filtro === 'historial') {
    return tareas.filter(tarea =>
      rol === 'estudiante'
        ? tarea.estado === 'terminado'
        : tarea.fecha_entrega < hoy && Number(tarea.terminados) >= Number(tarea.estudiantes_asignados)
    );
  }

  return tareas;
}

async function listar(req, res) {
  try {
    const usuarioId = Number(req.params.userId);
    const usuario = await Usuario.buscarPorId(usuarioId);
    const filtrosValidos = ['todas', 'proximas', 'vencidas', 'historial'];
    const filtro = filtrosValidos.includes(req.query.filtro)
      ? req.query.filtro
      : 'proximas';

    if (!usuario || !['profesor', 'estudiante'].includes(usuario.rol)) {
      return mostrarError(res, 404, 'No fue posible cargar las tareas.');
    }

    const todas = usuario.rol === 'profesor'
      ? await Tarea.obtenerTodasPorProfesor(usuario.id)
      : await Tarea.obtenerTodasParaEstudiante({
          estudianteId: usuario.id,
          grado: usuario.grado,
          grupo: usuario.grupo
        });

    res.render('tareas', {
      usuario,
      tareas: filtrarTareas(todas, filtro, usuario.rol),
      filtro,
      hoy: fechaHoy(),
      mensaje: req.query.mensaje || ''
    });
  } catch (error) {
    console.error(error);
    mostrarError(res, 500, 'No fue posible cargar las tareas.');
  }
}

async function crear(req, res) {
  try {
    const profesor = await Usuario.buscarPorId(Number(req.body.profesorId));

    if (!profesor || profesor.rol !== 'profesor') {
      return mostrarError(res, 403, 'Solo un profesor puede publicar tareas.');
    }

    const volver = `/panel/${profesor.id}`;
    const clases = await Clase.obtenerPorProfesor(profesor.id);
    const clase = clases.find((c) => c.id === Number(req.body.claseId));

    const materia = limpiar(req.body.materia);
    const titulo = limpiar(req.body.titulo);
    const descripcion = limpiar(req.body.descripcion);
    const fechaEntrega = limpiar(req.body.fechaEntrega);

    if (!clase) {
      return mostrarError(res, 400, 'Elige una de tus clases.', volver);
    }

    if (!titulo || !descripcion || !fechaEntrega) {
      return mostrarError(res, 400, 'Titulo, descripcion y fecha de entrega son obligatorios.', volver);
    }

    const semana = Tarea.obtenerRangoSemanaActual();

    await Tarea.crear({
      profesorId: profesor.id,
      claseId: clase.id,
      grado: clase.grado,
      grupo: profesor.grupo || 'General',
      materia: materia || clase.nombre,
      titulo,
      descripcion,
      fechaEntrega,
      semanaInicio: semana.inicio,
      semanaFin: semana.fin
    });

    res.redirect(`${volver}?mensaje=tarea-creada`);
  } catch (error) {
    console.error(error);
    mostrarError(res, 500, 'No fue posible publicar la tarea.');
  }
}

async function buscarTareaPropia(req, res) {
  const miId = req.session.usuario.id;
  const tarea = await Tarea.buscarPorId(Number(req.params.tareaId));

  if (!tarea || tarea.profesor_id !== miId) {
    mostrarError(res, 403, 'Solo puedes cambiar las tareas que tu publicaste.', `/panel/${miId}`);
    return null;
  }

  return tarea;
}

async function editar(req, res) {
  try {
    const tarea = await buscarTareaPropia(req, res);

    if (!tarea) {
      return;
    }

    const materia = limpiar(req.body.materia);
    const titulo = limpiar(req.body.titulo);
    const descripcion = limpiar(req.body.descripcion);
    const fechaEntrega = limpiar(req.body.fechaEntrega);

    if (!titulo || !descripcion || !fechaEntrega) {
      return mostrarError(res, 400, 'Titulo, descripcion y fecha de entrega son obligatorios.', `/panel/${tarea.profesor_id}`);
    }

    await Tarea.actualizar(tarea.id, {
      materia: materia || tarea.materia,
      titulo,
      descripcion,
      fechaEntrega
    });

    const volver = req.body.origen === 'tareas'
      ? `/tareas/${tarea.profesor_id}?filtro=${encodeURIComponent(req.body.filtro || 'todas')}`
      : `/panel/${tarea.profesor_id}?mensaje=tarea-editada`;
    res.redirect(volver);
  } catch (error) {
    console.error(error);
    mostrarError(res, 500, 'No fue posible guardar los cambios.');
  }
}

async function eliminar(req, res) {
  try {
    const tarea = await buscarTareaPropia(req, res);

    if (!tarea) {
      return;
    }

    await Tarea.eliminar(tarea.id);

    const volver = req.body.origen === 'tareas'
      ? `/tareas/${tarea.profesor_id}?filtro=${encodeURIComponent(req.body.filtro || 'todas')}&mensaje=Tarea+eliminada.`
      : `/panel/${tarea.profesor_id}?mensaje=tarea-eliminada`;
    res.redirect(volver);
  } catch (error) {
    console.error(error);
    mostrarError(res, 500, 'No fue posible eliminar la tarea.');
  }
}

async function actualizarEstado(req, res) {
  try {
    const estudiante = await Usuario.buscarPorId(Number(req.body.estudianteId));
    const tarea = await Tarea.buscarPorId(Number(req.params.tareaId));
    const estado = limpiar(req.body.estado).toLowerCase();

    if (!estudiante || estudiante.rol !== 'estudiante' || !tarea) {
      return mostrarError(res, 404, 'No fue posible actualizar el estado de la tarea.');
    }

    const volver = req.body.origen === 'tareas'
      ? `/tareas/${estudiante.id}?filtro=${encodeURIComponent(req.body.filtro || 'todas')}`
      : `/panel/${estudiante.id}`;

    const esDeSuClase = tarea.clase_id
      ? await Clase.esEstudianteDeClase(tarea.clase_id, estudiante.id)
      : estudiante.grado === tarea.grado && estudiante.grupo === tarea.grupo;

    if (!esDeSuClase) {
      return mostrarError(res, 403, 'Esta tarea no es de una de tus clases.', volver);
    }

    if (!['pendiente', 'en proceso', 'terminado'].includes(estado)) {
      return mostrarError(res, 400, 'El estado seleccionado no es valido.', volver);
    }

    await Tarea.guardarEstado({
      tareaId: tarea.id,
      estudianteId: estudiante.id,
      estado
    });

    const separador = volver.includes('?') ? '&' : '?';
    res.redirect(`${volver}${separador}mensaje=Estado+actualizado.`);
  } catch (error) {
    console.error(error);
    mostrarError(res, 500, 'No fue posible actualizar el estado de la tarea.');
  }
}

module.exports = {
  listar,
  crear,
  editar,
  eliminar,
  actualizarEstado
};
