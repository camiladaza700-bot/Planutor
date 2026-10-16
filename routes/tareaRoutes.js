const express = require('express');
const tareaController = require('../controllers/tareaController');

const router = express.Router();

router.get('/tareas/:userId', tareaController.listar);
router.post('/profesor/tareas', tareaController.crear);
router.post('/profesor/tareas/:tareaId/editar', tareaController.editar);
router.post('/profesor/tareas/:tareaId/eliminar', tareaController.eliminar);
router.post('/estudiante/tareas/:tareaId/estado', tareaController.actualizarEstado);

module.exports = router;
