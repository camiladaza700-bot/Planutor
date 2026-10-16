// Controlador del Asistente IA (Google Gemini)
// Usa fetch nativo de Node 18+ contra la API REST de Gemini.
// No depende del SDK @google/generative-ai.
const IA = require('../models/iaModel');
const Usuario = require('../models/usuarioModel');

// Se intenta el modelo recomendado y, si está ocupado, un respaldo compatible.
const MODELOS = [
  'gemini-3.8-flash',
  'gemini-3-flash-preview'
];

const API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

// Instrucciones para que la IA responda como tutor escolar
const INSTRUCCIONES =
  'Eres el asistente academico de PLANUTOR, una plataforma escolar. ' +
  'Respondes a estudiantes de colegio en espanol, de forma clara, breve ' +
  'y con ejemplos sencillos. Si te preguntan algo que no es academico, ' +
  'responde igual pero de manera corta y apropiada para un colegio. ' +
  'No uses formato markdown con asteriscos, escribe texto plano.';

// Límite por persona para cuidar la cuota gratuita de la API.
const LIMITE_DIARIO = Number(process.env.IA_LIMITE_DIARIO || 20);

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

function contextoUsuario(usuario) {
  // El contexto hace que las respuestas se adapten al grado y al rol, sin exponer la contraseña.
  const datos = [
    `Nombre: ${usuario.nombre}.`,
    `Rol: ${usuario.rol}.`,
    usuario.institucion ? `Institución: ${usuario.institucion}.` : '',
    usuario.rol === 'estudiante'
      ? `Nivel: ${usuario.nivel || 'sin especificar'}, grado: ${usuario.grado || 'sin especificar'}, grupo: ${usuario.grupo || 'sin especificar'}.`
      : ''
  ].filter(Boolean).join(' ');

  return ` Contexto de la persona a quien ayudas: ${datos}`;
}

function revisarClave() {
  const clave = (process.env.GEMINI_API_KEY || '').trim();

  if (!clave || clave === 'tu_clave') {
    return {
      ok: false,
      mensaje:
        'Configura GEMINI_API_KEY en el archivo .env de la carpeta Planutor ' +
        'con tu clave real de Google AI Studio.'
    };
  }

  // No comprobamos que empiece por "AIza".
  // Google puede proporcionar claves con otros formatos.
  return {
    ok: true,
    clave
  };
}

async function llamarGemini(clave, modelo, pregunta, usuario, historial) {
  // Se manda el historial reciente para que la conversación tenga continuidad.
  const url = `${API_BASE}/${modelo}:generateContent?key=${clave}`;

  const cuerpo = {
    // Estas instrucciones se aplican a toda la conversación y definen el papel del asistente.
    systemInstruction: {
      parts: [{ text: INSTRUCCIONES + contextoUsuario(usuario) }]
    },
    contents: [
      ...historial.map(mensaje => ({
        role: mensaje.rol === 'asistente' ? 'model' : 'user',
        parts: [{ text: mensaje.contenido }]
      })),
      {
        role: 'user',
        parts: [{ text: pregunta }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800
    }
  };

  // Corta la espera a 30 segundos para que la pagina no se quede colgada
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 30000);

  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cuerpo),
      signal: control.signal
    });

    const datos = await respuesta.json().catch(() => ({}));

    return {
      estado: respuesta.status,
      datos
    };
  } finally {
    clearTimeout(reloj);
  }
}

function extraerTexto(datos) {
  const candidato =
    datos && datos.candidates && datos.candidates[0];

  if (!candidato) {
    return '';
  }

  const partes =
    (candidato.content && candidato.content.parts) || [];

  return partes
    .map((p) => p.text || '')
    .join('')
    .trim();
}

