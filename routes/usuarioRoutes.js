const express = require('express');
const usuarioController = require('../controllers/usuarioController');

const router = express.Router();

router.get('/usuarios', usuarioController.listar);
router.post('/usuarios/:id/editar', usuarioController.editar);
router.post('/usuarios/:id/estado', usuarioController.cambiarEstado);
router.post('/usuarios/:id/eliminar', usuarioController.eliminar);
router.post('/instituciones', usuarioController.crearInstitucion);
router.post('/instituciones/:id/editar', usuarioController.editarInstitucion);
router.post('/instituciones/:id/eliminar', usuarioController.eliminarInstitucion);

module.exports = router;
