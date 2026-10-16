const Usuario = require('../models/usuarioModel');
const Tarea = require('../models/tareaModel');
const Clase = require('../models/claseModel');
const Institucion = require('../models/institucionModel');
const crypto = require('crypto');
const { enviarCorreo } = require('../config/correo');

function normalizarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}
function normalizarNombre(nombre) {
  return normalizarTexto(nombre)
    .split(/\s+/)
    .filter(Boolean)
    .map(
      palabra =>
        palabra.charAt(0).toUpperCase() +
        palabra.slice(1).toLowerCase()
    )
    .join(' ');
}

function normalizarCorreo(correo) {
  return normalizarTexto(correo).toLowerCase();
}

function valoresEstudiante(body = {}) {
  return {
    nombre: normalizarTexto(body.nombre),
    correo: normalizarCorreo(body.correo),
    nivel: normalizarTexto(body.nivel),
    grado: normalizarTexto(body.grado),
    grupo: normalizarTexto(body.grupo),
    institucion: normalizarTexto(body.institucion)
  };
}
const MATERIAS_PROFESOR = [
  'Lengua Castellana',
  'Matemáticas',
  'Ciencias Naturales',
  'Biología',
  'Física',
  'Química',
  'Ciencias Sociales',
  'Historia',
  'Geografía',
  'Filosofía',
  'Inglés',
  'Francés',
  'Educación Física',
  'Educación Artística',
  'Música',
  'Tecnología e Informática',
  'Ética y Valores',
  'Religión',
  'Economía',
  'Ciencias Políticas',
  'Emprendimiento',
  'Estadística',
  'Lectura Crítica',
  'Preescolar',
  'Primaria'
];

function valoresProfesor(body = {}) {
  return {
    nombre: normalizarTexto(body.nombre),
    correo: normalizarCorreo(body.correo),
    area: normalizarTexto(body.area),
    institucion: normalizarTexto(body.institucion)
  };
}

function renderLogin(res, datos = {}) {
  res.render('login', {
    error: datos.error || '',
    mensaje: datos.mensaje || ''
  });
}

function renderCodigoProfesor(res, datos = {}) {
  res.render('codigo-profesor', {
    error: datos.error || '',
    mensaje: datos.mensaje || ''
  });
}

function renderRegistroEstudiante(res, datos = {}) {
  res.render('registro-estudiante', {
    error: datos.error || '',
    mensaje: datos.mensaje || '',
    valores: datos.valores || {
      nombre: '',
      correo: '',
      nivel: '',
      grado: '',
      grupo: '',
      institucion: datos.institucionInicial || ''
    }
  });
}

async function renderPanelUsuario(res, usuario, datos = {}) {
  const semana = Tarea.obtenerRangoSemanaActual();

  if (usuario.rol === 'administrador') {
    const [usuarios, instituciones] = await Promise.all([
      Usuario.obtenerTodos(),
      Institucion.obtenerTodas()
    ]);

    res.render('usuarios', {
      usuarios,
      instituciones,
      currentUser: usuario,
      bienvenida: datos.bienvenida || false,
      mensaje: datos.mensaje || 'Desde aqui puedes revisar administradores, profesores y estudiantes registrados.',
      error: datos.error || ''
    });
    return;
  }

  if (usuario.rol === 'profesor') {
    const tareas = await Tarea.obtenerPorProfesorSemana(usuario.id, semana.inicio, semana.fin);

        const clases = await Clase.obtenerPorProfesor(usuario.id);
    res.render('profesor-dashboard', {
      currentUser: usuario,
      tareas,
      clases,
      bienvenida: datos.bienvenida || false,
      mensaje: datos.mensaje || '',
      error: datos.error || '',
      valores: datos.valores || {
        materia: '',
        titulo: '',
        descripcion: '',
        fechaEntrega: ''
      },
      semana
    });
    return;
  }

  const tareas = await Tarea.obtenerMuroSemana({
    estudianteId: usuario.id,
    grado: usuario.grado,
    grupo: usuario.grupo,
    semanaInicio: semana.inicio,
    semanaFin: semana.fin
  });

  res.render('estudiante-dashboard', {
    currentUser: usuario,
    tareas,
    bienvenida: datos.bienvenida || false,
    mensaje: datos.mensaje || '',
    error: datos.error || '',
    semana
  });
}