async function responderPregunta(req, res) {
  try {
    const pregunta = (
      req.body && req.body.pregunta
        ? req.body.pregunta
        : ''
    ).trim();

    if (!pregunta) {
      return res.status(400).json({
        error: 'Escribe una pregunta'
      });
    }

    if (pregunta.length > 2000) {
      return res.status(400).json({
        error:
          'La pregunta es demasiado larga (maximo 2000 caracteres).'
      });
    }

    const usuario = await Usuario.buscarPorId(req.session.usuario.id);
    if (!usuario) {
      return res.status(401).json({ error: 'La sesión no es válida.' });
    }

    const fecha = fechaHoy();
    const uso = await IA.usosHoy(usuario.id, fecha);
    if (Number(uso?.solicitudes || 0) >= LIMITE_DIARIO) {
      return res.status(429).json({
        error: `Alcanzaste el límite diario de ${LIMITE_DIARIO} consultas. Intenta de nuevo mañana.`,
        limiteAlcanzado: true
      });
    }

    let conversacionId = Number(req.body.conversacionId) || null;
    let historial = [];
    if (conversacionId) {
      const conversacion = await IA.buscarConversacion(conversacionId, usuario.id);
      if (!conversacion) {
        return res.status(403).json({ error: 'No tienes acceso a esta conversación.' });
      }
      historial = await IA.obtenerMensajes(conversacionId);
    }

    const revision = revisarClave();

    if (!revision.ok) {
      console.error(
        '[IA] Problema con la clave:',
        revision.mensaje
      );

      return res.status(500).json({
        error: revision.mensaje
      });
    }

    let ultimoError = 'Error desconocido de Gemini';

    for (const modelo of MODELOS) {
      let salida;

      try {
        salida = await llamarGemini(
          revision.clave,
          modelo,
          pregunta,
          usuario,
          historial
        );
      } catch (e) {
        if (e.name === 'AbortError') {
          ultimoError =
            'La IA tardo demasiado en responder. Intenta de nuevo.';
        } else {
          ultimoError =
            'No hay conexion a internet o Google no responde. Revisa tu red.';
        }

        console.error(
          '[IA] Fallo de red con',
          modelo,
          '->',
          e.message
        );

        continue;
      }

      const { estado, datos } = salida;

      if (estado === 200) {
        const texto = extraerTexto(datos);

        if (texto) {
          if (!conversacionId) {
            const creada = await IA.crearConversacion(
              usuario.id,
              pregunta.slice(0, 80)
            );
            conversacionId = creada.id;
          }

          await IA.guardarIntercambio(conversacionId, pregunta, texto);
          await IA.registrarUso(usuario.id, fecha);

          return res.json({
            respuesta: texto,
            modelo,
            conversacionId,
            restantes: Math.max(0, LIMITE_DIARIO - Number(uso?.solicitudes || 0) - 1)
          });
        }

        const motivo =
          (datos.candidates &&
            datos.candidates[0] &&
            datos.candidates[0].finishReason) ||
          (datos.promptFeedback &&
            datos.promptFeedback.blockReason) ||
          '';

        ultimoError =
          motivo === 'SAFETY' ||
          motivo === 'PROHIBITED_CONTENT'
            ? 'La IA no puede responder esa pregunta. Intenta con otra.'
            : 'La IA devolvio una respuesta vacia. Intenta reformular la pregunta.';

        console.error(
          '[IA] Respuesta vacia de',
          modelo,
          JSON.stringify(datos)
        );

        continue;
      }

      const detalle =
        (datos.error && datos.error.message) ||
        `HTTP ${estado}`;

      console.error(
        '[IA]',
        modelo,
        'respondio',
        estado,
        '->',
        detalle
      );

      // 404 = ese modelo no existe para esta clave.
      // Probamos el siguiente.
      if (estado === 404) {
        ultimoError =
          'Ningun modelo de Gemini esta disponible para tu clave.';

        continue;
      }

      if (
        estado === 400 &&
        /API key not valid|API_KEY_INVALID/i.test(detalle)
      ) {
        return res.status(500).json({
          error:
            'La clave de Gemini no es valida. Verifica la clave en Google AI Studio y el archivo .env.'
        });
      }

      if (estado === 403) {
        return res.status(500).json({
          error:
            'Google rechazo la clave (403). Verifica que la API de Gemini este habilitada para tu proyecto.'
        });
      }

      if (estado === 429) {
        return res.status(429).json({
          error:
            'Se agoto la cuota gratuita de Gemini. Espera un momento e intenta de nuevo.'
        });
      }

      if (estado >= 500) {
        ultimoError =
          'El servidor de Google esta fallando. Intenta en unos minutos.';

        continue;
      }

      ultimoError = detalle;
      break;
    }

    return res.status(500).json({
      error: ultimoError
    });
  } catch (error) {
    console.error(
      '[IA] ERROR INESPERADO:',
      error
    );

    return res.status(500).json({
      error:
        'Error interno del servidor al consultar la IA.'
    });
  }
}

async function listarConversaciones(req, res) {
  try {
    const conversaciones = await IA.obtenerConversaciones(req.session.usuario.id);
    const uso = await IA.usosHoy(req.session.usuario.id, fechaHoy());
    return res.json({
      conversaciones,
      restantes: Math.max(0, LIMITE_DIARIO - Number(uso?.solicitudes || 0)),
      limite: LIMITE_DIARIO
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No fue posible cargar las conversaciones.' });
  }
}

async function obtenerConversacion(req, res) {
  try {
    const id = Number(req.params.id);
    const conversacion = await IA.buscarConversacion(id, req.session.usuario.id);
    if (!conversacion) return res.status(404).json({ error: 'Conversación no encontrada.' });
    const mensajes = await IA.obtenerMensajes(id, 100);
    return res.json({ conversacion, mensajes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No fue posible cargar la conversación.' });
  }
}

async function eliminarConversacion(req, res) {
  try {
    const resultado = await IA.eliminarConversacion(
      Number(req.params.id),
      req.session.usuario.id
    );
    if (!resultado.changes) return res.status(404).json({ error: 'Conversación no encontrada.' });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No fue posible eliminar la conversación.' });
  }
}

// Ruta de diagnostico: GET /ia/estado
async function estado(req, res) {
  const revision = revisarClave();

  if (!revision.ok) {
    return res.status(500).json({
      ok: false,
      mensaje: revision.mensaje
    });
  }

  try {
    const r = await fetch(
      `${API_BASE}?key=${revision.clave}`
    );

    const datos = await r.json().catch(() => ({}));

    if (r.status !== 200) {
      return res.status(500).json({
        ok: false,
        mensaje:
          (datos.error && datos.error.message) ||
          `HTTP ${r.status}`
      });
    }

    const disponibles = (datos.models || [])
      .map((m) =>
        String(m.name).replace('models/', '')
      )
      .filter((n) =>
        n.startsWith('gemini')
      );

    return res.json({
      ok: true,
      mensaje: 'La clave funciona correctamente.',
      modelosDisponibles: disponibles
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje:
        'No hay conexion a internet con Google: ' +
        e.message
    });
  }
}

module.exports = {
  responderPregunta,
  estado,
  listarConversaciones,
  obtenerConversacion,
  eliminarConversacion
};
