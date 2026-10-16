
const Usuario = require('../models/usuarioModel');

async function validarSesion(req, res) {
  const sesion = req.session.usuario;
  if (!sesion) {
    res.redirect('/');
    return null;
  }

  try {
    const usuario = await Usuario.buscarPorId(sesion.id);
    if (!usuario || !usuario.activo) {
      req.session.destroy(() => {});
      res.redirect('/');
      return null;
    }

    req.session.usuario.rol = usuario.rol;
    return usuario;
  } catch (error) {
    console.error('No fue posible validar la sesión:', error);
    res.status(500).send('No fue posible validar la sesión.');
    return null;
  }
}

function soloRol(rol) {
  return async (req, res, next) => {
    const usuario = await validarSesion(req, res);
    if (!usuario) return;

    if (usuario.rol !== rol) {
      return res.status(403).send('Acceso denegado');
    }

    next();
  };
}

function soloLogueado(req, res, next) {
  validarSesion(req, res).then(usuario => {
    if (usuario) next();
  });
}

function soloYo(campo) {
  return async (req, res, next) => {
    const usuario = await validarSesion(req, res);
    if (!usuario) return;

    const id = req.params[campo] ??
      req.query[campo] ??
      (req.body && req.body[campo]);

    if (id !== undefined && Number(id) !== Number(usuario.id)) {
      return res.status(403).send('Acceso denegado');
    }

    next();
  };
}

module.exports = { soloRol, soloLogueado, soloYo };