async function mostrarLogin(req, res) {
  renderLogin(res, {
    mensaje: req.query.registro === 'ok'
      ? 'Cuenta creada. Ya puedes iniciar sesion.'
      : req.query.password === 'actualizada'
        ? 'Contrasena actualizada. Ya puedes iniciar sesion.'
        : ''
  });
}

async function mostrarRecuperarContrasena(req, res) {
  res.render('recuperar-contrasena', {
    error: '',
    mensaje: ''
  });
}


async function mostrarVerificarRecuperacion(req, res) {
  res.render('verificar-recuperacion', {
    error: '',
    mensaje: ''
  });
}
async function verificarCodigoRecuperacion(req, res) {
  const codigo = normalizarTexto(req.body.codigo);

  if (!req.session.recuperacion) {
    return res.render('verificar-recuperacion', {
      error: 'La solicitud expiró. Solicita un código nuevo.',
      mensaje: ''
    });
  }

  if (!/^\d{6}$/.test(codigo)) {
    return res.render('verificar-recuperacion', {
      error: 'El código debe tener 6 dígitos.',
      mensaje: ''
    });
  }

  try {
    const codigoHash = crypto
      .createHash('sha256')
      .update(codigo)
      .digest('hex');

    const registro = await Usuario.buscarCodigoRecuperacion(
      req.session.recuperacion.usuarioId,
      codigoHash
    );

    if (!registro) {
      return res.render('verificar-recuperacion', {
        error: 'El código es incorrecto o ya fue utilizado.',
        mensaje: ''
      });
    }

    if (Number(registro.vence_en) < Date.now()) {
      return res.render('verificar-recuperacion', {
        error: 'El código venció. Solicita uno nuevo.',
        mensaje: ''
      });
    }

    req.session.recuperacion.codigoId = registro.id;
    req.session.recuperacion.verificado = true;

    return res.redirect('/cambiar-contrasena');
  } catch (error) {
    console.error(error);
    return res.status(500).render('verificar-recuperacion', {
      error: 'No fue posible verificar el código.',
      mensaje: ''
    });
  }
}

async function mostrarCambiarContrasena(req, res) {
  const recuperacion = req.session?.recuperacion;

  if (!recuperacion?.verificado || !recuperacion?.codigoId) {
    return res.redirect('/recuperar-contrasena');
  }

  return res.render('cambiar-contrasena', {
    error: '',
    mensaje: ''
  });
}

async function cambiarContrasena(req, res) {
  const contrasena = normalizarTexto(req.body.contrasena);
  const confirmarContrasena = normalizarTexto(
    req.body.confirmarContrasena
  );
  const recuperacion = req.session?.recuperacion;

  if (!recuperacion?.verificado || !recuperacion?.codigoId) {
    return res.redirect('/recuperar-contrasena');
  }

  if (contrasena.length < 8) {
    return res.status(400).render('cambiar-contrasena', {
      error: 'La contraseña debe tener al menos 8 caracteres.',
      mensaje: ''
    });
  }

  if (contrasena !== confirmarContrasena) {
    return res.status(400).render('cambiar-contrasena', {
      error: 'Las contraseñas no coinciden.',
      mensaje: ''
    });
  }

  try {
    const passwordHash = Usuario.hashPassword(contrasena);

    await Usuario.actualizarPassword(
      recuperacion.usuarioId,
      passwordHash
    );

    await Usuario.marcarCodigoRecuperacionUsado(
      recuperacion.codigoId
    );

    req.session.destroy((error) => {
      if (error) {
        console.error('Error al cerrar la sesión:', error);
      }

      return res.redirect('/?password=actualizada');
    });
  } catch (error) {
    console.error('Error al cambiar la contraseña:', error);

    return res.status(500).render('cambiar-contrasena', {
      error: 'No fue posible actualizar la contraseña. Inténtalo nuevamente.',
      mensaje: ''
    });
  }
}

