const form = document.getElementById('customerForm');
const resetBtn = document.getElementById('resetBtn');
const reloadBtn = document.getElementById('reloadBtn');
const tbody = document.getElementById('customersTbody');
const messageBox = document.getElementById('message');

// Nuevos elementos para el formulario desplegable
const toggleFormBtn = document.getElementById('toggleFormBtn');
const formContainer = document.getElementById('formContainer');
const closeFormBtn = document.getElementById('closeFormBtn');
const cancelBtn = document.getElementById('cancelBtn');
const formTitle = document.getElementById('formTitle');

function showMessage(text, type = 'info', timeoutMs = 3000) {
  messageBox.textContent = text;
  messageBox.className = 'mb-6 p-4 rounded-lg border';
  
  // Aplicar estilos según el tipo de mensaje
  switch(type) {
    case 'success':
      messageBox.className += ' bg-green-50 border-green-200 text-green-800';
      break;
    case 'danger':
      messageBox.className += ' bg-red-50 border-red-200 text-red-800';
      break;
    case 'warning':
      messageBox.className += ' bg-yellow-50 border-yellow-200 text-yellow-800';
      break;
    default:
      messageBox.className += ' bg-blue-50 border-blue-200 text-blue-800';
  }
  
  messageBox.classList.remove('hidden');
  
  if (timeoutMs) {
    setTimeout(() => { 
      messageBox.classList.add('hidden'); 
    }, timeoutMs);
  }
}

function clearForm() {
  form.reset();
  document.getElementById('customerId').value = '';
  formTitle.textContent = 'Crear Nuevo Cliente';
  toggleFormBtn.innerHTML = `
    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
    </svg>
    Agregar Nuevo Cliente
  `;
}

function openForm() {
  formContainer.classList.remove('hidden');
  formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeForm() {
  formContainer.classList.add('hidden');
  clearForm();
}

async function loadCustomers() {
  try {
    const res = await fetch(`${window.API_BASE}/customers`);
    if (!res.ok) {
      showMessage('No se pudo cargar la lista de clientes', 'danger');
      return;
    }
    const data = await res.json();
    tbody.innerHTML = '';
    
    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-8 text-center text-gray-500">
            <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            <p class="text-lg font-medium">No hay clientes registrados</p>
            <p class="text-sm">Comienza agregando tu primer cliente usando el botón de arriba</p>
          </td>
        </tr>
      `;
      return;
    }
    
    data.forEach((c) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50 transition-colors';
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${c.id}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${c.document_number}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">${c.first_name} ${c.last_name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.email ?? '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.phone ?? '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <div class="flex space-x-2">
            <button class="inline-flex items-center px-3 py-1 border border-blue-300 text-blue-700 text-xs font-medium rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" data-action="edit" data-id="${c.id}">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
              Editar
            </button>
            <button class="inline-flex items-center px-3 py-1 border border-red-300 text-red-700 text-xs font-medium rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors" data-action="delete" data-id="${c.id}">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Eliminar
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    showMessage('Error al cargar los clientes: ' + error.message, 'danger');
  }
}

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const action = btn.getAttribute('data-action');

  if (action === 'edit') {
    try {
      const res = await fetch(`${window.API_BASE}/customers/${id}`);
      if (!res.ok) {
        showMessage('Cliente no encontrado', 'warning');
        return;
      }
      const c = await res.json();
      document.getElementById('customerId').value = c.id;
      document.getElementById('document_number').value = c.document_number;
      document.getElementById('first_name').value = c.first_name;
      document.getElementById('last_name').value = c.last_name;
      document.getElementById('email').value = c.email ?? '';
      document.getElementById('phone').value = c.phone ?? '';
      
      // Cambiar título y botón para modo edición
      formTitle.textContent = `Editar Cliente: ${c.first_name} ${c.last_name}`;
      toggleFormBtn.innerHTML = `
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
        </svg>
        Editando Cliente
      `;
      
      // Abrir formulario
      openForm();
      
      showMessage('Cliente cargado para edición', 'info');
    } catch (error) {
      showMessage('Error al cargar el cliente: ' + error.message, 'danger');
    }
  }

  if (action === 'delete') {
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      return;
    }
    
    try {
      const res = await fetch(`${window.API_BASE}/customers/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        showMessage('Cliente eliminado correctamente', 'success');
        loadCustomers();
      } else {
        const errText = await res.text().catch(() => '');
        showMessage('Error al eliminar: ' + (errText || res.status), 'danger', 5000);
      }
    } catch (error) {
      showMessage('Error al eliminar el cliente: ' + error.message, 'danger');
    }
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('customerId').value;
  const payload = {
    document_number: document.getElementById('document_number').value.trim(),
    first_name: document.getElementById('first_name').value.trim(),
    last_name: document.getElementById('last_name').value.trim(),
    email: document.getElementById('email').value.trim() || null,
    phone: document.getElementById('phone').value.trim() || null,
  };

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${window.API_BASE}/customers/${id}` : `${window.API_BASE}/customers`;

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showMessage('Error: ' + (err.message || res.status), 'danger');
      return;
    }

    clearForm();
    closeForm();
    showMessage(id ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente', 'success');
    await loadCustomers();
  } catch (error) {
    showMessage('Error al guardar el cliente: ' + error.message, 'danger');
  }
});

// Event listeners para el formulario desplegable
toggleFormBtn.addEventListener('click', () => {
  if (formContainer.classList.contains('hidden')) {
    openForm();
  } else {
    closeForm();
  }
});

closeFormBtn.addEventListener('click', closeForm);
cancelBtn.addEventListener('click', closeForm);

// Botón Recargar: vuelve a consultar la lista desde el backend
resetBtn.addEventListener('click', clearForm);
reloadBtn.addEventListener('click', loadCustomers);

// Cargar clientes al iniciar
loadCustomers(); 