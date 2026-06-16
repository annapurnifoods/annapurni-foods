import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductContext } from '../context/ProductContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AdminDashboard = () => {
  const {
    products,
    settings,
    token,
    orders,
    logs,
    addProduct,
    updateProduct,
    deleteProduct,
    updateSettings,
    updateOrder,
    addLog,
    uploadImage,
    logout,
    resetDashboard
  } = useContext(ProductContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'products', 'orders', 'logs', 'settings'
  const [uploading, setUploading] = useState(false);

  // Products state
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', category: 'Thokku', price: '', weight: '250g', badge: '', image: '', desc: '', isAvailable: true
  });

  // Settings state
  const [settingsData, setSettingsData] = useState({
    whatsappNumber: '', address: '', heroText: '', heroTagline: '', isOpen: true,
    instagram: '', facebook: '', youtube: '',
    makingVideoUrl: '', makingImage1: '', makingImage2: '', makingImage3: ''
  });

  // Selected Order for Details Popup Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Custom manual log state
  const [manualLog, setManualLog] = useState({ action: '', details: '' });
  
  // Reviews state
  const [reviewForm, setReviewForm] = useState({ name: '', location: '', stars: 5, text: '' });
  const [editingReviewIndex, setEditingReviewIndex] = useState(null);

  const parsedReviews = (() => {
    try {
      return settingsData?.reviewsData ? JSON.parse(settingsData.reviewsData) : [];
    } catch {
      return [];
    }
  })();

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    const newReviews = [...parsedReviews];
    if (editingReviewIndex !== null) {
      newReviews[editingReviewIndex] = reviewForm;
      setEditingReviewIndex(null);
    } else {
      newReviews.push(reviewForm);
    }
    const updatedSettings = { ...settingsData, reviewsData: JSON.stringify(newReviews) };
    setSettingsData(updatedSettings);
    await updateSettings(updatedSettings);
    setReviewForm({ name: '', location: '', stars: 5, text: '' });
  };

  const editReview = (index) => {
    setEditingReviewIndex(index);
    setReviewForm(parsedReviews[index]);
  };

  const deleteReview = async (index) => {
    if (window.confirm('Delete this review?')) {
      const newReviews = parsedReviews.filter((_, i) => i !== index);
      const updatedSettings = { ...settingsData, reviewsData: JSON.stringify(newReviews) };
      setSettingsData(updatedSettings);
      await updateSettings(updatedSettings);
    }
  };
  
  // Log filtering states
  const [logFilterAction, setLogFilterAction] = useState('');
  const [logFilterDate, setLogFilterDate] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
    }
  }, [token, navigate]);

  useEffect(() => {
    if (settings) {
      setSettingsData(settings);
    }
  }, [settings]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleResetDashboard = async () => {
    if (window.confirm("Are you sure you want to reset the dashboard? This will permanently delete all orders and logs!")) {
      const success = await resetDashboard();
      if (success) {
        alert("Dashboard has been reset successfully.");
      } else {
        alert("Failed to reset dashboard.");
      }
    }
  };

  const handleResetMetric = async (metricKey) => {
    if (window.confirm(`Are you sure you want to reset the ${metricKey} counter to 0? This hides past metrics here but won't delete actual orders.`)) {
      const now = new Date().toISOString();
      const newSettings = { ...settingsData, [`reset_${metricKey}_date`]: now };
      await updateSettings(newSettings);
      setSettingsData(newSettings);
    }
  };

  const handleExportRecords = () => {
    if (!orders || orders.length === 0) {
      alert("No records to export.");
      return;
    }
    const csvRows = [];
    csvRows.push(['Order ID', 'Customer Name', 'Phone', 'Date', 'Total Amount', 'Status'].join(','));
    orders.forEach(order => {
      csvRows.push([
        order.id,
        `"${order.customerName}"`,
        `"${order.customerPhone}"`,
        new Date(order.createdAt).toLocaleDateString(),
        order.totalAmount,
        order.status
      ].join(','));
    });
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'annapurni_orders.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadWeeklyReport = () => {
    const doc = new jsPDF();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyOrders = orders.filter(o => new Date(o.createdAt) >= oneWeekAgo && o.status === 'Completed');
    const weeklyRevenue = weeklyOrders.reduce((total, o) => total + o.totalAmount, 0);

    // Header
    doc.setFontSize(22);
    doc.setTextColor(34, 139, 34);
    doc.text("ANNAPURNI FOODS", 105, 20, { align: "center" });
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Weekly Sales Report", 105, 30, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 36, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    // Summary Stats
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Completed Orders (Last 7 Days): ${weeklyOrders.length}`, 14, 52);
    doc.text(`Total Revenue (Last 7 Days): Rs. ${weeklyRevenue}`, 14, 59);

    // Orders table
    const tableColumn = ["Order ID", "Date", "Customer", "Amount"];
    const tableRows = [];

    weeklyOrders.forEach(order => {
      tableRows.push([
        order.id,
        new Date(order.createdAt).toLocaleDateString(),
        order.customerName,
        `Rs. ${order.totalAmount}`
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 65,
      theme: 'striped',
      headStyles: { fillColor: [34, 139, 34] }
    });

    doc.save(`Annapurni_Weekly_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // --- IMAGE UPLOAD HANDLER ---
  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setFormData((prev) => ({ ...prev, image: url }));
      alert('Image uploaded successfully! Path has been set.');
    } catch (err) {
      console.error(err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSettingsImageUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setSettingsData((prev) => ({ ...prev, [fieldName]: url }));
      alert('Image uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSettingsChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setSettingsData({ ...settingsData, [e.target.name]: value });
  };

  const saveSettings = (e) => {
    e.preventDefault();
    updateSettings(settingsData);
    alert('Settings updated successfully!');
  };

  const handleProductSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      updateProduct({ ...formData, id: editingId });
      setEditingId(null);
    } else {
      addProduct(formData);
    }
    setFormData({ name: '', category: 'Thokku', price: '', weight: '250g', badge: '', image: '', desc: '', isAvailable: true });
  };

  const editProduct = (product) => {
    setEditingId(product.id);
    setFormData({
      ...product,
      isAvailable: product.isAvailable !== false
    });
    setActiveTab('products'); // auto focus to products section
  };

  // --- MANUAL LOG SUBMIT ---
  const handleManualLogSubmit = async (e) => {
    e.preventDefault();
    if (!manualLog.action || !manualLog.details) return;
    const success = await addLog(manualLog.action, manualLog.details);
    if (success) {
      setManualLog({ action: '', details: '' });
      alert('Manual operational log recorded successfully!');
    }
  };

  // --- INVOICE/BILL TEXT GENERATOR ---
  const generateBillText = (order) => {
    if (!order) return '';
    let itemsText = '';
    order.items.forEach((item, index) => {
      itemsText += `\n${index + 1}. ${item.name} (${item.weight}) x ${item.quantity} - ₹${item.price * item.quantity}`;
    });

    return `==============================\n` +
      `       ANNAPURNI FOODS       \n` +
      `   Tambaram, Chennai, 600073  \n` +
      `==============================\n` +
      `Bill Receipt: ${order.id}\n` +
      `Customer: ${order.customerName}\n` +
      `Phone: ${order.customerPhone}\n` +
      `Date: ${new Date(order.createdAt).toLocaleDateString()}\n` +
      `------------------------------\n` +
      `Items Ordered: ${itemsText}\n` +
      `------------------------------\n` +
      `Total Paid: ₹${order.totalAmount}\n` +
      `Order Status: Completed (Fulfilled)\n` +
      `==============================\n` +
      `Your order has been completed and dispatched! Thank you for ordering traditional homemade love. 🌿🍚`;
  };

  const sendBillToWhatsApp = (order) => {
    const upiId = settingsData?.upiId || 'lakshmimano1987-2@okaxis'; // Default if not set
    const upiLink = `upi://pay?pa=${upiId}&pn=Annapurni%20Foods&am=${order.totalAmount}&cu=INR`;
    const dynamicQr = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=300&margin=2`;
    
    let qrUrl = settingsData?.paymentQrImage ? settingsData.paymentQrImage : dynamicQr;
    if (qrUrl.startsWith('/')) {
      qrUrl = window.location.origin + qrUrl;
    }

    const bill = generateBillText(order) + `\n\n💳 *Payment Details*\nPlease pay ₹${order.totalAmount} using UPI.\nClick the link below to view and scan the QR code:\n${qrUrl}`;
    
    const encodedBill = encodeURIComponent(bill);
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodedBill}`, '_blank');
  };

  const handleDownloadInvoice = async (order) => {
    if (!order) return;
    const doc = new jsPDF();

    // Helper to load image
    const loadImage = (url) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = () => resolve(null);
      });
    };

    const rightLogoPath = settingsData?.invoiceRightLogo || '/images/murugan-logo.jpg';
    
    const logo1 = await loadImage('/images/annapurni-brand-logo.jpg');
    const logo2 = await loadImage(rightLogoPath);

    if (logo1) doc.addImage(logo1, 'JPEG', 14, 10, 30, 30);
    if (logo2) doc.addImage(logo2, 'JPEG', 166, 10, 30, 30);
    
    // Brand/Header
    doc.setFontSize(22);
    doc.setTextColor(34, 139, 34); // Forest Green
    doc.text("ANNAPURNI FOODS", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Traditional Homemade Love", 105, 27, { align: "center" });
    doc.text("Tambaram, Chennai, Tamil Nadu - 600073", 105, 33, { align: "center" });
    doc.text(`WhatsApp: ${settingsData?.adminWhatsApp || '9876543210'}`, 105, 39, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.line(14, 45, 196, 45);

    // Order details
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Invoice ID: ${order.id}`, 14, 55);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 14, 62);
    
    doc.text(`Customer Name: ${order.customerName}`, 120, 55);
    doc.text(`Phone: ${order.customerPhone}`, 120, 62);

    // Items table
    const tableColumn = ["Item", "Weight", "Qty", "Price", "Total"];
    const tableRows = [];

    order.items.forEach(item => {
      tableRows.push([
        item.name,
        item.weight,
        item.quantity,
        `Rs. ${item.price}`,
        `Rs. ${item.price * item.quantity}`
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 70,
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34] }
    });

    // Total Amount
    const finalY = doc.lastAutoTable.finalY || 70;
    doc.setFontSize(14);
    doc.text(`Grand Total: Rs. ${order.totalAmount}`, 14, finalY + 15);
    
    // Add UPI QR Code Image
    const upiId = settingsData?.upiId || 'lakshmimano1987-2@okaxis';
    const upiLink = `upi://pay?pa=${upiId}&pn=Annapurni%20Foods&am=${order.totalAmount}&cu=INR`;
    const dynamicQrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=150&margin=1`;
    
    // If they provided a custom QR image, use that. Otherwise use dynamic one.
    let qrUrlToLoad = settingsData?.paymentQrImage ? settingsData.paymentQrImage : dynamicQrUrl;
    if (qrUrlToLoad.startsWith('/')) {
      qrUrlToLoad = window.location.origin + qrUrlToLoad;
    }

    const qrImgData = await loadImage(qrUrlToLoad);
    let footerY = finalY + 30;

    if (qrImgData) {
      doc.addImage(qrImgData, 'JPEG', 80, finalY + 20, 50, 50);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("Scan to Pay", 105, finalY + 75, { align: "center" });
      footerY = finalY + 85;
    }
    
    // Footer message
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for shopping with Annapurni Foods!", 105, footerY, { align: "center" });
    
    doc.save(`Annapurni_Invoice_${order.id}.pdf`);
  };

  if (!token) return null;

  // --- CALCULATE SALES DASHBOARD METRICS ---
  const completedOrders = orders.filter((o) => o.status === 'Completed');
  const pendingOrdersCount = orders.filter((o) => o.status === 'Pending').length;
  
  const getResetTime = (key) => settingsData?.[`reset_${key}_date`] ? new Date(settingsData[`reset_${key}_date`]).getTime() : 0;

  const revResetTime = getResetTime('revenue');
  const revOrders = completedOrders.filter(o => new Date(o.createdAt).getTime() > revResetTime);
  const totalRevenue = revOrders.reduce((total, o) => total + o.totalAmount, 0);

  const ordResetTime = getResetTime('orders');
  const totalOrdersCount = orders.filter(o => new Date(o.createdAt).getTime() > ordResetTime).length;

  const compResetTime = getResetTime('completed');
  const completedCount = completedOrders.filter(o => new Date(o.createdAt).getTime() > compResetTime).length;

  const avgResetTime = getResetTime('avg');
  const avgOrders = completedOrders.filter(o => new Date(o.createdAt).getTime() > avgResetTime);
  const avgOrderValue = avgOrders.length > 0 ? Math.round(avgOrders.reduce((t, o) => t + o.totalAmount, 0) / avgOrders.length) : 0;

  // Calculate Product Sales ranking
  const productSalesMap = {};
  completedOrders.forEach((o) => {
    o.items.forEach((item) => {
      productSalesMap[item.name] = (productSalesMap[item.name] || 0) + item.quantity;
    });
  });
  const topProducts = Object.entries(productSalesMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Compute Last 1 Week Orders
  const oneWeekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const lastWeekOrdersList = orders.filter(o => new Date(o.createdAt).getTime() >= oneWeekAgoMs).slice().reverse();

  return (
    <div className="admin-layout">
      {/* SIDEBAR */}
      <div className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <img src="/images/annapurni-brand-logo.jpg" alt="Logo" />
          <span>Annapurni Admin</span>
        </div>
        <ul className="admin-sidebar-nav">
          <li className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            📊 Dashboard
          </li>
          <li className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            📋 Orders {pendingOrdersCount > 0 && <span style={{background: 'var(--gold)', color: 'var(--dark)', fontSize: '0.75rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '50%', marginLeft: 'auto'}}>{pendingOrdersCount}</span>}
          </li>
          <li className={`admin-nav-item ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
            🛍️ Products
          </li>
          <li className={`admin-nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            🪵 Activity Logs
          </li>
          <li className={`admin-nav-item ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
            ⭐ Reviews
          </li>
          <li className={`admin-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            ⚙️ Settings
          </li>
          <li className="admin-nav-item" style={{marginTop: 'auto', color: 'var(--gold-light)'}} onClick={handleLogout}>
            🚪 Logout
          </li>
        </ul>
      </div>

      {/* MAIN CONTAINER */}
      <div className="admin-main-content">
        <div className="admin-header" style={{background: 'var(--forest)', borderBottom: 'none'}}>
          <div className="admin-title" style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <span style={{fontSize: '1.25rem'}}>🌾</span>
            Annapurni Admin Dashboard
          </div>
          <div>
            <button onClick={handleDownloadWeeklyReport} className="admin-btn" style={{marginRight: '1rem', background: 'var(--forest-light)', color: 'white'}}>📄 Weekly Report (PDF)</button>
            <button onClick={handleExportRecords} className="admin-btn" style={{marginRight: '1rem', background: 'var(--gold-light)', color: 'var(--dark)'}}>💾 Save All (CSV)</button>
            <button onClick={() => window.open('/', '_blank')} className="admin-btn" style={{marginRight: '1rem'}}>View Site</button>
            <button onClick={handleLogout} className="admin-btn" style={{background: 'var(--maroon)'}}>Logout</button>
          </div>
        </div>

        <div className="admin-content">
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Stat Cards */}
              <div className="stat-grid">
                <div className="dashboard-stat-card revenue">
                  <button onClick={() => handleResetMetric('revenue')} style={{position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--maroon)', fontSize: '1rem'}} title="Reset Revenue">🔄</button>
                  <div className="stat-icon">💰</div>
                  <div className="stat-info">
                    <h4>Total Sales</h4>
                    <div className="stat-value">₹{totalRevenue}</div>
                  </div>
                </div>
                <div className="dashboard-stat-card">
                  <button onClick={() => handleResetMetric('orders')} style={{position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--maroon)', fontSize: '1rem'}} title="Reset Orders Count">🔄</button>
                  <div className="stat-icon">📦</div>
                  <div className="stat-info">
                    <h4>Total Orders</h4>
                    <div className="stat-value">{totalOrdersCount}</div>
                  </div>
                </div>
                <div className="dashboard-stat-card completed">
                  <button onClick={() => handleResetMetric('completed')} style={{position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--maroon)', fontSize: '1rem'}} title="Reset Completed Count">🔄</button>
                  <div className="stat-icon">✅</div>
                  <div className="stat-info">
                    <h4>Completed</h4>
                    <div className="stat-value">{completedCount}</div>
                  </div>
                </div>
                <div className="dashboard-stat-card avg">
                  <button onClick={() => handleResetMetric('avg')} style={{position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--maroon)', fontSize: '1rem'}} title="Reset Avg Ticket">🔄</button>
                  <div className="stat-icon">📈</div>
                  <div className="stat-info">
                    <h4>AVG SALES</h4>
                    <div className="stat-value">₹{avgOrderValue}</div>
                  </div>
                </div>
              </div>

              {/* Grid with tables */}
              <div className="admin-dashboard-grid">
                {/* Pending Orders Summary */}
                <div className="admin-card">
                  <h3 style={{marginBottom: '1rem', color: 'var(--dark)'}}>Pending Approvals</h3>
                  {orders.filter((o) => o.status === 'Pending').length === 0 ? (
                    <p style={{color: 'var(--muted)', fontSize: '0.9rem'}}>No pending orders! High five! 🙌</p>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Customer</th>
                          <th>Total Amount</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.filter((o) => o.status === 'Pending').slice(0, 4).map((o) => (
                          <tr key={o.id}>
                            <td style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{o.id}</td>
                            <td>{o.customerName}</td>
                            <td style={{color: 'var(--forest)', fontWeight: 'bold'}}>₹{o.totalAmount}</td>
                            <td>
                              <button onClick={() => setSelectedOrder(o)} className="action-btn btn-edit" style={{background: 'var(--forest)', color: 'white'}}>Manage</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Top Selling Products */}
                <div className="admin-card">
                  <h3 style={{marginBottom: '1rem', color: 'var(--dark)'}}>Top Sellers 🌾</h3>
                  {topProducts.length === 0 ? (
                    <p style={{color: 'var(--muted)', fontSize: '0.9rem'}}>No completed sales data yet.</p>
                  ) : (
                    <ul style={{listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                      {topProducts.map((p, idx) => (
                        <li key={p.name} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px dashed rgba(0,0,0,0.06)'}}>
                          <span style={{fontSize: '0.9rem', color: 'var(--text)'}}>
                            <strong style={{color: 'var(--gold)', marginRight: '0.5rem'}}>#{idx + 1}</strong>
                            {p.name}
                          </span>
                          <span style={{background: 'var(--forest)', color: 'var(--cream)', fontSize: '0.8rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '1rem'}}>
                            {p.qty} Jars
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS MANAGEMENT */}
          {activeTab === 'orders' && (
            <>
              <div className="admin-card">
                <h3 style={{marginBottom: '1rem', color: 'var(--dark)'}}>Order Fulfillments</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer Name</th>
                      <th>WhatsApp/Phone</th>
                      <th>Date</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice().reverse().map((o) => (
                      <tr key={o.id}>
                        <td style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{o.id}</td>
                        <td>{o.customerName}</td>
                        <td>{o.customerPhone}</td>
                        <td style={{fontSize: '0.85rem'}}>{new Date(o.createdAt).toLocaleDateString()}</td>
                        <td style={{fontWeight: 'bold', color: 'var(--forest)'}}>₹{o.totalAmount}</td>
                        <td>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '2rem',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            background: o.status === 'Completed' ? '#E8F5E9' : o.status === 'Cancelled' ? '#FFEBEE' : o.status === 'Delivered' ? '#E3F2FD' : '#FFF8E1',
                            color: o.status === 'Completed' ? '#2E7D32' : o.status === 'Cancelled' ? '#C62828' : o.status === 'Delivered' ? '#1565C0' : '#F57F17'
                          }}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => setSelectedOrder(o)} className="action-btn btn-edit">Fulfill / Bill</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Last 1 Week Orders */}
              <div className="admin-card" style={{marginTop: '2rem'}}>
                <h3 style={{marginBottom: '1rem', color: 'var(--dark)'}}>Last 1 Week Orders History</h3>
                {lastWeekOrdersList.length === 0 ? (
                  <p style={{color: 'var(--muted)', fontSize: '0.9rem'}}>No orders in the last 7 days.</p>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer Name</th>
                        <th>Date</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastWeekOrdersList.map((o) => (
                        <tr key={o.id}>
                          <td style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{o.id}</td>
                          <td>{o.customerName}</td>
                          <td style={{fontSize: '0.85rem'}}>{new Date(o.createdAt).toLocaleDateString()}</td>
                          <td style={{fontWeight: 'bold', color: 'var(--forest)'}}>₹{o.totalAmount}</td>
                          <td>
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '2rem',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              background: o.status === 'Completed' ? '#E8F5E9' : o.status === 'Cancelled' ? '#FFEBEE' : o.status === 'Delivered' ? '#E3F2FD' : '#FFF8E1',
                              color: o.status === 'Completed' ? '#2E7D32' : o.status === 'Cancelled' ? '#C62828' : o.status === 'Delivered' ? '#1565C0' : '#F57F17'
                            }}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* TAB 3: PRODUCTS MANAGEMENT */}
          {activeTab === 'products' && (
            <div>
              {/* Form card */}
              <div className="admin-card" style={{marginBottom: '2rem'}}>
                <h3 style={{marginBottom: '1rem', color: 'var(--dark)'}}>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                <form onSubmit={handleProductSubmit} className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Product Name</label>
                    <input type="text" name="name" className="admin-input" value={formData.name} onChange={handleInputChange} required />
                  </div>
                  <div className="admin-form-group">
                    <label>Category</label>
                    <select name="category" className="admin-input" value={formData.category} onChange={handleInputChange}>
                      <option value="Thokku">Thokku</option>
                      <option value="Podi">Podi</option>
                      <option value="Pickles">Pickles</option>
                      <option value="Combo Packs">Combo Packs</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Price (₹)</label>
                    <input type="number" name="price" className="admin-input" value={formData.price} onChange={handleInputChange} required />
                  </div>
                  <div className="admin-form-group">
                    <label>Weight (e.g. 250g)</label>
                    <input type="text" name="weight" className="admin-input" value={formData.weight} onChange={handleInputChange} />
                  </div>
                  <div className="admin-form-group">
                    <label>Badge (e.g. BESTSELLER, NEW)</label>
                    <input type="text" name="badge" className="admin-input" value={formData.badge} onChange={handleInputChange} />
                  </div>
                  <div className="admin-form-group">
                    <label>Availability</label>
                    <div style={{marginTop: '0.5rem'}}>
                      <input type="checkbox" name="isAvailable" checked={formData.isAvailable} onChange={handleInputChange} /> 
                      <span style={{marginLeft: '0.5rem'}}>In Stock</span>
                    </div>
                  </div>
                  <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                    <label>Description</label>
                    <input type="text" name="desc" className="admin-input" value={formData.desc} onChange={handleInputChange} required />
                  </div>

                  {/* Dual Image Input with chosen File uploader */}
                  <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                    <label>Product Image</label>
                    <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                      <input type="text" name="image" className="admin-input" placeholder="Static URL or Uploaded path" value={formData.image} onChange={handleInputChange} required />
                      <div className="upload-btn-wrapper">
                        <button type="button" className="admin-btn" style={{background: 'var(--maroon)'}}>
                          {uploading ? 'Uploading...' : '📁 Choose File'}
                        </button>
                        <input type="file" name="file" accept="image/*" onChange={handleImageFileChange} disabled={uploading} />
                      </div>
                    </div>
                  </div>

                  <div style={{gridColumn: '1 / -1'}}>
                    <button type="submit" className="admin-btn">{editingId ? 'Update Product' : 'Add Product'}</button>
                    {editingId && (
                      <button type="button" onClick={() => { setEditingId(null); setFormData({ name: '', category: 'Thokku', price: '', weight: '250g', badge: '', image: '', desc: '', isAvailable: true }); }} className="admin-btn" style={{marginLeft: '1rem', background: 'gray'}}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Product List card */}
              <div className="admin-card">
                <h3 style={{marginBottom: '1rem', color: 'var(--dark)'}}>Manage Products</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name & Category</th>
                      <th>Price & Weight</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} style={{opacity: p.isAvailable === false ? 0.6 : 1}}>
                        <td><img src={p.image} alt={p.name} style={{width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.06)'}} /></td>
                        <td>
                          <div style={{fontWeight: 'bold'}}>{p.name}</div>
                          <div style={{fontSize: '0.8rem', color: 'var(--muted)'}}>{p.category}</div>
                        </td>
                        <td>
                          <div>₹{p.price}</div>
                          <div style={{fontSize: '0.8rem', color: 'var(--muted)'}}>{p.weight}</div>
                        </td>
                        <td>{p.isAvailable === false ? 'Out of Stock' : 'Active'}</td>
                        <td>
                          <button onClick={() => editProduct(p)} className="action-btn btn-edit">Edit</button>
                          <button onClick={() => deleteProduct(p.id)} className="action-btn btn-delete" style={{background: 'var(--maroon)', color: 'white'}}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div>
              {/* Timeline Display */}
              <div className="admin-card">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'}}>
                  <h3 style={{color: 'var(--dark)', margin: 0}}>Audit Activity Logs</h3>
                  <div style={{display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center'}}>
                    <select className="admin-input" style={{width: 'auto', padding: '0.5rem'}} value={logFilterAction} onChange={(e) => setLogFilterAction(e.target.value)}>
                      <option value="">All Activities</option>
                      {Array.from(new Set(logs.map(log => log.action))).map(action => (
                        <option key={action} value={action}>{action}</option>
                      ))}
                    </select>
                    <input type="date" className="admin-input" style={{width: 'auto', padding: '0.5rem'}} value={logFilterDate} onChange={(e) => setLogFilterDate(e.target.value)} />
                    <input type="text" placeholder="Search record..." className="admin-input" style={{width: '200px', padding: '0.5rem'}} value={logSearchQuery} onChange={(e) => setLogSearchQuery(e.target.value)} />
                  </div>
                </div>
                <div className="log-timeline">
                  {logs.filter(log => {
                    let matchesAction = true;
                    if (logFilterAction) {
                      matchesAction = log.action.includes(logFilterAction);
                    }
                    let matchesSearch = true;
                    if (logSearchQuery) {
                      const q = logSearchQuery.toLowerCase();
                      matchesSearch = log.action.toLowerCase().includes(q) || log.details.toLowerCase().includes(q);
                    }
                    let matchesDate = true;
                    if (logFilterDate) {
                      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
                      matchesDate = logDate === logFilterDate;
                    }
                    return matchesAction && matchesSearch && matchesDate;
                  }).map((log) => {
                    const isManual = log.action.startsWith('[Manual]');
                    const isOrder = log.action.includes('Order');
                    
                    let tagClass = 'system';
                    if (isManual) tagClass = 'manual';
                    else if (isOrder) tagClass = 'order';

                    return (
                      <div key={log.id} className="log-item">
                        <div className="log-details-col">
                          <div className="log-title-row">
                            <span className={`log-tag ${tagClass}`}>{log.action}</span>
                            <span className="log-desc">{log.details}</span>
                          </div>
                        </div>
                        <span className="log-time">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4.5: REVIEWS */}
          {activeTab === 'reviews' && (
            <div>
              <div className="admin-card" style={{marginBottom: '2rem'}}>
                <h3 style={{marginBottom: '1rem', color: 'var(--dark)'}}>{editingReviewIndex !== null ? 'Edit Review' : 'Add New Review'}</h3>
                <form onSubmit={handleReviewSubmit} className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Customer Name</label>
                    <input type="text" className="admin-input" value={reviewForm.name} onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })} required />
                  </div>
                  <div className="admin-form-group">
                    <label>Location (Optional)</label>
                    <input type="text" className="admin-input" value={reviewForm.location} onChange={(e) => setReviewForm({ ...reviewForm, location: e.target.value })} />
                  </div>
                  <div className="admin-form-group">
                    <label>Star Rating (1-5)</label>
                    <input type="number" min="1" max="5" className="admin-input" value={reviewForm.stars} onChange={(e) => setReviewForm({ ...reviewForm, stars: Number(e.target.value) })} required />
                  </div>
                  <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                    <label>Review Text</label>
                    <textarea className="admin-input" style={{padding: '0.75rem', resize: 'vertical', minHeight: '80px'}} value={reviewForm.text} onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })} required></textarea>
                  </div>
                  <div style={{gridColumn: '1 / -1', display: 'flex', gap: '1rem'}}>
                    <button type="submit" className="admin-btn">{editingReviewIndex !== null ? 'Update Review' : 'Add Review'}</button>
                    {editingReviewIndex !== null && (
                      <button type="button" className="admin-btn" style={{background: '#666'}} onClick={() => { setEditingReviewIndex(null); setReviewForm({ name: '', location: '', stars: 5, text: '' }); }}>Cancel</button>
                    )}
                  </div>
                </form>
              </div>

              <div className="admin-card">
                <h3 style={{marginBottom: '1rem', color: 'var(--dark)'}}>Manage Reviews</h3>
                {parsedReviews.length === 0 ? (
                  <p style={{color: 'var(--muted)'}}>No custom reviews added yet. The website will show default placeholder reviews.</p>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Rating</th>
                        <th>Review</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedReviews.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{r.name}</strong>
                            <div style={{fontSize: '0.8rem', color: 'var(--muted)'}}>{r.location}</div>
                          </td>
                          <td style={{color: 'var(--gold)'}}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</td>
                          <td style={{maxWidth: '300px', whiteSpace: 'normal', fontSize: '0.85rem'}}>{r.text}</td>
                          <td>
                            <button onClick={() => editReview(i)} className="action-btn btn-edit">Edit</button>
                            <button onClick={() => deleteReview(i)} className="action-btn btn-delete" style={{background: 'var(--maroon)', color: 'white'}}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}


          {/* TAB 5: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="admin-card">
              <h3 style={{marginBottom: '1rem', color: 'var(--dark)'}}>Store Settings</h3>
              <form onSubmit={saveSettings} className="admin-form-grid">
                <div className="admin-form-group">
                  <label>WhatsApp Number</label>
                  <input type="text" name="whatsappNumber" className="admin-input" value={settingsData.whatsappNumber} onChange={handleSettingsChange} required />
                </div>
                <div className="admin-form-group">
                  <label>Hero Text</label>
                  <input type="text" name="heroText" className="admin-input" value={settingsData.heroText} onChange={handleSettingsChange} />
                </div>
                <div className="admin-form-group">
                  <label>Hero Tagline</label>
                  <input type="text" name="heroTagline" className="admin-input" value={settingsData.heroTagline} onChange={handleSettingsChange} />
                </div>
                <div className="admin-form-group">
                  <label>Store Open Status</label>
                  <div style={{marginTop: '0.5rem'}}>
                    <input type="checkbox" name="isOpen" checked={settingsData.isOpen || false} onChange={handleSettingsChange} /> 
                    <span style={{marginLeft: '0.5rem'}}>{settingsData.isOpen ? 'Store is OPEN' : 'Store is CLOSED'}</span>
                  </div>
                </div>
                <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                  <label>UPI ID (For Dynamic WhatsApp Payment QR)</label>
                  <input type="text" name="upiId" className="admin-input" placeholder="e.g. annapurni@okhdfcbank" value={settingsData.upiId || ''} onChange={handleSettingsChange} />
                </div>
                <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                  <label>Custom Payment QR Image URL (Overrides Dynamic QR)</label>
                  <input type="text" name="paymentQrImage" className="admin-input" placeholder="Paste your GPay/PhonePe QR image URL here" value={settingsData.paymentQrImage || ''} onChange={handleSettingsChange} />
                </div>
                <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                  <label>Business Address</label>
                  <input type="text" name="address" className="admin-input" value={settingsData.address} onChange={handleSettingsChange} />
                </div>
                <div className="admin-form-group">
                  <label>Instagram URL</label>
                  <input type="text" name="instagram" className="admin-input" placeholder="https://instagram.com/profile" value={settingsData.instagram || ''} onChange={handleSettingsChange} />
                </div>
                <div className="admin-form-group">
                  <label>Facebook URL</label>
                  <input type="text" name="facebook" className="admin-input" placeholder="https://facebook.com/page" value={settingsData.facebook || ''} onChange={handleSettingsChange} />
                </div>
                <div className="admin-form-group">
                  <label>YouTube URL</label>
                  <input type="text" name="youtube" className="admin-input" placeholder="https://youtube.com/channel" value={settingsData.youtube || ''} onChange={handleSettingsChange} />
                </div>
                
                <div style={{gridColumn: '1 / -1', borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '1.25rem', marginTop: '0.5rem'}}>
                  <h4 style={{fontFamily: "'Playfair Display', serif", color: 'var(--forest)', marginBottom: '0.25rem'}}>📱 Connect With Us / Social Embeds</h4>
                  <p style={{fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem'}}>Paste the embed HTML code or post links here to display your latest posts on the homepage.</p>
                </div>
                <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                  <label>Latest Instagram Post Embed Code</label>
                  <textarea name="instaEmbed" className="admin-input" style={{padding: '0.5rem', resize: 'vertical', height: '80px'}} placeholder="Paste Instagram embed iframe HTML here..." value={settingsData.instaEmbed || ''} onChange={handleSettingsChange}></textarea>
                </div>
                <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                  <label>Latest Facebook Post Embed Code</label>
                  <textarea name="fbEmbed" className="admin-input" style={{padding: '0.5rem', resize: 'vertical', height: '80px'}} placeholder="Paste Facebook embed iframe HTML here..." value={settingsData.fbEmbed || ''} onChange={handleSettingsChange}></textarea>
                </div>
                <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                  <label>Latest YouTube Video ID (e.g. dQw4w9WgXcQ)</label>
                  <input type="text" name="ytEmbed" className="admin-input" placeholder="e.g. dQw4w9WgXcQ" value={settingsData.ytEmbed || ''} onChange={handleSettingsChange} />
                </div>

                <div style={{gridColumn: '1 / -1', borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '1.25rem', marginTop: '0.5rem'}}>
                  <h4 style={{fontFamily: "'Playfair Display', serif", color: 'var(--forest)', marginBottom: '0.25rem'}}>🎬 Kitchen Video & Photo Gallery</h4>
                  <p style={{fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem'}}>Showcase how you prepare your delicacies! Enter a YouTube video link and upload/paste up to three promotional photos.</p>
                </div>
                <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                  <label>YouTube Promo / Making Video Link</label>
                  <input type="text" name="makingVideoUrl" className="admin-input" placeholder="e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ" value={settingsData.makingVideoUrl || ''} onChange={handleSettingsChange} />
                </div>
                <div className="admin-form-group">
                  <label>Kitchen Photo 1</label>
                  <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                    {settingsData.makingImage1 && <img src={settingsData.makingImage1} alt="K1" style={{width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px'}} />}
                    <input type="file" accept="image/*" onChange={(e) => handleSettingsImageUpload(e, 'makingImage1')} disabled={uploading} />
                  </div>
                </div>
                <div className="admin-form-group">
                  <label>Kitchen Photo 2</label>
                  <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                    {settingsData.makingImage2 && <img src={settingsData.makingImage2} alt="K2" style={{width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px'}} />}
                    <input type="file" accept="image/*" onChange={(e) => handleSettingsImageUpload(e, 'makingImage2')} disabled={uploading} />
                  </div>
                </div>
                <div className="admin-form-group" style={{gridColumn: '1 / -1'}}>
                  <label>Kitchen Photo 3</label>
                  <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                    {settingsData.makingImage3 && <img src={settingsData.makingImage3} alt="K3" style={{width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px'}} />}
                    <input type="file" accept="image/*" onChange={(e) => handleSettingsImageUpload(e, 'makingImage3')} disabled={uploading} />
                  </div>
                </div>
                <div style={{gridColumn: '1 / -1', marginTop: '0.5rem'}}>
                  <button type="submit" className="admin-btn">Save Settings</button>
                </div>
                
              </form>
            </div>
          )}
        </div>
      </div>

      {/* --- INVOICE / BILL MODAL DYNAMIC POPUP --- */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3 style={{fontFamily: "'Playfair Display', serif", fontWeight: 900, color: 'var(--dark)'}}>Fulfill Order Details</h3>
              <button onClick={() => setSelectedOrder(null)} style={{background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer'}}>×</button>
            </div>
            
            <div className="modal-body">
              {/* Order Metadata */}
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px dashed rgba(0,0,0,0.08)'}}>
                <div>
                  <strong style={{color: 'var(--forest)'}}>{selectedOrder.id}</strong>
                  <div style={{fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.15rem'}}>{new Date(selectedOrder.createdAt).toLocaleString()}</div>
                </div>
                
                {/* Status Dropdown */}
                <div>
                  <select
                    className="admin-input"
                    style={{padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: 'auto'}}
                    value={selectedOrder.status}
                    onChange={(e) => {
                      updateOrder(selectedOrder.id, { status: e.target.value });
                      setSelectedOrder({ ...selectedOrder, status: e.target.value });
                    }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Customer Info */}
              <div style={{background: 'var(--warm-cream)', padding: '0.85rem', borderRadius: '4px', marginBottom: '1.25rem', border: '1px solid rgba(0,0,0,0.04)'}}>
                <div style={{fontSize: '0.9rem', marginBottom: '0.3rem'}}>👤 <strong>Customer:</strong> {selectedOrder.customerName}</div>
                <div style={{fontSize: '0.9rem', marginBottom: '0.3rem'}}>📱 <strong>Phone:</strong> {selectedOrder.customerPhone}</div>
                <div style={{fontSize: '0.9rem'}}>📍 <strong>Delivery Address:</strong> {selectedOrder.customerAddress}</div>
              </div>

              {/* Items Table */}
              <div style={{marginBottom: '1.5rem'}}>
                <h4 style={{fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '0.2rem'}}>Ordered Items</h4>
                <ul style={{listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                  {selectedOrder.items.map((item) => (
                    <li key={item.productId} style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem'}}>
                      <span>{item.name} ({item.weight}) x {item.quantity}</span>
                      <strong style={{color: 'var(--forest)'}}>₹{item.price * item.quantity}</strong>
                    </li>
                  ))}
                  <li style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.95rem', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '0.5rem', marginTop: '0.5rem'}}>
                    <span>Grand Total:</span>
                    <span style={{color: 'var(--maroon)'}}>₹{selectedOrder.totalAmount}</span>
                  </li>
                </ul>
              </div>

              {/* invoice display text box */}
              <div>
                <h4 style={{fontSize: '0.9rem', marginBottom: '0.5rem'}}>Formatted Bill Invoice (Text Receipt)</h4>
                <textarea
                  className="admin-input"
                  style={{height: '140px', fontFamily: 'monospace', fontSize: '0.78rem', background: '#F9F9F9', color: '#333', lineHeight: '1.4', padding: '0.5rem'}}
                  value={generateBillText(selectedOrder)}
                  readOnly
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setSelectedOrder(null)} className="admin-btn" style={{background: 'gray'}}>Close</button>
              {(selectedOrder.status === 'Completed' || selectedOrder.status === 'Delivered') && (
                <>
                  <button onClick={() => handleDownloadInvoice(selectedOrder)} className="admin-btn" style={{background: 'var(--gold)', color: 'var(--dark)'}}>
                    📄 Download PDF Invoice
                  </button>
                  <button onClick={() => sendBillToWhatsApp(selectedOrder)} className="admin-btn" style={{background: '#25D366'}}>
                    💬 Send Bill to WhatsApp
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
