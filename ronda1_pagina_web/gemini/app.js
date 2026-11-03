/**
 * Ferretería La Esquina — Lógica de Interfaz y Validación (Vanilla JS)
 * Sin dependencias externas. Compatible con navegación por teclado y lectores de pantalla.
 */
(function () {
  'use strict';

  /* ========================================================================
     1. Menú de Navegación Móvil Accesible
     ======================================================================== */
  const navToggle = document.getElementById('nav-toggle');
  const siteNav = document.getElementById('site-nav');

  if (navToggle && siteNav) {
    const toggleMenu = function (forceState) {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      const nextState = typeof forceState === 'boolean' ? forceState : !isExpanded;
      navToggle.setAttribute('aria-expanded', String(nextState));
      siteNav.classList.toggle('is-open', nextState);
      const labelSpan = navToggle.querySelector('.nav-toggle__label');
      if (labelSpan) {
        labelSpan.textContent = nextState ? 'Cerrar' : 'Menú';
      }
    };

    navToggle.addEventListener('click', function () {
      toggleMenu();
    });

    siteNav.addEventListener('click', function (event) {
      const link = event.target.closest('a');
      if (link && window.innerWidth < 1024) {
        toggleMenu(false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
        toggleMenu(false);
        navToggle.focus();
      }
    });
  }

  /* ========================================================================
     2. Horario: Resaltado del día actual y estado de apertura
     ======================================================================== */
  const updateScheduleStatus = function () {
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const minutes = now.getHours() * 60 + now.getMinutes();

    // Resaltar fila correspondiente en la tabla de horarios
    const rows = document.querySelectorAll('.hours-table tr[data-days]');
    rows.forEach(function (row) {
      const daysAttr = row.getAttribute('data-days') || '';
      const daysList = daysAttr.split(',').map(Number);
      if (daysList.includes(day)) {
        row.classList.add('is-today');
      } else {
        row.classList.remove('is-today');
      }
    });

    // Calcular si está abierto según horario de la ferretería:
    // Lunes a Viernes (1-5): 08:30–14:00 y 16:30–20:00
    // Sábados (6): 09:00–14:00
    // Domingos (0): Cerrado
    let isOpen = false;
    if (day >= 1 && day <= 5) {
      const morningOpen = 8 * 60 + 30;
      const morningClose = 14 * 60;
      const afternoonOpen = 16 * 60 + 30;
      const afternoonClose = 20 * 60;
      isOpen =
        (minutes >= morningOpen && minutes < morningClose) ||
        (minutes >= afternoonOpen && minutes < afternoonClose);
    } else if (day === 6) {
      const satOpen = 9 * 60;
      const satClose = 14 * 60;
      isOpen = minutes >= satOpen && minutes < satClose;
    }

    const badge = document.getElementById('store-status-badge');
    if (badge) {
      if (isOpen) {
        badge.textContent = 'Abierto ahora · Te atendemos en tienda';
        badge.classList.remove('topbar__badge--closed');
      } else {
        badge.textContent = 'Horario comercial: L-V 8:30–14:00 y 16:30–20:00 · Sáb 9:00–14:00';
        badge.classList.add('topbar__badge--closed');
      }
    }
  };

  updateScheduleStatus();

  /* ========================================================================
     3. Filtro de Productos Destacados y Consulta Rápida
     ======================================================================== */
  const filterButtons = document.querySelectorAll('.filter-btn[data-filter]');
  const productCards = document.querySelectorAll('.product-card[data-category]');
  const liveCount = document.getElementById('products-live-count');

  if (filterButtons.length > 0 && productCards.length > 0) {
    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const selectedCategory = btn.getAttribute('data-filter');

        filterButtons.forEach(function (otherBtn) {
          otherBtn.setAttribute('aria-pressed', String(otherBtn === btn));
        });

        let visibleCount = 0;
        productCards.forEach(function (card) {
          const category = card.getAttribute('data-category');
          const matches = selectedCategory === 'todos' || category === selectedCategory;
          card.hidden = !matches;
          if (matches) {
            visibleCount += 1;
          }
        });

        if (liveCount) {
          liveCount.textContent =
            'Mostrando ' + visibleCount + ' productos en la categoría seleccionada.';
        }
      });
    });
  }

  // Botones "Consultar disponibilidad" en cada producto que rellenan el formulario
  const inquireButtons = document.querySelectorAll('.js-inquire-product');
  const contactForm = document.getElementById('contact-form');
  const motivoSelect = document.getElementById('motivo');
  const mensajeInput = document.getElementById('mensaje');
  const nombreInput = document.getElementById('nombre');

  inquireButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const productName = button.getAttribute('data-product') || '';
      const productPrice = button.getAttribute('data-price') || '';

      if (motivoSelect) {
        motivoSelect.value = 'producto';
      }
      if (mensajeInput) {
        mensajeInput.value =
          'Hola, me gustaría consultar la disponibilidad o reservar el producto "' +
          productName +
          '" (' +
          productPrice +
          ').';
      }

      const contactSection = document.getElementById('contacto');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
      if (nombreInput) {
        nombreInput.focus();
      }
    });
  });

  /* ========================================================================
     4. Validación Accesible del Formulario de Contacto en el Navegador
     ======================================================================== */
  const confirmationBox = document.getElementById('form-confirmation');
  const newMessageBtn = document.getElementById('btn-new-message');

  const validators = {
    nombre: function (value) {
      const trimmed = value.trim();
      if (!trimmed) {
        return 'Por favor, escribe tu nombre y apellidos.';
      }
      if (trimmed.length < 2) {
        return 'El nombre debe tener al menos 2 caracteres.';
      }
      return '';
    },
    email: function (value) {
      const trimmed = value.trim();
      if (!trimmed) {
        return 'Por favor, introduce tu correo electrónico.';
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(trimmed)) {
        return 'Introduce un correo electrónico válido (por ejemplo, cliente@dominio.es).';
      }
      return '';
    },
    telefono: function (value) {
      const trimmed = value.trim();
      if (!trimmed) {
        return ''; // Opcional
      }
      const digitsOnly = trimmed.replace(/[\s\-+()]/g, '');
      if (!/^\d{9,15}$/.test(digitsOnly)) {
        return 'Si indicas un teléfono, debe contener entre 9 y 15 dígitos numéricos.';
      }
      return '';
    },
    motivo: function (value) {
      if (!value || value.trim() === '') {
        return 'Selecciona el motivo de tu consulta.';
      }
      return '';
    },
    mensaje: function (value) {
      const trimmed = value.trim();
      if (!trimmed) {
        return 'Por favor, escribe los detalles de tu consulta o pedido.';
      }
      if (trimmed.length < 10) {
        return 'El mensaje es demasiado corto (mínimo 10 caracteres).';
      }
      return '';
    },
    privacidad: function (_value, field) {
      if (!field.checked) {
        return 'Debes aceptar la política de privacidad para enviar la consulta.';
      }
      return '';
    }
  };

  const setFieldError = function (field, errorMessage) {
    const errorEl = document.getElementById('error-' + field.id);
    if (errorMessage) {
      field.setAttribute('aria-invalid', 'true');
      if (errorEl) {
        errorEl.textContent = errorMessage;
        errorEl.hidden = false;
      }
    } else {
      field.setAttribute('aria-invalid', 'false');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.hidden = true;
      }
    }
  };

  const validateSingleField = function (field) {
    const validator = validators[field.id];
    if (!validator) {
      return true;
    }
    const errorMessage = validator(field.value, field);
    setFieldError(field, errorMessage);
    return errorMessage === '';
  };

  if (contactForm) {
    const fields = Array.from(
      contactForm.querySelectorAll('input, select, textarea')
    ).filter(function (el) {
      return Boolean(validators[el.id]);
    });

    fields.forEach(function (field) {
      const eventName = field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'blur';
      field.addEventListener(eventName, function () {
        validateSingleField(field);
      });

      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') {
          validateSingleField(field);
        }
      });
    });

    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();

      let firstInvalidField = null;
      let isFormValid = true;

      fields.forEach(function (field) {
        const isValid = validateSingleField(field);
        if (!isValid) {
          isFormValid = false;
          if (!firstInvalidField) {
            firstInvalidField = field;
          }
        }
      });

      if (!isFormValid) {
        if (firstInvalidField) {
          firstInvalidField.focus();
        }
        return;
      }

      // Poblar resumen en el mensaje de confirmación
      const summaryNombre = document.getElementById('confirm-nombre');
      const summaryEmail = document.getElementById('confirm-email');
      const summaryMotivo = document.getElementById('confirm-motivo');
      const summaryMensaje = document.getElementById('confirm-mensaje');
      const summaryRef = document.getElementById('confirm-ref');

      const nombreVal = document.getElementById('nombre').value.trim();
      const emailVal = document.getElementById('email').value.trim();
      const telVal = document.getElementById('telefono').value.trim();
      const motivoEl = document.getElementById('motivo');
      const motivoText =
        motivoEl.options[motivoEl.selectedIndex]
          ? motivoEl.options[motivoEl.selectedIndex].text
          : motivoEl.value;
      const mensajeVal = document.getElementById('mensaje').value.trim();

      if (summaryNombre) {
        summaryNombre.textContent = nombreVal;
      }
      if (summaryEmail) {
        summaryEmail.textContent = telVal ? emailVal + ' · Tel: ' + telVal : emailVal;
      }
      if (summaryMotivo) {
        summaryMotivo.textContent = motivoText;
      }
      if (summaryMensaje) {
        summaryMensaje.textContent = mensajeVal;
      }
      if (summaryRef) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        summaryRef.textContent = 'FLE-' + new Date().getFullYear() + '-' + randomNum;
      }

      contactForm.hidden = true;
      if (confirmationBox) {
        confirmationBox.hidden = false;
        const confirmHeading = confirmationBox.querySelector('.form-confirmation__title');
        if (confirmHeading) {
          confirmHeading.focus();
        }
      }
    });

    if (newMessageBtn) {
      newMessageBtn.addEventListener('click', function () {
        contactForm.reset();
        fields.forEach(function (field) {
          setFieldError(field, '');
        });
        if (confirmationBox) {
          confirmationBox.hidden = true;
        }
        contactForm.hidden = false;
        if (nombreInput) {
          nombreInput.focus();
        }
      });
    }
  }
})();
