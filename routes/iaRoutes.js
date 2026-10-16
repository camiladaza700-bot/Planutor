const express = require('express');

const iaController = require('../controllers/iaController');

const router = express.Router();

router.post('/preguntar', iaController.responderPregunta);
router.get('/conversaciones', iaController.listarConversaciones);
router.get('/conversaciones/:id', iaController.obtenerConversacion);
router.delete('/conversaciones/:id', iaController.eliminarConversacion);
router.get('/estado', iaController.estado);

module.exports = router;
