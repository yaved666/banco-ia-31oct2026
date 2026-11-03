/* Ferretería La Esquina — comportamiento de la página (sin dependencias) */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ---------- Menú móvil ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');

  function setMenu(open, returnFocus) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    if (!open && returnFocus) toggle.focus();
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // Cerrar al elegir un enlace
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    // Cerrar con Escape y devolver el foco al botón
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setMenu(false, true);
    });
    // Cerrar al hacer clic fuera
    document.addEventListener('click', function (e) {
      if (toggle.getAttribute('aria-expanded') === 'true' && !e.target.closest('.site-header')) setMenu(false);
    });
  }

  /* ---------- Horario: estado abierto/cerrado y día actual ---------- */
  // Franjas en minutos desde medianoche, por día de la semana (0 = domingo)
  var SCHEDULE = {
    0: [],
    1: [[540, 840], [1020, 1230]],
    2: [[540, 840], [1020, 1230]],
    3: [[540, 840], [1020, 1230]],
    4: [[540, 840], [1020, 1230]],
    5: [[540, 840], [1020, 1230]],
    6: [[570, 840]]
  };

  function fmt(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + ':' + (m < 10 ? '0' : '') + m;
  }

  function openStatus(date) {
    var day = date.getDay();
    var now = date.getHours() * 60 + date.getMinutes();
    var slots = SCHEDULE[day];
    for (var i = 0; i < slots.length; i++) {
      if (now >= slots[i][0] && now < slots[i][1]) {
        return { open: true, text: 'Abierto ahora · cierra a las ' + fmt(slots[i][1]) };
      }
    }
    for (var j = 0; j < slots.length; j++) {
      if (now < slots[j][0]) return { open: false, text: 'Cerrado ahora · abre hoy a las ' + fmt(slots[j][0]) };
    }
    return { open: false, text: 'Cerrado ahora' };
  }

  function renderHours() {
    var date = new Date();
    var el = document.getElementById('open-status');
    var st = openStatus(date);
    if (el) {
      el.textContent = st.text;
      el.classList.toggle('is-open', st.open);
      el.classList.toggle('is-closed', !st.open);
    }
    var today = String(date.getDay());
    document.querySelectorAll('.hours tr[data-days]').forEach(function (tr) {
      tr.classList.toggle('is-today', tr.getAttribute('data-days').split(',').indexOf(today) !== -1);
    });
  }
  renderHours();
  setInterval(renderHours, 60 * 1000);

  // Exponer para pruebas automáticas
  window.__ferreteria = { openStatus: openStatus };

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Formulario de contacto ---------- */
  var form = document.getElementById('contact-form');
  if (!form) return;

  var summary = document.getElementById('form-summary');
  var confirmation = document.getElementById('confirmation');
  var confirmationText = document.getElementById('confirmation-text');
  var newMessage = document.getElementById('new-message');
  var mensaje = form.elements.mensaje;
  var counter = document.getElementById('mensaje-count');

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_RE = /^(\+34|0034)?[6789]\d{8}$/;

  var LABELS = {
    nombre: 'Nombre',
    email: 'Correo electrónico',
    telefono: 'Teléfono',
    motivo: 'Motivo',
    mensaje: 'Mensaje',
    privacidad: 'Privacidad'
  };

  var validators = {
    nombre: function (v) {
      v = v.trim();
      if (!v) return 'Escribe tu nombre.';
      if (v.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
      if (!/^[\p{L}\s'’.-]+$/u.test(v)) return 'El nombre solo puede contener letras, espacios, apóstrofos y guiones.';
      return '';
    },
    email: function (v) {
      v = v.trim();
      if (!v) return 'Escribe tu correo electrónico.';
      if (!EMAIL_RE.test(v)) return 'El correo no parece válido. Ejemplo: nombre@correo.es';
      return '';
    },
    telefono: function (v) {
      var clean = v.replace(/[\s().-]/g, '');
      if (!clean) return '';
      if (!PHONE_RE.test(clean)) return 'El teléfono debe tener 9 dígitos y empezar por 6, 7, 8 o 9 (prefijo +34 opcional).';
      return '';
    },
    motivo: function (v) {
      return v ? '' : 'Elige el motivo de tu consulta.';
    },
    mensaje: function (v) {
      v = v.trim();
      if (!v) return 'Escribe tu mensaje.';
      if (v.length < 10) return 'El mensaje es demasiado corto (mínimo 10 caracteres; llevas ' + v.length + ').';
      if (v.length > 1000) return 'El mensaje es demasiado largo (máximo 1000 caracteres).';
      return '';
    },
    privacidad: function (_v, el) {
      return el.checked ? '' : 'Debes aceptar el uso de tus datos para que podamos responderte.';
    }
  };

  function validateField(name) {
    var el = form.elements[name];
    var msg = validators[name](el.value, el);
    var errEl = document.getElementById(name + '-error');
    errEl.textContent = msg;
    if (msg) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
    return msg;
  }

  // Validación en vivo: al salir del campo, y al escribir si ya tenía error
  Object.keys(validators).forEach(function (name) {
    var el = form.elements[name];
    var touched = false;
    el.addEventListener('blur', function () {
      // No mostrar error al tabular por un campo vacío que aún no se ha tocado
      if (touched || el.value) { touched = true; validateField(name); }
    });
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () {
      touched = true;
      if (el.getAttribute('aria-invalid') === 'true' || el.type === 'checkbox' || el.tagName === 'SELECT') validateField(name);
    });
  });

  // Desplaza teniendo en cuenta la cabecera fija (que taparía el elemento)
  function scrollIntoViewBelowHeader(el) {
    var header = document.querySelector('.site-header');
    var offset = (header ? header.offsetHeight : 0) + 16;
    var top = el.getBoundingClientRect().top + window.pageYOffset - offset;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
  }
  function focusField(el) {
    el.focus({ preventScroll: true });
    // La etiqueta queda visible encima del campo
    var label = form.querySelector('label[for="' + el.id + '"]');
    scrollIntoViewBelowHeader(label && el.type !== 'checkbox' ? label : el);
  }

  function updateCounter() { counter.textContent = String(mensaje.value.length); }
  mensaje.addEventListener('input', updateCounter);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errors = [];
    Object.keys(validators).forEach(function (name) {
      var msg = validateField(name);
      if (msg) errors.push({ name: name, msg: msg });
    });

    if (errors.length) {
      summary.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = errors.length === 1
        ? 'Hay 1 campo por revisar:'
        : 'Hay ' + errors.length + ' campos por revisar:';
      var ul = document.createElement('ul');
      errors.forEach(function (err) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + form.elements[err.name].id;
        a.textContent = LABELS[err.name] + ': ' + err.msg;
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          focusField(form.elements[err.name]);
        });
        li.appendChild(a);
        ul.appendChild(li);
      });
      summary.appendChild(p);
      summary.appendChild(ul);
      summary.hidden = false;
      summary.focus({ preventScroll: true });
      scrollIntoViewBelowHeader(summary);
      return;
    }

    summary.hidden = true;
    var nombre = form.elements.nombre.value.trim().split(/\s+/)[0];
    var email = form.elements.email.value.trim();
    confirmationText.textContent = 'Gracias, ' + nombre + '. Te responderemos en ' + email + ' en menos de 24 horas laborables.';
    form.hidden = true;
    confirmation.hidden = false;
    confirmation.focus();
  });

  newMessage.addEventListener('click', function () {
    form.reset();
    updateCounter();
    Object.keys(validators).forEach(function (name) {
      form.elements[name].removeAttribute('aria-invalid');
      document.getElementById(name + '-error').textContent = '';
    });
    summary.hidden = true;
    confirmation.hidden = true;
    form.hidden = false;
    form.elements.nombre.focus();
  });
})();
