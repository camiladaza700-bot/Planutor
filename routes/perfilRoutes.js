const express = require('express');
const perfilController = require('../controllers/perfilController');

const router = express.Router();

router.get('/perfil/:userId', perfilController.mostrar);
router.post('/perfil/:userId', perfilController.actualizarDatos);
router.post('/perfil/:userId/contrasena', perfilController.cambiarContrasena);

module.exports = router;
