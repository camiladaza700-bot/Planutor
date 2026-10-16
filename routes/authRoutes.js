
const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/', authController.mostrarLogin);
router.post('/login', authController.iniciarSesion);
router.get('/panel/:userId', authController.mostrarPanel);

router.get('/inicio', authController.mostrarInicio);

router.get('/registro-profesor', authController.mostrarRegistroProfesor);
router.post('/registro-profesor', authController.registrarProfesor);

router.get('/registro-estudiante', authController.mostrarRegistroEstudiante);
router.post('/registro-estudiante', authController.registrarEstudiante);

router.get('/recuperar-contrasena', authController.mostrarRecuperarContrasena);
router.post('/recuperar-contrasena', authController.solicitarRecuperacion);

router.get('/verificar-recuperacion', authController.mostrarVerificarRecuperacion);
router.post('/verificar-recuperacion', authController.verificarCodigoRecuperacion);

router.get(
  '/cambiar-contrasena',
  authController.mostrarCambiarContrasena
);

router.post(
  '/cambiar-contrasena',
  authController.cambiarContrasena
);

module.exports = router;
