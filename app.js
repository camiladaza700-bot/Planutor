
const path = require('path');

// Carga secretos y configuración local antes de iniciar cualquier servicio.
require('dotenv').config({
  path: path.join(__dirname, '.env')
});


const express = require('express');
const session = require('express-session');

const { port } = require('./config/env');

const { soloRol, soloYo, soloLogueado } = require('./middlewares/seguridad');
const { salir } = require('./controllers/authController');

require('./config/db');

const authRoutes = require('./routes/authRoutes');
const tareaRoutes = require('./routes/tareaRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const notaRoutes = require('./routes/notaRoutes');
const recordatorioRoutes = require('./routes/recordatorioRoutes');
const eventoRoutes = require('./routes/eventoRoutes');
const iaRoutes = require('./routes/iaRoutes');
const EventoEscolar = require('./models/eventoModel');
const Planeador = require('./models/planeadorModel');
const { iniciarProgramadorRecordatorios } = require('./services/recordatorioService');

const planeadorRoutes = require('./routes/planeadorRoutes');
const claseRoutes = require('./routes/claseRoutes');
const perfilRoutes = require('./routes/perfilRoutes');


const app = express();

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET es obligatoria en producción.');
}

// La sesión guarda únicamente la identidad del usuario entre solicitudes.
app.use(session({
  secret: process.env.SESSION_SECRET || 'planutor-clave-temporal',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 2 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }

}));

// Estos datos quedan disponibles automáticamente en todas las vistas EJS.
app.use((req, res, next) => {
  res.locals.currentUser = req.session.usuario || null;
  res.locals.currentPath = req.path;
  next();
});

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

// Las vistas existentes usan esta URL para el tema compartido.
app.get('/css/tema.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'estilos.css'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Evita que alguien cambie un ID en la URL para consultar datos de otra persona.
app.use('/panel/:userId', soloYo('userId'));
app.use('/planeador/:userId', soloYo('userId'));
app.use('/tareas/:userId', soloYo('userId'));
app.use('/perfil/:userId', soloYo('userId'));

app.use('/clases/profesor/:profesorId', soloRol('profesor'), soloYo('profesorId'));
app.use('/clases/estudiante/:estudianteId', soloRol('estudiante'), soloYo('estudianteId'));
app.post('/clases/crear', soloRol('profesor'), soloYo('profesorId'));
app.post('/clases/unirse', soloRol('estudiante'), soloYo('estudianteId'));

app.post('/profesor/tareas', soloRol('profesor'), soloYo('profesorId'));
app.use('/profesor/tareas/:tareaId', soloRol('profesor'));
app.post('/estudiante/tareas/:tareaId/estado', soloRol('estudiante'), soloYo('estudianteId'));

// Las operaciones de administración solo pueden ser ejecutadas por administradores.
app.use('/usuarios', soloRol('administrador'));
app.use('/instituciones', soloRol('administrador'));
app.use('/calendario/notas', soloYo('usuarioId'));
app.use('/recordatorios', soloYo('usuarioId'));
app.use('/recordatorios/:userId', soloYo('userId'));
app.post('/eventos-escolares', soloYo('usuarioId'));
app.post('/eventos-escolares/:id/eliminar', soloYo('usuarioId'));

app.get('/salir', salir);


app.use(authRoutes);

app.use(tareaRoutes);

app.use(usuarioRoutes);

app.use(notaRoutes);

app.use(recordatorioRoutes);

app.use(eventoRoutes);
// La IA conserva conversaciones por usuario, por eso siempre exige una sesión válida.
app.use('/ia', soloLogueado, iaRoutes);

app.use('/planeador', planeadorRoutes);
app.use(claseRoutes);
app.use(perfilRoutes);

// Inicia una sola vez el proceso que revisa y envía recordatorios pendientes.
iniciarProgramadorRecordatorios();


app.get('/', (req, res) => {

  res.render('index');

});


app.get('/inicio-estudiante', soloRol('estudiante'), (req, res) => {

  res.render('inicio-estudiante');

});


// El calendario combina eventos institucionales con anotaciones personales.
app.get('/calendario', async (req, res) => {
  const personaje = req.session.usuario?.rol || req.query.personaje || 'estudiante';
  const currentUserId = req.session.usuario?.id || null;

  try {
    const [eventos, anotacionesPlaneador] = await Promise.all([
      EventoEscolar.obtenerTodos(),
      currentUserId
        ? Planeador.obtenerPorUsuario(currentUserId)
        : Promise.resolve([])
    ]);

    res.render('calendario', {
      personaje,
      eventos,
      anotacionesPlaneador,
      currentUserId
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', {
      titulo: 'Error de calendario',
      mensaje: 'No fue posible cargar los eventos escolares.',
      volverA: currentUserId ? `/panel/${currentUserId}` : '/',
      volverTexto: 'Volver al inicio'
    });
  }
});



app.get('/presentacion', (req, res) => {

  const personaje = req.query.personaje || 'estudiante';

  const perfil = personaje === 'profesor'
    ? {
        nombre: 'Profesor Juan Pérez',
        cargo: 'Profesor de Matemáticas',
        descripcion: 'Apasionado por la enseñanza y el análisis.'
      }
    : {
        nombre: 'Estudiante Ana Gómez',
        grado: 'Ingeniería',
        descripcion: 'Interesada en sistemas y algoritmos.'
      };

  res.render('presentacion', {
    personaje,
    perfil
  });

});


app.get('/tareas', (req, res) => {
  if (!req.session.usuario) {
    return res.redirect('/');
  }

  return res.redirect(`/tareas/${req.session.usuario.id}`);
});


app.use((req, res) => {

  res.status(404).render('error', {
    titulo: 'Ruta no encontrada',
    mensaje: 'La pagina solicitada no existe.',
    volverA: '/',
    volverTexto: 'Volver al inicio'
  });

});

app.listen(port, () => {

  console.log(
    `Servidor ejecutandose en http://localhost:${port}`
  );

});
