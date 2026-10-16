const Usuario = require('../models/usuarioModel');
const Recordatorio = require('../models/recordatorioModel');
const { enviarCorreo } = require('../config/correo');

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

async function obtenerRecordatorios(usuario, dias) {
  if (usuario.rol === 'profesor') {
    return Recordatorio.obtenerParaProfesor(usuario.id, dias);
  }

  if (usuario.rol === 'estudiante') {
    return Recordatorio.obtenerParaEstudiante({
      estudianteId: usuario.id,
      grado: usuario.grado,
      grupo: usuario.grupo
    }, dias);
  }

  return [];
}

async function ejecutarRecordatoriosCorreo() {
  const usuarios = await Usuario.obtenerTodos();
  const fechaEnvio = fechaHoy();

  for (const usuario of usuarios) {
    if (!['profesor', 'estudiante'].includes(usuario.rol)) {
      continue;
    }

    const preferencia = await Recordatorio.obtenerPreferencia(usuario.id);
    if (!preferencia.correo_activo) {
      continue;
    }

    const recordatorios = await obtenerRecordatorios(
      usuario,
      preferencia.dias_anticipacion
    );
    const pendientes = [];

    for (const recordatorio of recordatorios) {
      const enviado = await Recordatorio.fueEnviadoHoy(
        usuario.id,
        recordatorio.id,
        fechaEnvio
      );
      if (!enviado) {
        pendientes.push(recordatorio);
      }
    }

    if (pendientes.length === 0) {
      continue;
    }

    const detalle = pendientes
      .map(tarea => `- ${tarea.titulo} (${tarea.materia}), entrega: ${tarea.fecha_entrega}`)
      .join('\n');

    try {
      await enviarCorreo({
        para: usuario.correo,
        asunto: 'Recordatorios de tareas - PLANUTOR',
        texto: `Hola ${usuario.nombre},\n\nTienes estas tareas próximas:\n${detalle}\n\nPuedes revisar todos tus recordatorios en PLANUTOR.`
      });

      for (const recordatorio of pendientes) {
        await Recordatorio.registrarEnvio(
          usuario.id,
          recordatorio.id,
          fechaEnvio
        );
      }
    } catch (error) {
      console.error(`[RECORDATORIOS] No fue posible enviar correo a ${usuario.correo}:`, error.message);
    }
  }
}

function iniciarProgramadorRecordatorios() {
  const configurado =
    process.env.RECORDATORIOS_CORREO_ACTIVO === 'true' &&
    process.env.SMTP_HOST &&
    process.env.SMTP_FROM;

  if (!configurado) {
    console.log('[RECORDATORIOS] Correos programados desactivados. Configura RECORDATORIOS_CORREO_ACTIVO=true y SMTP para activarlos.');
    return;
  }

  ejecutarRecordatoriosCorreo().catch(error => {
    console.error('[RECORDATORIOS] Error en la ejecución inicial:', error);
  });

  setInterval(() => {
    ejecutarRecordatoriosCorreo().catch(error => {
      console.error('[RECORDATORIOS] Error en la ejecución programada:', error);
    });
  }, 24 * 60 * 60 * 1000).unref();
}

module.exports = { ejecutarRecordatoriosCorreo, iniciarProgramadorRecordatorios };