async function solicitarRecuperacion(req, res) {
  const correo = normalizarCorreo(req.body.correo);

  if (!correo) {
    res.status(400).render('recuperar-contrasena', {
      error: 'Debes ingresar tu correo electrónico.',
      mensaje: ''
    });
    return;
  }

  try {
    const usuario = await Usuario.buscarPorCorreo(correo);

    if (!usuario) {
      res.render('recuperar-contrasena', {
        error: 'No encontramos una cuenta registrada con ese correo.',
        mensaje: ''
      });
      return;
    }

    const codigo = crypto.randomInt(100000, 1000000);

    // El código será válido durante 10 minutos
    const venceEn = Date.now() + 10 * 60 * 1000;

    // Guardamos una versión protegida del código
    const codigoHash = crypto
      .createHash('sha256')
      .update(String(codigo))
      .digest('hex');

    await Usuario.guardarCodigoRecuperacion(
  usuario.id,
  codigoHash,
  venceEn
);

await enviarCorreo({
  para: correo,
  asunto: 'Código de recuperación de contraseña - PLANUTOR',
  texto: `Hola ${usuario.nombre},

Recibimos una solicitud para recuperar la contraseña de tu cuenta de PLANUTOR.

Tu código de recuperación es:

${codigo}

Este código es válido durante 10 minutos y solo puede utilizarse una vez.

Si tú no solicitaste recuperar tu contraseña, puedes ignorar este mensaje.

Equipo PLANUTOR`
});

console.log(`Código de recuperación enviado a ${correo}`);

req.session.recuperacion = {
  usuarioId: usuario.id,
  correo: usuario.correo
};

res.redirect('/verificar-recuperacion');
return;

  } catch (error) {
    console.error(error);

    res.status(500).render('recuperar-contrasena', {
      error: 'No fue posible procesar la solicitud.',
      mensaje: ''
    });
  }
}

async function iniciarSesion(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  const password = normalizarTexto(req.body.password);

  if (!correo || !password) {
    renderLogin(res.status(400), { error: 'Debes ingresar correo y contrasena.' });
    return;
  }

  try {
    const usuario = await Usuario.buscarPorCorreo(correo);

    if (!usuario || !Usuario.verifyPassword(password, usuario.password_hash)) {
      renderLogin(res.status(401), { error: 'Credenciales invalidas.' });
      return;
    }
    if (!usuario.activo) {
      renderLogin(res.status(403), { error: 'Esta cuenta está desactivada. Contacta al administrador.' });
      return;
    }
        req.session.usuario = { id: usuario.id, rol: usuario.rol };

    if (req.body.recordar) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    await renderPanelUsuario(res, usuario, { bienvenida: true });
  } catch (error) {
    console.error(error);
    renderLogin(res.status(500), { error: 'No fue posible iniciar sesion.' });
  }
}

async function mostrarPanel(req, res) {
  try {
    const usuario = await Usuario.buscarPorId(req.params.userId);

    if (!usuario) {
      res.status(404).render('error', {
        titulo: 'Usuario no encontrado',
        mensaje: 'No se encontro el panel solicitado.',
        volverA: '/',
        volverTexto: 'Volver al login'
      });
      return;
    }

           const mensajes = {
      'tarea-creada': 'Tarea publicada en el muro semanal.',
      'tarea-editada': 'Tarea actualizada.',
      'tarea-eliminada': 'Tarea eliminada.',
      'estado-actualizado': 'Estado de tarea actualizado.',
      'clase-unida': 'Te uniste a la clase. Cuando el profesor publique tareas, las veras aqui.'
    };

    await renderPanelUsuario(res, usuario, {
      mensaje: mensajes[req.query.mensaje] || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', {
      titulo: 'Error de panel',
      mensaje: 'No fue posible cargar el panel del usuario.',
      volverA: '/',
      volverTexto: 'Volver al login'
    });
  }
}

async function mostrarInicio(req, res) {
  res.render('inicio');
}

