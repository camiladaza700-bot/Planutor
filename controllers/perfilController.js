const Usuario = require('../models/usuarioModel');

function texto(valor) {
  // Evita guardar espacios al inicio/final y valores no textuales enviados por formularios.
  return typeof valor === 'string' ? valor.trim() : '';
}

function correo(valor) {
  return texto(valor).toLowerCase();
}

function volver(usuarioId, tipo, mensaje) {
  return `/perfil/${usuarioId}?${tipo}=${encodeURIComponent(mensaje)}`;
}

async function mostrar(req, res) {
  try {
    const usuario = await Usuario.buscarPorId(Number(req.params.userId));
    if (!usuario) {
      return res.status(404).send('Usuario no encontrado.');
    }

    res.render('perfil', {
      usuario,
      mensaje: req.query.mensaje || '',
      error: req.query.error || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible cargar el perfil.');
  }
}

async function actualizarDatos(req, res) {
  const usuarioId = Number(req.params.userId);

  try {
    const usuario = await Usuario.buscarPorId(usuarioId);
    if (!usuario) {
      return res.status(404).send('Usuario no encontrado.');
    }

    const nombre = texto(req.body.nombre);
    const nuevoCorreo = correo(req.body.correo);
    // La institución de un profesor es asignada por administración y no puede
    // ser sustituida desde el perfil personal.
    const institucion = usuario.rol === 'profesor'
      ? (usuario.institucion || '')
      : texto(req.body.institucion);
    // Solo el perfil de estudiante puede cambiar su nivel, grado y grupo desde esta pantalla.
    const nivel = usuario.rol === 'estudiante' ? texto(req.body.nivel) : usuario.nivel;
    const grado = usuario.rol === 'estudiante' ? texto(req.body.grado) : usuario.grado;
    const grupo = usuario.rol === 'estudiante' ? texto(req.body.grupo) : usuario.grupo;

    if (!nombre || !nuevoCorreo || (usuario.rol !== 'profesor' && !institucion)) {
      return res.redirect(volver(usuarioId, 'error', 'Nombre, correo e institución son obligatorios.'));
    }

    if (!/^\S+@\S+\.\S+$/.test(nuevoCorreo)) {
      return res.redirect(volver(usuarioId, 'error', 'Ingresa un correo electrónico válido.'));
    }

    if (usuario.rol === 'estudiante' && (!nivel || !grado || !grupo)) {
      return res.redirect(volver(usuarioId, 'error', 'Nivel, grado y grupo son obligatorios.'));
    }

    // El correo es único; se permite conservarlo cuando pertenece al mismo usuario.
    const existente = await Usuario.buscarPorCorreo(nuevoCorreo);
    if (existente && existente.id !== usuario.id) {
      return res.redirect(volver(usuarioId, 'error', 'Ese correo ya está registrado.'));
    }

    await Usuario.actualizarPerfil(usuario.id, {
      nombre,
      correo: nuevoCorreo,
      institucion,
      nivel,
      grado,
      grupo
    });

    res.redirect(volver(usuarioId, 'mensaje', 'Datos del perfil actualizados.'));
  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible actualizar el perfil.');
  }
}

async function cambiarContrasena(req, res) {
  const usuarioId = Number(req.params.userId);
  const actual = texto(req.body.contrasenaActual);
  const nueva = texto(req.body.nuevaContrasena);
  const confirmar = texto(req.body.confirmarContrasena);

  try {
    const usuario = await Usuario.buscarPorId(usuarioId);
    if (!usuario) {
      return res.status(404).send('Usuario no encontrado.');
    }

    // Se exige la contraseña actual antes de cambiarla, incluso con una sesión ya iniciada.
    if (!Usuario.verifyPassword(actual, usuario.password_hash)) {
      return res.redirect(volver(usuarioId, 'error', 'La contraseña actual no es correcta.'));
    }

    if (nueva.length < 8) {
      return res.redirect(volver(usuarioId, 'error', 'La nueva contraseña debe tener al menos 8 caracteres.'));
    }

    if (nueva !== confirmar) {
      return res.redirect(volver(usuarioId, 'error', 'Las nuevas contraseñas no coinciden.'));
    }

    // La nueva clave se transforma en hash antes de llegar a la base de datos.
    await Usuario.actualizarPassword(usuario.id, Usuario.hashPassword(nueva));
    res.redirect(volver(usuarioId, 'mensaje', 'Contraseña actualizada correctamente.'));
  } catch (error) {
    console.error(error);
    res.status(500).send('No fue posible actualizar la contraseña.');
  }
}

module.exports = { mostrar, actualizarDatos, cambiarContrasena };
