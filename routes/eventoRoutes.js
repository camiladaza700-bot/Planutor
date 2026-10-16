const express = require('express');
const eventoController = require('../controllers/eventoController');


const router = express.Router();

router.get('/eventos-escolares', eventoController.mostrarPagina);
router.post('/eventos-escolares', eventoController.crear);
router.post('/eventos-escolares/:id/eliminar', eventoController.eliminar);

module.exports = router;