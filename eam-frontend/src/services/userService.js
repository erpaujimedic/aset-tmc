import api from './api';

export const fetchAllUsers = async (branch = null) => {
  const url = branch ? `/users?branch=${encodeURIComponent(branch)}` : '/users';
  const response = await api.get(url);
  return response.data.data;
};

export const fetchSystemRoles = async () => {
  const response = await api.get('/users/roles');
  return response.data.data;
};

export const createSystemRole = async (roleName) => {
  const response = await api.post('/users/roles', { role_name: roleName });
  return response.data.data;
};

export const deleteSystemRole = async (roleName) => {
  const response = await api.delete(`/users/roles/${roleName}`);
  return response.data.data;
};

export const createUser = async (userData) => {
  const response = await api.post('/users', userData);
  return response.data;
};

export const updateUser = async (userId, userData) => {
  const response = await api.put(`/users/${userId}`, userData);
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await api.delete(`/users/${userId}`);
  return response.data;
};

export const resetUserPassword = async (userId) => {
  const response = await api.post(`/users/${userId}/reset-password`);
  return response.data;
};

export const fetchRolePermissions = async (roleName) => {
  const response = await api.get(`/permissions/${roleName}`);
  return response.data.data;
};

export const updateRolePermissions = async (roleName, permissionsData) => {
  const response = await api.put(`/permissions/${roleName}`, { permissions: permissionsData });
  return response.data;
};

export const importUsers = async (formData) => {
  const response = await api.post('/users/import', formData);
  return response.data;
};