async function mostrarRegistroProfesor(req, res) {
  res.render('registro-profesor', {
    error: '',
    mensaje: '',
    valores: {
      nombre: '',
      correo: '',
      area: '',
      institucion: normalizarTexto(req.query.institucion)
    }
  });
}
async function registrarProfesor(req, res) {
  const valores = valoresProfesor(req.body);
  const password = normalizarTexto(req.body.password);
  const confirmarPassword = normalizarTexto(req.body.confirmarPassword);

  if (
    !valores.nombre ||
    !valores.correo ||
    !valores.area ||
    !valores.institucion ||
    !password ||
    !confirmarPassword
  ) {
    return res.status(400).render('registro-profesor', {
      error: 'Todos los campos son obligatorios.',
      mensaje: '',
      valores
    });
  }

  const partesNombre = valores.nombre.split(/\s+/).filter(Boolean);

  if (partesNombre.length < 2) {
    return res.status(400).render('registro-profesor', {
      error: 'Escribe tu nombre completo, incluyendo al menos un nombre y un apellido.',
      mensaje: '',
      valores
    });
  }

  valores.nombre = partesNombre
    .map(
      palabra =>
        palabra.charAt(0).toUpperCase() +
        palabra.slice(1).toLowerCase()
    )
    .join(' ');

  if (!MATERIAS_PROFESOR.includes(valores.area)) {
    return res.status(400).render('registro-profesor', {
      error: 'Selecciona una materia válida de la lista.',
      mensaje: '',
      valores
    });
  }

  if (!valores.correo.endsWith('@iedeboraarango.edu.co')) {
    return res.status(400).render('registro-profesor', {
      error: 'Debes usar tu correo institucional.',
      mensaje: '',
      valores
    });
  }

  if (password !== confirmarPassword) {
    return res.status(400).render('registro-profesor', {
      error: 'Las contraseñas no coinciden.',
      mensaje: '',
      valores
    });
  }

  try {
    const existente = await Usuario.buscarPorCorreo(valores.correo);

    if (existente) {
      return res.status(409).render('registro-profesor', {
        error: 'Ya existe una cuenta con ese correo.',
        mensaje: '',
        valores
      });
    }

    await Usuario.crear({
  nombre: valores.nombre,
  correo: valores.correo,
  institucion: valores.institucion,
  materia: valores.area,
  passwordHash: Usuario.hashPassword(password),
  rol: 'profesor'
});

    res.redirect('/?registro=ok');
  } catch (error) {
    console.error(error);

    res.status(500).render('registro-profesor', {
      error: 'No fue posible registrar al profesor.',
      mensaje: '',
      valores
    });
  }
}

async function validarCodigoProfesor(req, res) {
  renderCodigoProfesor(res.status(403), {
    error: 'El registro de profesor no esta disponible. Solicita tu cuenta al administrador.'
  });
}

async function mostrarRegistroEstudiante(req, res) {
  renderRegistroEstudiante(res, {
    institucionInicial: normalizarTexto(req.query.institucion)
  });
}

async function registrarEstudiante(req, res) {
  const valores = valoresEstudiante(req.body);
  valores.nombre = normalizarNombre(valores.nombre);
  const password = normalizarTexto(req.body.password);
  const confirmarPassword = normalizarTexto(req.body.confirmarPassword);

  if (!valores.nombre || !valores.correo || !valores.institucion || !valores.nivel || !valores.grado || !valores.grupo || !password || !confirmarPassword) {
    renderRegistroEstudiante(res.status(400), {
      error: 'Todos los campos son obligatorios.',
      valores
    });
    return;
  }

  if (password !== confirmarPassword) {
    renderRegistroEstudiante(res.status(400), {
      error: 'Las contrasenas no coinciden.',
      valores
    });
    return;
  }

  try {
    const existente = await Usuario.buscarPorCorreo(valores.correo);

    if (existente) {
      renderRegistroEstudiante(res.status(409), {
        error: 'Ya existe una cuenta con ese correo.',
        valores
      });
      return;
    }

    await Usuario.crear({
      ...valores,
      passwordHash: Usuario.hashPassword(password),
      rol: 'estudiante'
    });

    res.redirect('/?registro=ok');
  } catch (error) {
    console.error(error);
    renderRegistroEstudiante(res.status(500), {
      error: 'No fue posible registrar al estudiante.',
      valores
    });
  }
}

function salir(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
}

module.exports = {
  salir,
  mostrarLogin,
  mostrarRecuperarContrasena,
  mostrarVerificarRecuperacion,
  verificarCodigoRecuperacion,
  solicitarRecuperacion,
  mostrarCambiarContrasena,
  cambiarContrasena,
  iniciarSesion,
  mostrarPanel,
  mostrarInicio,
  mostrarRegistroProfesor,
  registrarProfesor,
  validarCodigoProfesor,
  mostrarRegistroEstudiante,
  registrarEstudiante
};
