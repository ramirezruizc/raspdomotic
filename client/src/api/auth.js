import api from './api';
  
// Función para registrar usuario
export const register = async (credentials) => {
    try {
      const response = await api.post('/auth/register', credentials);
      return response.data;
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      throw error;
    }
};

// Función para iniciar sesión
export const login = async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      throw error;
    }
};

export async function getCurrentUser() {
  const response = await api.get('/auth/me', { withCredentials: true });
  return response.data;
}

export const changePassword = async ({ currentPassword, newPassword }) => {
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });

      return response.data;
    } catch (error) {
      console.error('Error al cambiar la contraseña:', error);
      throw error;
    }
};

// Obtener el layout guardado
export const getLayout = async () => {
  try {
    const response = await api.get('/auth/get-layout');
    return response;
  } catch (error) {
    console.error('Error al obtener el layout:', error);
    throw error;
  }
};

// Guardar el layout
export const saveLayout = async (layout) => {
  try {
    const response = await api.post('/auth/save-layout', { layout });
    return response.data;
  } catch (error) {
    console.error('Error al guardar el layout:', error);
    throw error;
  }
};

// Función para renovar la sesión
export const keepAlive = async () => {
    try {
      const response = await api.get('/auth/keep-alive');
      return response.data;  // Retorna la respuesta si la operacion es ok
    } catch (error) {
      console.error('Error al renovar la sesión:', error);
      throw error;  // Lanza el error para que se pueda manejar en el store
    }
};
  
// Función para cerrar la sesión
export const logout = async () => {
    try {
      const response = await api.post('/auth/logout');
      return response.data;  // Retorna la respuesta si es exitosa
    } catch (error) {
      console.error('Error al cerrar la sesión:', error);
      throw error;  // Lanza el error para que se pueda manejar en el store
    }
};

// Función para eliminar la base de datos
export const deleteDatabase = async () => {
  try {
    const response = await api.delete('/auth/nuke-database', {
      data: { confirmStep1: true, confirmStep2: true }
    });
    return response.data;
  } catch (error) {
    console.error('Error al eliminar la base de datos:', error);
    throw error;
  }
};

// Función para obtener listado de usuarios
export const getUsersList = async () => {
  try {
    const response = await api.get('/auth/users-list');
    console.log("Usuarios recogidos:",response.data);
    return response.data;
  } catch (error) {
    console.error('Error al obtener listado de usuarios:', error);
    throw error;
  }
};

// Función para modificar roles de usuario
export const updateUserRoles = async (username, role) => {
  try {
    const response = await api.post('/auth/set-role', { username, role });
    return response.data;
  } catch (error) {
    console.error('Error al modificar rol de usuario', error);
    throw error;
  }
};

// Función para borrar usuario
export const deleteUser = async (id) => {
  try {
    const response = await api.post('/auth/delete-user', { id });
    return response.data;
  } catch (error) {
    console.error('Error al eliminar el usuario', error);
    throw error;
  }
};

export function getRoles() {
  return api.get('/auth/roles').then(res => res.data);
}

export function createRole(role) {
  return api.post('/auth/roles', role).then(res => res.data);
}

export function updateRole(id, role) {
  return api.patch(`/auth/roles/${id}`, role).then(res => res.data);
}

export function removeRole(id) {
  return api.delete(`/auth/roles/${id}`).then(res => res.data);
}

export async function invalidateUser(username) {
  return await api.post('/auth/invalidate-user', { username });
}

export async function blockUser(username, block) {
  return await api.post(`/auth/block-user`, { username, blocked: block });
}