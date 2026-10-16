const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function enviarCorreo({ para, asunto, texto }) {
  return transporter.sendMail({
    from: `"PLANUTOR" <${process.env.SMTP_FROM}>`,
    to: para,
    subject: asunto,
    text: texto
  });
}

module.exports = {
  enviarCorreo
};
