require('dotenv').config();

const { enviarCorreo } = require('./config/correo');

console.log(' Intentando enviar correo...');

enviarCorreo({
  para: process.env.SMTP_FROM,
  asunto: 'Prueba de PLANUTOR',
  texto: '¡Hola! Este es un correo de prueba enviado por PLANUTOR.'
})
  .then(() => {
    console.log('Correo enviado correctamente.');
    process.exit(0);
  })
  .catch(error => {
    console.error('No se pudo enviar el correo.');
    console.error(error.message);
    process.exit(1);
  });