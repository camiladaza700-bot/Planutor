const Usuario = require('../models/usuarioModel');
const EventoEscolar = require('../models/eventoModel');

function normalizarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

async function mostrarPagina(req, res) {
  // usuarioId se usa para saber si se muestra el formulario de creación, no para filtrar eventos.
  const usuarioId = req.query.usuarioId ? Number(req.query.usuarioId) : null;

  try {
    const eventos = await EventoEscolar.obtenerTodos();
    const usuario = usuarioId ? await Usuario.buscarPorId(usuarioId) : null;
    // Todos pueden consultar el calendario escolar; solo estos roles pueden administrarlo.
    const puedeAgregar = Boolean(usuario && (usuario.rol === 'profesor' || usuario.rol === 'administrador'));

    res.render('eventos-escolares', {
      eventos,
      currentUser: usuario,
      puedeAgregar,
      mensaje: '',
      error: ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', {
      titulo: 'Error de eventos',
      mensaje: 'No fue posible cargar los eventos escolares.',
      volverA: '/',
      volverTexto: 'Volver al inicio'
    });
  }
}

async function crear(req, res) {
  const usuarioId = Number(req.body.usuarioId);
  const titulo = normalizarTexto(req.body.titulo);
  const descripcion = normalizarTexto(req.body.descripcion);
  const fecha = normalizarTexto(req.body.fecha);
  const tipo = normalizarTexto(req.body.tipo) || 'festividad';

  try {
    const usuario = await Usuario.buscarPorId(usuarioId);

    if (!usuario || (usuario.rol !== 'profesor' && usuario.rol !== 'administrador')) {
      res.status(403).render('error', {
        titulo: 'Acceso denegado',
        mensaje: 'Solo profesores o administradores (coordinadores) pueden agregar eventos escolares.',
        volverA: `/eventos-escolares?usuarioId=${usuarioId || ''}`,
        volverTexto: 'Volver a eventos'
      });
      return;
    }

    if (!titulo || !fecha) {
      const eventos = await EventoEscolar.obtenerTodos();
      res.status(400).render('eventos-escolares', {
        eventos,
        currentUser: usuario,
        puedeAgregar: true,
        mensaje: '',
        error: 'Titulo y fecha son obligatorios.'
      });
      return;
    }

    // Se registra quién creó el evento para mantener trazabilidad administrativa.
    await EventoEscolar.crear({ titulo, descripcion, fecha, tipo, creadoPor: usuario.id });

    res.redirect(`/eventos-escolares?usuarioId=${usuario.id}`);
  } catch (error) {
    console.error(error);
    res.status(500).render('error', {
      titulo: 'Error de eventos',
      mensaje: 'No fue posible guardar el evento.',
      volverA: '/',
      volverTexto: 'Volver al inicio'
    });
  }
}

async function eliminar(req, res) {
  const usuarioId = Number(req.body.usuarioId);
  const id = Number(req.params.id);

  try {
    const usuario = await Usuario.buscarPorId(usuarioId);

    if (!usuario || (usuario.rol !== 'profesor' && usuario.rol !== 'administrador')) {
      res.status(403).render('error', {
        titulo: 'Acceso denegado',
        mensaje: 'No tienes permiso para eliminar este evento.',
        volverA: `/eventos-escolares?usuarioId=${usuarioId || ''}`,
        volverTexto: 'Volver a eventos'
      });
      return;
    }

    // El middleware ya validó el usuario; esta operación elimina el evento solicitado.
    await EventoEscolar.eliminar(id);

    res.redirect(`/eventos-escolares?usuarioId=${usuario.id}`);
  } catch (error) {
    console.error(error);
    res.status(500).render('error', {
      titulo: 'Error de eventos',
      mensaje: 'No fue posible eliminar el evento.',
      volverA: '/',
      volverTexto: 'Volver al inicio'
    });
  }
}

module.exports = { mostrarPagina, crear, eliminar };
