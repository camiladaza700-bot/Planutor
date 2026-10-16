const express = require('express');
const Planeador = require('../models/planeadorModel');
const Usuario = require('../models/usuarioModel');
const Tarea = require('../models/tareaModel');
const Recordatorio = require('../models/recordatorioModel');

const router = express.Router();


// MOSTRAR PLANEADOR
router.get('/:userId', async (req, res) => {
  try {
    const usuarioId = Number(req.params.userId);

    if (!usuarioId) {
      return res.status(400).send('Usuario no valido.');
    }

    const usuario = await Usuario.buscarPorId(usuarioId);
    if (!usuario) {
      return res.status(404).send('Usuario no encontrado.');
    }

    // El planeador reúne datos personales y académicos para mostrarlos en una sola vista.
    const anotaciones = await Planeador.obtenerPorUsuario(usuarioId);
    const semana = Tarea.obtenerRangoSemanaActual();
    let tareas = [];
    let recordatorios = [];

    // Cada rol obtiene las tareas desde una fuente diferente: creadas o asignadas.
    if (usuario.rol === 'profesor') {
      tareas = await Tarea.obtenerPorProfesorSemana(
        usuario.id,
        semana.inicio,
        semana.fin
      );
      recordatorios = await Recordatorio.obtenerParaProfesor(usuario.id);
    } else if (usuario.rol === 'estudiante') {
      tareas = await Tarea.obtenerMuroSemana({
        estudianteId: usuario.id,
        grado: usuario.grado,
        grupo: usuario.grupo,
        semanaInicio: semana.inicio,
        semanaFin: semana.fin
      });
      recordatorios = await Recordatorio.obtenerParaEstudiante({
        estudianteId: usuario.id,
        grado: usuario.grado,
        grupo: usuario.grupo
      });
    }

    const hoy = new Date().toISOString().split('T')[0];

    // El estado atrasada se calcula al cargar la vista; no altera el estado original guardado.
    for (const anotacion of anotaciones) {
      if (
        anotacion.estado !== 'completada' &&
        anotacion.estado !== 'archivada' &&
        anotacion.fecha < hoy
      ) {
        anotacion.estado = 'atrasada';
      }
    }

    res.render('planeador', {
      anotaciones,
      usuarioId,
      usuario,
      tareas,
      recordatorios,
      semana
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible cargar el planeador.');
  }
});


// CREAR ANOTACIÓN
router.post('/:userId/crear', async (req, res) => {
  try {
    const usuarioId = Number(req.params.userId);

    // Solo se reciben los campos permitidos del formulario para crear la anotación.
    await Planeador.crear({
      usuarioId,
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      fecha: req.body.fecha,
      categoria: req.body.categoria,
      estado: req.body.estado || 'pendiente'
    });

    res.redirect(`/planeador/${usuarioId}`);

  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible crear la anotacion.');
  }
});


// EDITAR ANOTACIÓN
router.post('/:userId/editar/:id', async (req, res) => {
  try {
    const usuarioId = Number(req.params.userId);
    const id = Number(req.params.id);

    await Planeador.editar(id, usuarioId, {
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      fecha: req.body.fecha,
      categoria: req.body.categoria,
      estado: req.body.estado
    });

    res.redirect(`/planeador/${usuarioId}`);

  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible editar la anotacion.');
  }
});


// ELIMINAR ANOTACIÓN
router.post('/:userId/eliminar/:id', async (req, res) => {
  try {
    const usuarioId = Number(req.params.userId);
    const id = Number(req.params.id);

    await Planeador.eliminar(id, usuarioId);

    res.redirect(`/planeador/${usuarioId}`);

  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible eliminar la anotacion.');
  }
});


// ARCHIVAR ANOTACIÓN
router.post('/:userId/archivar/:id', async (req, res) => {
  try {
    const usuarioId = Number(req.params.userId);
    const id = Number(req.params.id);

    await Planeador.archivar(id, usuarioId);

    res.redirect(`/planeador/${usuarioId}`);

  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible archivar la anotacion.');
  }
});


// DESARCHIVAR ANOTACIÓN
router.post('/:userId/desarchivar/:id', async (req, res) => {
  try {
    const usuarioId = Number(req.params.userId);
    const id = Number(req.params.id);

    await Planeador.desarchivar(id, usuarioId);

    res.redirect(`/planeador/${usuarioId}`);

  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible desarchivar la anotacion.');
  }
});


module.exports = router;
