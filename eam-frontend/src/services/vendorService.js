import api from './api';

export const fetchVendorList = async () => {
  const response = await api.post('/vendor/getVendorList', { data: {} });
  return response.data.data;
};

export const fetchVendorFilterOptions = async () => {
  const response = await api.post('/vendor/getFilterOptions', { data: {} });
  return response.data.branches || [];
};

export const saveVendor = async (vendorData) => {
  const response = await api.post('/vendor/saveVendor', { data: vendorData });
  return response.data;
};

export const exportVendorExcel = async (actorName) => {
  const response = await api.post('/vendor/exportExcel', { data: { actorName } });
  return response.data;
};

export const deleteVendor = async (vendorData) => {
  const response = await api.post('/vendor/deleteVendor', { data: vendorData });
  return response.data;
};
