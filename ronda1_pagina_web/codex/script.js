'use strict';

const form = document.querySelector('#contact-form');
const nameInput = document.querySelector('#name');
const messageInput = document.querySelector('#message');
const statusMessage = document.querySelector('#form-status');

// Native browser validation supplies localized errors and focuses the invalid field.
function validateText(input, minimum, message) {
  input.setCustomValidity('');
  if (input.value && input.value.trim().length < minimum) {
    input.setCustomValidity(message);
  }
}

function validateFields() {
  validateText(nameInput, 2, 'Escribe un nombre de al menos 2 caracteres, sin contar los espacios de los extremos.');
  validateText(messageInput, 10, 'Escribe un mensaje de al menos 10 caracteres, sin contar los espacios de los extremos.');
}

// With JavaScript disabled, the submit button stays disabled to avoid navigation
// or accidentally putting contact details in a URL.
form.addEventListener('input', () => {
  validateFields();
  statusMessage.textContent = '';
  statusMessage.classList.remove('success');
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  validateFields();
  if (!form.reportValidity()) return;
  statusMessage.textContent = '¡Consulta completada! Gracias por probar el formulario. Esta es una demostración: tus datos no se han enviado ni guardado.';
  statusMessage.classList.add('success');
  form.reset();
});

document.querySelector('#year').textContent = new Date().getFullYear();

form.querySelector('button[type="submit"]').disabled = false;
