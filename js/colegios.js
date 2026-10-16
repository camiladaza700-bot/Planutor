// Lista curada de colegios conocidos de Medellin (publicos y privados).
// No es la lista oficial completa de la Secretaria de Educacion de Medellin.
const COLEGIOS_MEDELLIN = [
  'IE Lucrecio Jaramillo Velez',
  'IE Sor Juana Ines de la Cruz',
  'IE Pedro Justo Berrio',
  'IE Fe y Alegria',
  'IE Jose Miguel de Restrepo y Puerta',
  'IE INEM Jose Felix de Restrepo',
  'IE Javiera Londono',
  'IE San Francisco de Asis',
  'IE Debora Arango Perez',
  'IE Concejo de Medellin',
  'Colegio Corazonista',
  'Colegio San Jose de las Vegas',
  'Colegio Teresiano',
  'The Columbus School',
  'Colegio Aleman - Theodoro Hertzel',
  'Colegio Marymount',
  'Colegio Montessori',
  'Colegio Calasanz',
  'Colegio San Ignacio',
  'Colegio Champagnat',
  'Colegio La Enseñanza',
  'Colegio Hontanares',
  'Gimnasio Los Alcazares',
  'Gimnasio Vermont',
  'Liceo Salazar y Herrera',
  'Instituto Jorge Robledo',
  'Colegio Santa Maria del Rosario',
  'Colegio de la UPB',
  'Colegio Loyola para la Ciencia y la Innovacion',
  'Colegio Gimnasio Los Portales'
];

function initAutocompleteColegio({ inputId, hiddenId, listId, onSeleccion }) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  const lista = document.getElementById(listId);

  if (!input || !hidden || !lista) {
    return;
  }

  function seleccionar(nombre) {
    input.value = nombre;
    hidden.value = nombre;
    lista.style.display = 'none';

    if (typeof onSeleccion === 'function') {
      onSeleccion(nombre);
    }
  }

  function render(filtro) {
    const texto = filtro.trim();
    const textoLower = texto.toLowerCase();

    const resultados = textoLower === ''
      ? []
      : COLEGIOS_MEDELLIN.filter((nombre) => nombre.toLowerCase().includes(textoLower)).slice(0, 8);

    lista.innerHTML = '';

    resultados.forEach((nombre) => {
      const item = document.createElement('div');
      item.className = 'opcion-colegio';
      item.textContent = nombre;
      item.addEventListener('click', () => seleccionar(nombre));
      lista.appendChild(item);
    });

    const coincideExacto = COLEGIOS_MEDELLIN.some((nombre) => nombre.toLowerCase() === textoLower);

    if (texto !== '' && !coincideExacto) {
      const otro = document.createElement('div');
      otro.className = 'opcion-colegio opcion-otro';
      otro.textContent = 'Usar "' + texto + '" (no esta en la lista)';
      otro.addEventListener('click', () => seleccionar(texto));
      lista.appendChild(otro);
    }

    lista.style.display = (resultados.length > 0 || texto !== '') ? 'block' : 'none';
  }

  input.addEventListener('input', () => {
    hidden.value = '';
    render(input.value);
  });

  input.addEventListener('focus', () => {
    if (input.value) {
      render(input.value);
    }
  });

  document.addEventListener('click', (evento) => {
    if (evento.target !== input && !lista.contains(evento.target)) {
      lista.style.display = 'none';
    }
  });
}