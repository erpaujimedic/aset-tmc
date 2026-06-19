import api from './api';

const extractError = (error, defaultMsg) => {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join(', ');
  if (detail) return JSON.stringify(detail);
  if (error.message) return error.message;
  return defaultMsg;
};

export const loginUser = async (email, password) => {
  try {
    const response = await api.post('/auth/verify-login', { 
      email, 
      password 
    });
    return response.data;
  } catch (error) {
    throw extractError(error, "Login failed!");
  }
};

export const registerUser = async (payload) => {
  try {
    const response = await api.post('/auth/register', payload);
    return response.data;
  } catch (error) {
    throw extractError(error, "Registration failed!");
  }
};

export const resetPassword = async (email) => {
  try {
    const response = await api.post('/auth/reset-password', { email });
    return response.data;
  } catch (error) {
    throw extractError(error, "Failed to send reset link!");
  }
};