const express = require('express');
const recordatorioController = require('../controllers/recordatorioController');

const router = express.Router();

router.get('/recordatorios', recordatorioController.listar);
router.get('/recordatorios/:userId', recordatorioController.mostrarPagina);
router.post('/recordatorios/:userId/configuracion', recordatorioController.guardarConfiguracion);

module.exports = router;
