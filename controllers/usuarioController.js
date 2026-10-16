const Usuario = require('../models/usuarioModel');
const Institucion = require('../models/institucionModel');

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function correo(valor) {
  return texto(valor).toLowerCase();
}

function volver(tipo, mensaje) {
  return `/usuarios?${tipo}=${encodeURIComponent(mensaje)}`;
}

async function listar(req, res) {
  try {
    const [usuarios, instituciones] = await Promise.all([
      Usuario.obtenerTodos(),
      Institucion.obtenerTodas()
    ]);

    res.render('usuarios', {
      usuarios,
      instituciones,
      currentUser: await Usuario.buscarPorId(req.session.usuario.id),
      bienvenida: false,
      mensaje: req.query.mensaje || '',
      error: req.query.error || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', {
      titulo: 'Error de datos',
      mensaje: 'No fue posible consultar los usuarios registrados.',
      volverA: '/',
      volverTexto: 'Volver al login'
    });
  }
}

async function editar(req, res) {
  const id = Number(req.params.id);
  const nombre = texto(req.body.nombre);
  const email = correo(req.body.correo);
  const rol = texto(req.body.rol);
  const institucion = texto(req.body.institucion);

  try {
    const objetivo = await Usuario.buscarPorId(id);
    if (!objetivo) return res.redirect(volver('error', 'Usuario no encontrado.'));
    if (!nombre || !email || !['estudiante', 'profesor', 'administrador'].includes(rol)) {
      return res.redirect(volver('error', 'Nombre, correo y rol válido son obligatorios.'));
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.redirect(volver('error', 'El correo no es válido.'));
    }
    if (id === req.session.usuario.id && rol !== 'administrador') {
      return res.redirect(volver('error', 'No puedes quitarte tu propio rol de administrador.'));
    }

    if (rol === 'profesor' && institucion && !await Institucion.buscarPorNombre(institucion)) {
      return res.redirect(volver('error', 'Selecciona una institución creada por el administrador.'));
    }

    const existente = await Usuario.buscarPorCorreo(email);
    if (existente && existente.id !== id) {
      return res.redirect(volver('error', 'Ese correo ya está registrado.'));
    }

    await Usuario.actualizarDesdeAdministracion(id, {
      nombre,
      correo: email,
      rol,
      institucion,
      nivel: texto(req.body.nivel),
      grado: texto(req.body.grado),
      grupo: texto(req.body.grupo)
    });
    res.redirect(volver('mensaje', 'Usuario actualizado.'));
  } catch (error) {
    console.error(error);
    res.redirect(volver('error', 'No fue posible actualizar el usuario.'));
  }
}

async function cambiarEstado(req, res) {
  const id = Number(req.params.id);
  try {
    if (id === req.session.usuario.id) {
      return res.redirect(volver('error', 'No puedes desactivar tu propia cuenta.'));
    }
    const usuario = await Usuario.buscarPorId(id);
    if (!usuario) return res.redirect(volver('error', 'Usuario no encontrado.'));
    await Usuario.cambiarEstado(id, !usuario.activo);
    res.redirect(volver('mensaje', usuario.activo ? 'Cuenta desactivada.' : 'Cuenta activada.'));
  } catch (error) {
    console.error(error);
    res.redirect(volver('error', 'No fue posible cambiar el estado de la cuenta.'));
  }
}

async function eliminar(req, res) {
  const id = Number(req.params.id);
  try {
    if (id === req.session.usuario.id) {
      return res.redirect(volver('error', 'No puedes eliminar tu propia cuenta.'));
    }
    const usuario = await Usuario.buscarPorId(id);
    if (!usuario) return res.redirect(volver('error', 'Usuario no encontrado.'));
    await Usuario.eliminarConDatos(id);
    res.redirect(volver('mensaje', 'Cuenta y datos relacionados eliminados.'));
  } catch (error) {
    console.error(error);
    res.redirect(volver('error', 'No fue posible eliminar la cuenta.'));
  }
}

async function crearInstitucion(req, res) {
  const nombre = texto(req.body.nombre);
  try {
    if (!nombre) return res.redirect(volver('error', 'El nombre de la institución es obligatorio.'));
    if (await Institucion.buscarPorNombre(nombre)) {
      return res.redirect(volver('error', 'La institución ya existe.'));
    }
    await Institucion.crear(nombre);
    res.redirect(volver('mensaje', 'Institución creada.'));
  } catch (error) {
    console.error(error);
    res.redirect(volver('error', 'No fue posible crear la institución.'));
  }
}

async function editarInstitucion(req, res) {
  const id = Number(req.params.id);
  const nombre = texto(req.body.nombre);
  try {
    if (!nombre) return res.redirect(volver('error', 'El nombre de la institución es obligatorio.'));
    const existente = await Institucion.buscarPorNombre(nombre);
    if (existente && existente.id !== id) {
      return res.redirect(volver('error', 'La institución ya existe.'));
    }
    await Institucion.actualizar(id, nombre);
    res.redirect(volver('mensaje', 'Institución actualizada.'));
  } catch (error) {
    console.error(error);
    res.redirect(volver('error', 'No fue posible actualizar la institución.'));
  }
}

async function eliminarInstitucion(req, res) {
  const id = Number(req.params.id);
  try {
    const instituciones = await Institucion.obtenerTodas();
    const institucion = instituciones.find(item => item.id === id);
    if (!institucion) return res.redirect(volver('error', 'Institución no encontrada.'));
    if (Number(institucion.usuarios_asignados) > 0) {
      return res.redirect(volver('error', 'No puedes eliminar una institución asignada a usuarios.'));
    }
    await Institucion.eliminar(id);
    res.redirect(volver('mensaje', 'Institución eliminada.'));
  } catch (error) {
    console.error(error);
    res.redirect(volver('error', 'No fue posible eliminar la institución.'));
  }
}

module.exports = {
  listar,
  editar,
  cambiarEstado,
  eliminar,
  crearInstitucion,
  editarInstitucion,
  eliminarInstitucion
};
