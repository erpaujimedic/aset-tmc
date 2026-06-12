import api from './api';

export const loginUser = async (email, password) => {
  try {
    const response = await api.post('/auth/verify-login', { 
      email, 
      password 
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Login failed!";
  }
};

export const registerUser = async (payload) => {
  try {
    const response = await api.post('/auth/register', payload);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Registration failed!";
  }
};

export const resetPassword = async (email) => {
  try {
    const response = await api.post('/auth/reset-password', { email });
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to send reset link!";
  }
};