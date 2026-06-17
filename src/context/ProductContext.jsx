import { createContext, useState, useEffect } from 'react';

export const ProductContext = createContext();
// Smart API URL: Automatically switch between local development and production live servers!
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : 'https://annapurni-backend.onrender.com/api';

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [orders, setOrders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('admin_token') || null);

  useEffect(() => {
    // Fetch initial public data
    const fetchData = async () => {
      try {
        const [prodRes, setRes] = await Promise.all([
          fetch(`${API_URL}/products`),
          fetch(`${API_URL}/settings`)
        ]);
        if (prodRes.ok) setProducts(await prodRes.json());
        if (setRes.ok) setSettings(await setRes.json());
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  // Fetch admin-only data reactively when token is set
  useEffect(() => {
    const fetchAdminData = async () => {
      if (!token) return;
      try {
        const headers = { 'Authorization': token };
        const [ordRes, logRes] = await Promise.all([
          fetch(`${API_URL}/orders`, { headers }),
          fetch(`${API_URL}/logs`, { headers })
        ]);
        if (ordRes.ok) setOrders(await ordRes.json());
        if (logRes.ok) setLogs(await logRes.json());
      } catch (error) {
        console.error('Error fetching admin data:', error);
      }
    };
    fetchAdminData();
  }, [token]);

  const login = async (username, password) => {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem('admin_token', data.token);
      return true;
    }
    return false;
  };

  const logout = () => {
    setToken(null);
    setOrders([]);
    setLogs([]);
    localStorage.removeItem('admin_token');
  };

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': token
  };

  const addProduct = async (product) => {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(product)
    });
    if (res.ok) {
      const newProduct = await res.json();
      setProducts([...products, newProduct]);
      
      // Update logs instantly
      const logRes = await fetch(`${API_URL}/logs`, { headers: { 'Authorization': token } });
      if (logRes.ok) setLogs(await logRes.json());
    }
  };

  const updateProduct = async (product) => {
    const res = await fetch(`${API_URL}/products/${product.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(product)
    });
    if (res.ok) {
      const updatedProduct = await res.json();
      setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      
      // Update logs instantly
      const logRes = await fetch(`${API_URL}/logs`, { headers: { 'Authorization': token } });
      if (logRes.ok) setLogs(await logRes.json());
    }
  };

  const deleteProduct = async (id) => {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    if (res.ok) {
      setProducts(products.filter(p => p.id !== id));
      
      // Update logs instantly
      const logRes = await fetch(`${API_URL}/logs`, { headers: { 'Authorization': token } });
      if (logRes.ok) setLogs(await logRes.json());
    }
  };

  const updateSettings = async (newSettings) => {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(newSettings)
    });
    if (res.ok) {
      setSettings(await res.json());
      
      // Update logs instantly
      const logRes = await fetch(`${API_URL}/logs`, { headers: { 'Authorization': token } });
      if (logRes.ok) setLogs(await logRes.json());
    }
  };

  // --- NEW ECOMMERCE DYNAMIC METHODS ---

  const createOrder = async (order) => {
    const res = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    if (res.ok) {
      const newOrder = await res.json();
      setOrders(prev => [...prev, newOrder]);
      return newOrder;
    }
    return null;
  };

  const updateOrder = async (id, updatedFields) => {
    const res = await fetch(`${API_URL}/orders/${id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updatedFields)
    });
    if (res.ok) {
      const updatedOrder = await res.json();
      setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
      
      // Update logs instantly
      const logRes = await fetch(`${API_URL}/logs`, { headers: { 'Authorization': token } });
      if (logRes.ok) setLogs(await logRes.json());
      
      return updatedOrder;
    }
    return null;
  };

  const addLog = async (action, details) => {
    const res = await fetch(`${API_URL}/logs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action, details })
    });
    if (res.ok) {
      const newLog = await res.json();
      setLogs(prev => [newLog, ...prev]);
      return newLog;
    }
    return null;
  };

  const uploadImage = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        resolve(reader.result);
      };
      reader.onerror = () => reject('Error reading file');
      reader.readAsDataURL(file);
    });
  };

  const resetDashboard = async () => {
    const res = await fetch(`${API_URL}/reset`, {
      method: 'DELETE',
      headers: authHeaders
    });
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders);
      setLogs(data.logs);
      return true;
    }
    return false;
  };

  return (
    <ProductContext.Provider value={{
      products, settings, token, orders, logs,
      login, logout, addProduct, updateProduct, deleteProduct, updateSettings,
      createOrder, updateOrder, addLog, uploadImage, resetDashboard
    }}>
      {children}
    </ProductContext.Provider>
  );
};
