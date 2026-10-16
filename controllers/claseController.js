const Clase = require('../models/claseModel');
const Usuario = require('../models/usuarioModel');

function textoLimpio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

async function obtenerClaseDelProfesor(profesorId, claseId) {
  return Clase.buscarPorIdYProfesor(claseId, profesorId);
}

const claseController = {
      async mostrarAgregarClase(req, res) {
    try {
      const estudianteId = Number(req.params.estudianteId);

      const estudiante = await Usuario.buscarPorId(estudianteId);

      if (!estudiante || estudiante.rol !== 'estudiante') {
        return res.status(403).send('Acceso no permitido.');
      }

      const clases = await Clase.obtenerPorEstudiante(estudianteId);

      res.render('agregar-clase', {
        estudiante,
        clases,
        mensaje: req.query.mensaje || '',
        error: req.query.error || ''
      });
    } catch (error) {
      console.error('Error al mostrar agregar clase:', error);
      res.status(500).send('No se pudo cargar la página.');
    }
  },
  async crearClase(req, res) {
    try {
      const profesorId = Number(req.body.profesorId);
      const nombre = textoLimpio(req.body.nombre);
      const grado = textoLimpio(req.body.grado);

      if (!profesorId || !nombre || !grado) {
        return res.redirect(`/clases/profesor/${profesorId}?error=El+nombre+y+el+grado+son+obligatorios.`);
      }

      const profesor = await Usuario.buscarPorId(profesorId);

      if (!profesor || profesor.rol !== 'profesor') {
        return res.status(403).send('Solo un profesor puede crear una clase.');
      }

      await Clase.crear({
        profesorId,
        nombre,
        grado
      });

      res.redirect(`/clases/profesor/${profesorId}?mensaje=Clase+creada.`);
    } catch (error) {
      console.error('Error al crear clase:', error);
      res.status(500).send('No se pudo crear la clase.');
    }
  },

  async mostrarClasesProfesor(req, res) {
    try {
      const profesorId = Number(req.params.profesorId);

      const profesor = await Usuario.buscarPorId(profesorId);

      if (!profesor || profesor.rol !== 'profesor') {
        return res.status(403).send('Acceso no permitido.');
      }

      const clases = await Clase.obtenerPorProfesor(profesorId);

      res.render('clases-profesor', {
        profesor,
        clases,
        mensaje: req.query.mensaje || '',
        error: req.query.error || ''
      });
    } catch (error) {
      console.error('Error al mostrar clases:', error);
      res.status(500).send('No se pudieron cargar las clases.');
    }
  },

  async unirseAClase(req, res) {
    try {
      const { estudianteId, codigo } = req.body;

      if (!estudianteId || !codigo) {
        return res.status(400).send('Debes ingresar el código de la clase.');
      }

      const estudiante = await Usuario.buscarPorId(estudianteId);

      if (!estudiante || estudiante.rol !== 'estudiante') {
        return res.status(403).send('Solo un estudiante puede unirse a una clase.');
      }

      const clase = await Clase.buscarPorCodigo(codigo.trim().toUpperCase());

      if (!clase) {
        return res.status(404).send('El código de la clase no existe.');
      }

      const resultado = await Clase.agregarEstudiante(clase.id, estudianteId);

      const mensaje = resultado.changes
        ? 'Te uniste a la clase.'
        : 'Ya estabas inscrito en esta clase.';
      res.redirect(`/clases/estudiante/${estudianteId}?mensaje=${encodeURIComponent(mensaje)}`);
    } catch (error) {
      console.error('Error al unirse a clase:', error);
      res.status(500).send('No se pudo unir a la clase.');
    }
  },
async mostrarClaseProfesor(req, res) {
    try {
      const profesorId = Number(req.params.profesorId);
      const claseId = Number(req.params.claseId);

      const profesor = await Usuario.buscarPorId(profesorId);

      if (!profesor || profesor.rol !== 'profesor') {
        return res.status(403).send('Acceso no permitido.');
      }

      const clase = await obtenerClaseDelProfesor(profesorId, claseId);

      if (!clase) {
        return res.status(403).send('No tienes acceso a esta clase.');
      }

      const estudiantes = await Clase.obtenerEstudiantes(claseId);

      res.render('clase-profesor', {
        profesor,
        clase,
        estudiantes,
        mensaje: req.query.mensaje || '',
        error: req.query.error || ''
      });
    } catch (error) {
      console.error('Error al mostrar la clase:', error);
      res.status(500).send('No se pudo cargar la clase.');
    }
  },

  async editarClase(req, res) {
    try {
      const profesorId = Number(req.params.profesorId);
      const claseId = Number(req.params.claseId);
      const nombre = textoLimpio(req.body.nombre);
      const grado = textoLimpio(req.body.grado);
      const volver = `/clases/profesor/${profesorId}/${claseId}`;

      if (!nombre || !grado) {
        return res.redirect(`${volver}?error=El+nombre+y+el+grado+son+obligatorios.`);
      }

      const clase = await obtenerClaseDelProfesor(profesorId, claseId);
      if (!clase) {
        return res.status(403).send('No tienes acceso a esta clase.');
      }

      await Clase.actualizar(claseId, profesorId, { nombre, grado });
      res.redirect(`${volver}?mensaje=Clase+actualizada.`);
    } catch (error) {
      console.error('Error al editar clase:', error);
      res.status(500).send('No se pudo actualizar la clase.');
    }
  },

  async eliminarClase(req, res) {
    try {
      const profesorId = Number(req.params.profesorId);
      const claseId = Number(req.params.claseId);
      const clase = await obtenerClaseDelProfesor(profesorId, claseId);

      if (!clase) {
        return res.status(403).send('No tienes acceso a esta clase.');
      }

      await Clase.eliminar(claseId, profesorId);
      res.redirect(`/clases/profesor/${profesorId}?mensaje=Clase+eliminada+y+tareas+asociadas+eliminadas.`);
    } catch (error) {
      console.error('Error al eliminar clase:', error);
      res.status(500).send('No se pudo eliminar la clase.');
    }
  },

  async retirarEstudiante(req, res) {
    try {
      const profesorId = Number(req.params.profesorId);
      const claseId = Number(req.params.claseId);
      const estudianteId = Number(req.params.estudianteId);
      const clase = await obtenerClaseDelProfesor(profesorId, claseId);

      if (!clase) {
        return res.status(403).send('No tienes acceso a esta clase.');
      }

      const resultado = await Clase.retirarEstudiante(claseId, estudianteId);
      const mensaje = resultado.changes
        ? 'Estudiante retirado.'
        : 'El estudiante ya no pertenecía a esta clase.';
      res.redirect(`/clases/profesor/${profesorId}/${claseId}?mensaje=${encodeURIComponent(mensaje)}`);
    } catch (error) {
      console.error('Error al retirar estudiante:', error);
      res.status(500).send('No se pudo retirar al estudiante.');
    }
  },

  async salirDeClase(req, res) {
    try {
      const estudianteId = Number(req.params.estudianteId);
      const claseId = Number(req.params.claseId);

      if (!await Clase.esEstudianteDeClase(claseId, estudianteId)) {
        return res.status(404).send('No perteneces a esta clase.');
      }

      await Clase.retirarEstudiante(claseId, estudianteId);
      res.redirect(`/clases/estudiante/${estudianteId}?mensaje=Saliste+de+la+clase.`);
    } catch (error) {
      console.error('Error al salir de clase:', error);
      res.status(500).send('No se pudo salir de la clase.');
    }
  }
};

module.exports = claseController;
