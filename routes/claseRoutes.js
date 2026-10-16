const express = require('express');
const router = express.Router();

const claseController = require('../controllers/claseController');

router.get(
  '/clases/profesor/:profesorId',
  claseController.mostrarClasesProfesor
);

router.get(
  '/clases/profesor/:profesorId/:claseId',
  claseController.mostrarClaseProfesor
);

router.get(
  '/clases/estudiante/:estudianteId',
  claseController.mostrarAgregarClase
);

router.post(
  '/clases/profesor/:profesorId/:claseId/editar',
  claseController.editarClase
);

router.post(
  '/clases/profesor/:profesorId/:claseId/eliminar',
  claseController.eliminarClase
);

router.post(
  '/clases/profesor/:profesorId/:claseId/estudiantes/:estudianteId/retirar',
  claseController.retirarEstudiante
);

router.post(
  '/clases/crear',
  claseController.crearClase
);

router.post(
  '/clases/unirse',
  claseController.unirseAClase
);

router.post(
  '/clases/estudiante/:estudianteId/:claseId/salir',
  claseController.salirDeClase
);

module.exports = router;
