import React, { useContext, useEffect, useState } from 'react';
import { ProductContext, getImageUrl } from '../context/ProductContext';
import { Link } from 'react-router-dom';

const Home = () => {
  const { products, settings, createOrder } = useContext(ProductContext);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    name: localStorage.getItem('cust_name') || '',
    phone: localStorage.getItem('cust_phone') || '+91',
    address: localStorage.getItem('cust_address') || ''
  });
  const [loading, setLoading] = useState(false);
  const [animatingCart, setAnimatingCart] = useState(false);
  const [animatingProduct, setAnimatingProduct] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.product-card,.why-card,.contact-card,.about-card-main').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(22px)';
      el.style.transition = 'opacity .5s ease,transform .5s ease';
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [products, settings]);

  if (!settings) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'var(--cream)'}}>Loading...</div>;

  const activeProducts = products.filter(p => p.isAvailable !== false);
  const categories = [...new Set(activeProducts.map(p => p.category || 'Other'))];

  // Extract custom reviews from settings if available
  const parsedReviews = (() => {
    try {
      return settings?.reviewsData ? JSON.parse(settings.reviewsData) : [];
    } catch {
      return [];
    }
  })();
  const hasCustomReviews = parsedReviews.length > 0;

  // --- CART FUNCTIONS ---
  const triggerFullScreenAnimation = (product) => {
    setAnimatingProduct(product);
    setAnimatingCart(true);
    setTimeout(() => {
      setAnimatingCart(false);
      setAnimatingProduct(null);
    }, 1200); // 1.2s animation
  };

  const addToCart = (product, e) => {
    if (e) {
      triggerFullScreenAnimation(product);
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prevCart,
          {
            productId: product.id,
            name: product.name,
            price: Number(product.price),
            weight: product.weight || '250g',
            quantity: 1
          }
        ];
      }
    });

    // Do not auto-open the cart drawer to allow uninterrupted shopping
    // setTimeout(() => {
    //   setIsCartOpen(true);
    // }, 900);
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const updateQty = (productId, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const handleShare = async (product, e) => {
    e.stopPropagation();
    const shareText = `Check out ${product.name} from Annapurni Foods! Only ₹${product.price} for ${product.weight || '250g'}.`;
    const shareUrl = "https://annapurni-foods.vercel.app/#products"; // using vercel domain with products anchor
    
    try {
      if (navigator.share) {
        let filesArray = [];
        
        try {
          if (product.image) {
            const response = await fetch(product.image);
            const blob = await response.blob();
            const ext = product.image.split('.').pop()?.split('?')[0] || 'jpg';
            const safeName = product.name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            const fileName = `${safeName}-Rs${product.price}.${ext}`;
            const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              filesArray = [file];
            }
          }
        } catch (imgErr) {
          console.log("Could not process image for sharing", imgErr);
        }

        await navigator.share({
          title: 'Annapurni Foods',
          text: shareText,
          url: shareUrl,
          ...(filesArray.length > 0 ? { files: filesArray } : {})
        });
      } else {
        const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        window.open(waUrl, '_blank');
      }
    } catch (err) {
      console.log('Error sharing', err);
    }
  };

  const handleCheckoutChange = (e) => {
    const { name, value } = e.target;
    let formattedVal = value;
    
    // Capitalize first letter of every word
    if (name === 'name' || name === 'address') {
      formattedVal = value.replace(/\b\w/g, char => char.toUpperCase());
    }
    
    setCheckoutData(prev => ({ ...prev, [name]: formattedVal }));
  };

  const handlePhoneChange = (e) => {
    let val = e.target.value;
    
    // Auto-prepend +91 and keep it formatted elegantly
    if (val === '') {
      val = '+91';
    } else if (!val.startsWith('+91')) {
      const digits = val.replace(/[^0-9]/g, '');
      val = '+91' + digits;
    } else {
      const digits = val.substring(3).replace(/[^0-9]/g, '');
      val = '+91' + digits;
    }
    
    // Max 10 digits after country code = 13 characters limit
    if (val.length <= 13) {
      setCheckoutData(prev => ({ ...prev, phone: val }));
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (checkoutData.phone.length < 13) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);

    const total = getCartTotal();
    const orderData = {
      customerName: checkoutData.name,
      customerPhone: checkoutData.phone,
      customerAddress: checkoutData.address,
      items: cart,
      totalAmount: total
    };

    try {
      const newOrder = await createOrder(orderData);
      if (newOrder) {
        // Prepare beautiful itemized WhatsApp message
        let itemsText = '';
        cart.forEach((item, index) => {
          itemsText += `\n${index + 1}. ${item.name} (${item.weight}) x ${item.quantity} - ₹${item.price * item.quantity}`;
        });

        const waMessage = `*ANNAPURNI FOODS ORDER RECEIPT* 🌾\n` +
          `------------------------------\n` +
          `*Order ID:* ${newOrder.id}\n` +
          `*Name:* ${newOrder.customerName}\n` +
          `*Phone:* ${newOrder.customerPhone}\n` +
          `*Address:* ${newOrder.customerAddress}\n` +
          `------------------------------\n` +
          `*Items ordered:*${itemsText}\n` +
          `------------------------------\n` +
          `*Total Amount:* ₹${newOrder.totalAmount}\n\n` +
          `Thank you for ordering traditional homemade delicacies! Please confirm my order. ❤️`;

        const encodedMsg = encodeURIComponent(waMessage);
        const adminNumber = settings.whatsappNumber.replace(/[^0-9]/g, '');
        
        // Open WhatsApp link
        window.location.href = `https://wa.me/${adminNumber}?text=${encodedMsg}`;
        
        // Save details to localStorage for instant subsequent checkouts!
        localStorage.setItem('cust_name', checkoutData.name);
        localStorage.setItem('cust_phone', checkoutData.phone);
        localStorage.setItem('cust_address', checkoutData.address);
        
        // Reset Cart and close drawer, keeping the customer details preserved!
        setCart([]);
        setIsCartOpen(false);
        alert('Order placed successfully! WhatsApp has been opened to finalize your purchase.');
      } else {
        alert('Failed to save order in database. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during checkout.');
    } finally {
      setLoading(false);
    }
  };

  const contactWa = () => {
    const msg = encodeURIComponent(`Hi! I want to place an order from Annapurni Foods.`);
    const number = settings.whatsappNumber.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${number}?text=${msg}`, '_blank');
  };

  const orderCombo = () => {
    const msg = encodeURIComponent(`Hi, I want to order a Combo Pack from Annapurni Foods.`);
    const number = settings.whatsappNumber.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${number}?text=${msg}`, '_blank');
  };

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return '';
    let videoId = '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    } else {
      return url;
    }
    return `https://www.youtube.com/embed/${videoId}`;
  };

  const hasSocialLinks = settings && (settings.instagram || settings.facebook || settings.youtube);
  const hasGallery = settings && (settings.makingVideoUrl || settings.makingImage1 || settings.makingImage2 || settings.makingImage3);

  return (
    <>
      {/* NAV */}
      <nav style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '0.5rem'}}>
        <div className="nav-brand" style={{display: 'flex', alignItems: 'center', gap: 'clamp(0.4rem, 2vw, 0.8rem)', flexShrink: 1, minWidth: 0}}>
          <img src="/images/annapurni-brand-logo.jpg" alt="Annapurni Logo" style={{width: 'clamp(32px, 8vw, 40px)', height: 'clamp(32px, 8vw, 40px)', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', flexShrink: 0}} />
          <span className="nav-name" style={{fontSize: 'clamp(1.25rem, 5.5vw, 2.5rem)', fontWeight: '900', color: '#ffffff', fontFamily: '"Playfair Display", serif', letterSpacing: '1px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>Annapurni Foods</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 2vw, 2rem)', flexShrink: 0}}>
          <ul className="nav-links" style={{margin: 0, padding: 0}}>
            <li><a href="#about">About</a></li>
            <li><a href="#products">Products</a></li>
            <li><a href="#why">Why Us</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
          <button onClick={() => setIsCartOpen(true)} className="nav-cta" style={{border:'none', cursor:'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, whiteSpace: 'nowrap'}}>
            🛒 Cart {getCartCount() > 0 && `(${getCartCount()})`}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg-pattern"></div>
        <div className="hero-arch"></div>
        <div className="hero-arch2"></div>

        {/* Traditional Lady Logo Image — placed first so it appears above text on mobile */}
        <div className="hero-illustration">
          <div className="hero-logo-frame">
            <div className="hero-logo-image"></div>
          </div>
        </div>

        <div className="hero-content">
          <div className="hero-badge">🏠 Home-Cooked Tradition</div>
          <p className="hero-tagline-top">Since Paatti's Kitchen</p>
          <h1 className="hero-title">{settings.heroText}</h1>
          <div className="hero-rule"><div className="hero-rule-diamond"></div></div>
          <p className="hero-tagline">🍚 {settings.heroTagline}</p>
          <p className="hero-desc">Welcome to Annapurni Foods — where every jar carries the warmth of a traditional South Indian kitchen. Made with premium ingredients and generations of love.</p>
          <div className="hero-actions">
            <a href="#products" className="btn-primary highlight-anim">🛍️ View Products</a>
            <button onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })} className="btn-secondary highlight-anim" style={{backgroundColor: 'var(--maroon)', border: 'none', color: 'var(--cream)', cursor:'pointer'}}>📱 Shop Now</button>
          </div>
          <div className="hero-stats">
            <div className="stat-item"><div className="stat-num">{activeProducts.length}+</div><div className="stat-label">Varieties</div></div>
            <div className="stat-item"><div className="stat-num">100%</div><div className="stat-label">Homemade</div></div>
            <div className="stat-item"><div className="stat-num">{settings.isOpen ? 'OPEN' : 'CLOSED'}</div><div className="stat-label">Status</div></div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee-section">
        <div className="marquee-inner">
          <span>🌿 Pudina Thokku <span className="marquee-dot">✦</span></span>
          <span>🌶️ Gongura Thokku <span className="marquee-dot">✦</span></span>
          <span>🍋 Puli Kaachal <span className="marquee-dot">✦</span></span>
          <span>🍅 Thakkali Thokku <span className="marquee-dot">✦</span></span>
          <span>🌱 Inju Thokku <span className="marquee-dot">✦</span></span>
          <span>🫚 Nellika Chammanthi <span className="marquee-dot">✦</span></span>
          <span>🌿 Kothamalli Thuvaiyal <span className="marquee-dot">✦</span></span>
          <span>🏠 100% Homemade <span className="marquee-dot">✦</span></span>
          <span>❤️ Made with Love <span className="marquee-dot">✦</span></span>
          <span>🌿 Pudina Thokku <span className="marquee-dot">✦</span></span>
          <span>🌶️ Gongura Thokku <span className="marquee-dot">✦</span></span>
          <span>🍋 Puli Kaachal <span className="marquee-dot">✦</span></span>
          <span>🍅 Thakkali Thokku <span className="marquee-dot">✦</span></span>
          <span>🌱 Inju Thokku <span className="marquee-dot">✦</span></span>
          <span>🫚 Nellika Chammanthi <span className="marquee-dot">✦</span></span>
          <span>🌿 Kothamalli Thuvaiyal <span className="marquee-dot">✦</span></span>
          <span>🏠 100% Homemade <span className="marquee-dot">✦</span></span>
          <span>❤️ Made with Love <span className="marquee-dot">✦</span></span>
        </div>
      </div>

      {/* ABOUT */}
      <section className="about" id="about">
        <div className="about-grid">
          <div className="about-visual">
            <div className="about-card-main">
              <div style={{fontSize:'2.8rem',marginBottom:'.8rem'}}>🍲</div>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',color:'var(--dark)',marginBottom:'.5rem'}}>The Taste of Home</h3>
              <div className="divider"><span className="divider-icon">✦</span></div>
              <div className="about-card-inner">
                <p style={{color:'var(--muted)',lineHeight:1.8,fontSize:'.92rem'}}>Every jar of Annapurni foods carries the warmth of a traditional South Indian kitchen — hand-crafted using time-honored recipes passed down through generations.</p>
                <div className="about-icon-row">
                  <div className="icon-chip">🌿 Natural</div>
                  <div className="icon-chip">🚫 No Preservatives</div>
                  <div className="icon-chip">❤️ With Love</div>
                  <div className="icon-chip">🏡 Home Kitchen</div>
                </div>
              </div>
            </div>
            <div className="about-float-card">
              <span className="big">{settings.isOpen ? 'OPEN' : 'CLOSED'}</span>
              <span className="small">Current Status</span>
            </div>
          </div>
          <div className="about-text">
            <span className="section-label">✦ Our Story ✦</span>
            <h2 className="section-title">Bringing <em>Authentic</em> Home Flavors to You</h2>
            <div className="divider"><span className="divider-icon">✦</span></div>
            <p style={{color:'var(--muted)',lineHeight:1.8,marginTop:'.5rem'}}>At Annapurni Foods, we believe food is love made tangible. Our products are meticulously prepared using freshly sourced ingredients, traditional grinding methods, and recipes cherished across generations of South Indian homes.</p>
            <ul className="features-list">
              <li><div className="feat-icon">✓</div><span>Freshly sourced, premium quality ingredients for every batch</span></li>
              <li><div className="feat-icon">✓</div><span>Traditional stone-ground textures — no shortcuts, no compromises</span></li>
              <li><div className="feat-icon">✓</div><span>Zero artificial preservatives — pure, wholesome, and natural</span></li>
              <li><div className="feat-icon">✓</div><span>Made in small batches to ensure consistent taste and quality</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" style={{padding:'5rem 2.5rem'}}>
        <div className="products-inner">
          <div className="products-header">
            <div>
              <span className="section-label">✦ Our Products ✦</span>
              <h2 className="section-title">Our <em>Signature</em> Range</h2>
            </div>
            <button onClick={() => setIsCartOpen(true)} className="btn-primary" style={{alignSelf:'flex-start', cursor:'pointer', border:'none'}}>🛒 View Cart</button>
          </div>
          
          {categories.map(category => {
            const catProducts = activeProducts.filter(p => (p.category || 'Other') === category);
            if(catProducts.length === 0) return null;
            return (
              <div key={category} style={{marginBottom: '4rem'}}>
                <h3 style={{fontFamily: "'Playfair Display',serif", fontSize: '2rem', color: 'var(--forest)', borderBottom: '2px solid var(--border-gold)', paddingBottom: '0.5rem', marginBottom: '2rem'}}>{category}</h3>
                <div className="products-grid">
                  {catProducts.map(product => (
                    <div key={product.id} className="product-card">
                      <div className="product-img-wrap">
                        <img 
                          className="product-img" 
                          src={getImageUrl(product.image)} 
                          alt={product.name} 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.parentElement.style.background = 'linear-gradient(135deg,#1B4332,#2D6A4F)';
                            e.target.style.display = 'none';
                          }} 
                        />
                      </div>
                      <div className="product-body">
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem'}}>
                          <h4 className="product-name" style={{margin: 0, fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--dark)'}}>{product.name}</h4>
                          {product.badge && (
                            <span style={{background: 'var(--maroon)', color: 'var(--cream)', fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '2px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em'}}>
                              {product.badge}
                            </span>
                          )}
                        </div>
                        <p className="product-desc" style={{minHeight: '40px', marginBottom: '0.75rem'}}>{product.desc}</p>
                        <div className="product-footer">
                          <div className="price-group">
                            <span className="price-current">₹{product.price}</span>
                            <span style={{fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'bold'}}>{product.weight || '250g'}</span>
                          </div>
                          <div style={{display: 'flex', gap: '0.5rem'}}>
                            <button className="share-btn" onClick={(e) => handleShare(product, e)} title="Share to WhatsApp/Social" style={{
                              background: 'rgba(0,0,0,0.05)',
                              border: 'none',
                              borderRadius: '50%',
                              width: '35px',
                              height: '35px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: 'var(--forest)',
                              transition: 'all 0.2s ease'
                            }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                              </svg>
                            </button>
                            <button className="add-btn" onClick={(e) => addToCart(product, e)}>+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* CTA Card for Combo */}
          <div className="product-card" style={{background:'var(--forest)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'280px',textAlign:'center',padding:'2rem',cursor:'default',border:'2px solid rgba(201,134,10,0.4)', maxWidth: '500px', margin: '0 auto', gridColumn: '1 / -1'}}>
            <div style={{fontSize:'2.5rem',marginBottom:'1rem'}}>🛍️</div>
            <h3 style={{fontFamily:"'Playfair Display',serif",color:'var(--cream)',fontSize:'1.25rem',marginBottom:'.5rem'}}>Want a Combo?</h3>
            <div style={{width:'40px',height:'1px',background:'var(--gold)',margin:'.5rem auto'}}></div>
            <p style={{color:'rgba(254,250,224,.7)',fontSize:'.88rem',lineHeight:1.6,marginBottom:'1.3rem'}}>Order multiple jars and ask us about special combo pricing!</p>
            <button onClick={orderCombo} className="btn-primary" style={{cursor:'pointer', border:'none'}}>💬 Ask on WhatsApp</button>
          </div>

        </div>
      </section>

      {/* WHY US */}
      <section className="why" id="why">
        <div className="why-bg"></div>
        <div className="why-inner">
          <div>
            <span className="section-label">✦ Why Choose Us ✦</span>
            <h2 className="section-title">Homemade Taste,<br/><em>Every Time</em></h2>
            <div className="divider" style={{justifyContent:'flex-start',maxWidth:'280px'}}><div style={{width:'40px',height:'1px',background:'var(--border-gold)'}}></div><span style={{color:'var(--gold)',fontSize:'.8rem'}}>✦</span><div style={{flex:1,height:'1px',background:'var(--border-gold)'}}></div></div>
            <p style={{color:'rgba(254,250,224,.65)',marginTop:'.5rem',lineHeight:1.8,fontSize:'.95rem'}}>We are not a factory — we are a family kitchen that pours its heart into every batch.</p>
            <div className="why-quote">
              <p>"Real south Indian flavours that remind you of paatti's kitchen — pure, rich, and deeply satisfying."</p>
              <span>— Annapurni Foods Promise</span>
            </div>
          </div>
          <div className="why-cards">
            <div className="why-card">
              <div className="why-card-icon">🌾</div>
              <h4>Fresh Ingredients</h4>
              <p>Sourced fresh every batch — no frozen or stale inputs, ever.</p>
            </div>
            <div className="why-card">
              <div className="why-card-icon">🏺</div>
              <h4>Traditional Recipes</h4>
              <p>Age-old family recipes passed through generations of Tamil kitchens.</p>
            </div>
            <div className="why-card">
              <div className="why-card-icon">🚚</div>
              <h4>Fast Delivery</h4>
              <p>Quick delivery within Chennai — order via WhatsApp and receive same day.</p>
            </div>
            <div className="why-card">
              <div className="why-card-icon">💯</div>
              <h4>No Preservatives</h4>
              <p>Pure, natural, preservative-free. Just food the way it should be.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CUSTOMER REVIEWS */}
      <section className="reviews-section" style={{padding: '5rem 1rem', background: 'var(--cream)', borderTop: '1px solid rgba(0,0,0,0.05)'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
          <div style={{textAlign: 'center', marginBottom: '3rem'}}>
            <span className="section-label">✦ Testimonials ✦</span>
            <h2 className="section-title">Customer <em>Reviews</em></h2>
          </div>
          <div className="reviews-grid" style={{display: 'flex', gap: '2rem', overflowX: 'auto', paddingBottom: '1rem', snapType: 'x mandatory'}}>
            {hasCustomReviews ? (
              parsedReviews.map((r, i) => (
                <div key={i} className="review-card" style={{minWidth: '300px', flex: 1, background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', snapAlign: 'center', borderTop: '4px solid var(--gold)'}}>
                  <div style={{color: 'var(--gold)', fontSize: '1.5rem', marginBottom: '1rem'}}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</div>
                  <p style={{fontStyle: 'italic', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: '1.6'}}>"{r.text}"</p>
                  <div style={{fontWeight: 'bold', color: 'var(--forest)'}}>- {r.name}{r.location ? `, ${r.location}` : ''}</div>
                </div>
              ))
            ) : (
              <>
                <div className="review-card" style={{minWidth: '300px', flex: 1, background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', snapAlign: 'center', borderTop: '4px solid var(--gold)'}}>
                  <div style={{color: 'var(--gold)', fontSize: '1.5rem', marginBottom: '1rem'}}>★★★★★</div>
                  <p style={{fontStyle: 'italic', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: '1.6'}}>"Absolutely love the Pirandai Thokku! It tastes just like how my grandmother used to make it. Very authentic and fresh."</p>
                  <div style={{fontWeight: 'bold', color: 'var(--forest)'}}>- Meera K., Chennai</div>
                </div>
                <div className="review-card" style={{minWidth: '300px', flex: 1, background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', snapAlign: 'center', borderTop: '4px solid var(--gold)'}}>
                  <div style={{color: 'var(--gold)', fontSize: '1.5rem', marginBottom: '1rem'}}>★★★★★</div>
                  <p style={{fontStyle: 'italic', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: '1.6'}}>"The Gongura Thokku is perfectly spiced. It goes so well with hot rice and ghee. Delivered on time and great packaging."</p>
                  <div style={{fontWeight: 'bold', color: 'var(--forest)'}}>- Rajesh V., Tambaram</div>
                </div>
                <div className="review-card" style={{minWidth: '300px', flex: 1, background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', snapAlign: 'center', borderTop: '4px solid var(--gold)'}}>
                  <div style={{color: 'var(--gold)', fontSize: '1.5rem', marginBottom: '1rem'}}>★★★★★</div>
                  <p style={{fontStyle: 'italic', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: '1.6'}}>"No preservatives is a big plus for me. The PuliYotharai paste makes cooking so easy and it tastes amazing."</p>
                  <div style={{fontWeight: 'bold', color: 'var(--forest)'}}>- Anitha S., Velachery</div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* KITCHEN MEDIA GALLERY */}
      {hasGallery && (
        <section className="kitchen-gallery-section" id="gallery">
          <div className="gallery-inner">
            <div className="gallery-header">
              <span className="section-label">✦ Behind The Scenes ✦</span>
              <h2 className="section-title" style={{textAlign: 'center'}}>Inside <em>Our Kitchen</em></h2>
              <p className="section-sub" style={{textAlign: 'center', margin: '0 auto 2.5rem auto', maxWidth: '600px'}}>
                Watch how we grind our traditional thokkus using wood-pressed oils, fresh hand-picked leaves, and age-old Tamil Nadu family secrets.
              </p>
            </div>
            
            <div className={`gallery-grid-layout ${(!settings.makingVideoUrl || (!settings.makingImage1 && !settings.makingImage2 && !settings.makingImage3)) ? 'single-col' : ''}`}>
              {/* Left Column: YouTube Video */}
              {settings.makingVideoUrl && (
                <div className="gallery-video-container">
                  <div className="video-player-frame">
                    <iframe
                      src={getYouTubeEmbedUrl(settings.makingVideoUrl)}
                      title="Annapurni Kitchen Making Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div className="video-caption">
                    <span className="play-pulse-dot"></span>
                    <span>🎬 Traditional Preparation & Grinding Showcase</span>
                  </div>
                </div>
              )}

              {/* Right Column: Photos Grid */}
              {(settings.makingImage1 || settings.makingImage2 || settings.makingImage3) && (
                <div className="gallery-images-container">
                  {settings.makingImage1 && (
                    <div className="gallery-img-card">
                      <img src={settings.makingImage1} alt="Fresh Ingredients Sourced Daily" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'var(--forest)'; }} />
                      <div className="img-overlay">
                        <span>🍃 Fresh Ingredients Sourced Daily</span>
                      </div>
                    </div>
                  )}
                  {settings.makingImage2 && (
                    <div className="gallery-img-card">
                      <img src={settings.makingImage2} alt="Traditional Grinding Mortar" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'var(--forest)'; }} />
                      <div className="img-overlay">
                        <span>🏺 Traditional Grinding Mortar</span>
                      </div>
                    </div>
                  )}
                  {settings.makingImage3 && (
                    <div className="gallery-img-card">
                      <img src={settings.makingImage3} alt="Safe & Hygienic Jar Packaging" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'var(--forest)'; }} />
                      <div className="img-overlay">
                        <span>📦 Safe & Hygienic Jar Packaging</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section className="contact-section" id="contact">
        <div className="contact-inner">
          <div className="contact-header">
            <span className="section-label">✦ Get In Touch ✦</span>
            <h2 className="section-title" style={{textAlign:'center'}}>Order or <em>Visit Us</em></h2>
            <p className="section-sub" style={{textAlign:'center',margin:'0 auto'}}>We'd love to hear from you! Reach out on phone or WhatsApp to place your order, or visit our store in Tambaram, Chennai.</p>
          </div>
          <div className="contact-grid">
            <a href={`tel:${settings.whatsappNumber.replace(/[^0-9+]/g, '')}`} className="contact-card">
              <div className="contact-icon icon-phone">📞</div>
              <div className="contact-info">
                <h4>Call Us</h4>
                <p><span style={{color:'var(--forest)',fontWeight:700}}>{settings.whatsappNumber}</span></p>
                <p style={{fontSize:'.78rem',marginTop:'.2rem',color:'var(--muted)'}}>Tap to call directly</p>
              </div>
            </a>
            <div onClick={contactWa} className="contact-card" style={{cursor:'pointer'}}>
              <div className="contact-icon icon-wa">💬</div>
              <div className="contact-info">
                <h4>WhatsApp Order</h4>
                <p><span style={{color:'var(--forest)',fontWeight:700}}>{settings.whatsappNumber}</span></p>
                <p style={{fontSize:'.78rem',marginTop:'.2rem',color:'var(--muted)'}}>Chat &amp; order directly</p>
              </div>
            </div>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} target="_blank" rel="noopener noreferrer" className="contact-card" style={{textDecoration: 'none', color: 'inherit'}}>
              <div className="contact-icon icon-loc">📍</div>
              <div className="contact-info">
                <h4>Our Location</h4>
                <p>{settings.address}</p>
                <p style={{fontSize:'.78rem',marginTop:'.2rem',color:'var(--muted)'}}>Tap to view on map</p>
              </div>
            </a>
            <div className="contact-card">
              <div className="contact-icon icon-time">🕐</div>
              <div className="contact-info">
                <h4>Working Hours</h4>
                <div className="open-badge">
                  <span className="open-dot" style={{background: settings.isOpen ? '#4CAF50' : '#F44336'}}></span> 
                  {settings.isOpen ? 'Open Now' : 'Closed'}
                </div>
                <p style={{marginTop:'.4rem'}}>Available for Orders</p>
              </div>
            </div>
          </div>

          {/* Map Section */}
          <div className="map-container" style={{marginTop: '3rem', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(201,134,10,0.2)', boxShadow: '0 8px 30px rgba(0,0,0,0.06)'}}>
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3888.6180556271966!2d80.11900137596001!3d12.932252187379207!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a525f778a4e32d1%3A0x63cd84b42fb926b4!2sRanganathan%20St%2C%20East%20Tambaram%2C%20Tambaram%2C%20Chennai%2C%20Tamil%20Nadu%20600059!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin" 
              width="100%" 
              height="300" 
              style={{border:0, display: 'block'}} 
              allowFullScreen="" 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Shop Location"
            ></iframe>
          </div>

          {hasSocialLinks && (
            <div className="social-connect-container">
              <div className="social-connect-divider">
                <span className="social-divider-line"></span>
                <span className="social-divider-text">Connect With Us</span>
                <span className="social-divider-line"></span>
              </div>
              <div className="social-buttons-grid">
                {settings.instagram && (
                  <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="social-btn instagram" title="Follow us on Instagram">
                    <span className="social-icon-wrapper">
                      <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="20" width="20" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                    </span>
                    <span className="social-label-text">Instagram</span>
                  </a>
                )}
                {settings.facebook && (
                  <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="social-btn facebook" title="Like us on Facebook">
                    <span className="social-icon-wrapper">
                      <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                    </span>
                    <span className="social-label-text">Facebook</span>
                  </a>
                )}
                {settings.youtube && (
                  <a href={settings.youtube} target="_blank" rel="noopener noreferrer" className="social-btn youtube" title="Subscribe on YouTube">
                    <span className="social-icon-wrapper">
                      <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
                    </span>
                    <span className="social-label-text">YouTube</span>
                  </a>
                )}
              </div>
              
              {/* Dynamic Social Embeds from Admin Settings */}
              {(settings.instaEmbed || settings.fbEmbed || settings.ytEmbed) && (
                <div className="social-embeds-grid" style={{display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '3rem', flexWrap: 'wrap'}}>
                  {settings.instaEmbed && (
                    <div className="social-embed-card" style={{flex: '1 1 300px', maxWidth: '350px', background: 'var(--cream)', padding: '1rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)'}} dangerouslySetInnerHTML={{__html: settings.instaEmbed}} />
                  )}
                  {settings.fbEmbed && (
                    <div className="social-embed-card" style={{flex: '1 1 300px', maxWidth: '350px', background: 'var(--cream)', padding: '1rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)'}} dangerouslySetInnerHTML={{__html: settings.fbEmbed}} />
                  )}
                  {settings.ytEmbed && (
                    <div className="social-embed-card" style={{flex: '1 1 300px', maxWidth: '350px', background: 'var(--cream)', padding: '1rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)'}}>
                      <iframe width="100%" height="250" src={`https://www.youtube.com/embed/${settings.ytEmbed}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{borderRadius: '8px'}}></iframe>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-brand">🍃 Annapurni Foods</div>
        <div className="footer-tag">"{settings.heroTagline}"</div>
        
        {hasSocialLinks && (
          <div className="footer-social-row">
            {settings.instagram && (
              <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="footer-social-icon instagram" title="Instagram">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
            )}
            {settings.facebook && (
              <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="footer-social-icon facebook" title="Facebook">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
            )}
            {settings.youtube && (
              <a href={settings.youtube} target="_blank" rel="noopener noreferrer" className="footer-social-icon youtube" title="YouTube">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
              </a>
            )}
          </div>
        )}

        <div className="footer-divider"></div>
        <p style={{fontSize:'.88rem',color:'rgba(254,250,224,.5)',maxWidth:'400px',margin:'0 auto'}}>Authentic home-cooked thokku &amp; pickles, made with love in Chennai. Order now via WhatsApp!</p>
        <div className="footer-links">
          <a href="#about">About</a>
          <a href="#products">Products</a>
          <a href="#why">Why Us</a>
          <a href="#contact">Contact</a>
          <Link to="/admin/login" style={{color: 'rgba(254,250,224,0.2)'}}>Admin Login</Link>
        </div>
        <div className="footer-copy">© 2026 Annapurni Foods · Tambaram, Chennai · Made with ❤️ DigitalRajaa07</div>
      </footer>

      {/* Floating Cart FAB */}
      <button onClick={() => setIsCartOpen(true)} className="cart-fab" title="View Cart">
        {getCartCount() > 0 && <span className="cart-fab-badge">{getCartCount()}</span>}
        <span style={{fontSize: '1.4rem'}}>🛒</span>
      </button>

      {/* WhatsApp FAB */}
      <button onClick={contactWa} className="wa-fab" title="Order on WhatsApp" style={{border:'none', cursor:'pointer', bottom: '170px'}}>
        <span className="wa-tooltip">Order on WhatsApp!</span>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </button>

      {/* Cart Drawer */}
      <div className={`cart-drawer-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}></div>
      <div className={`cart-drawer ${isCartOpen ? 'open' : ''}`}>
        <div className="cart-drawer-header">
          <h3 style={{fontFamily: "'Playfair Display', serif", fontWeight: 700}}>🌾 Shopping Cart</h3>
          <button className="cart-close-btn" onClick={() => setIsCartOpen(false)}>×</button>
        </div>
        <div className="cart-drawer-body">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <span style={{fontSize: '3rem', display: 'block', marginBottom: '1rem'}}>🛒</span>
              Your cart is empty.<br/>Browse our delicious homemade range!
            </div>
          ) : (
            <>
              {cart.map((item) => (
                <div key={item.productId} className="cart-item-row">
                  <div className="cart-item-info">
                    <div className="cart-item-title">{item.name}</div>
                    <div className="cart-item-meta">{item.weight} · ₹{item.price} each</div>
                  </div>
                  <div className="cart-item-qty">
                    <button className="cart-qty-btn" onClick={() => updateQty(item.productId, -1)}>-</button>
                    <span style={{fontWeight: 'bold', fontSize: '0.9rem'}}>{item.quantity}</span>
                    <button className="cart-qty-btn" onClick={() => updateQty(item.productId, 1)}>+</button>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.85rem'}}>
                    <div className="cart-item-price" style={{margin: 0}}>₹{item.price * item.quantity}</div>
                    <button 
                      onClick={() => removeFromCart(item.productId)} 
                      style={{background: 'transparent', border: 'none', color: 'var(--maroon)', cursor: 'pointer', fontSize: '1.05rem', padding: '0.2rem', display: 'flex', alignItems: 'center', transition: 'transform 0.2s'}}
                      title="Remove product"
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}

              <div style={{display: 'flex', justifyContent: 'space-between', padding: '1.25rem 0', fontWeight: 'bold', borderTop: '2px solid rgba(0,0,0,0.06)'}}>
                <span>Total Amount:</span>
                <span style={{color: 'var(--forest)', fontSize: '1.2rem'}}>₹{getCartTotal()}</span>
              </div>

              {/* Checkout Form */}
              <form onSubmit={handleCheckout} className="checkout-form">
                <h4>Checkout Details</h4>
                <div className="admin-form-group">
                  <label style={{fontSize: '0.8rem'}}>Your Name <span style={{color: 'red'}}>*</span></label>
                  <input type="text" name="name" className="admin-input" style={{padding: '0.5rem'}} value={checkoutData.name} onChange={handleCheckoutChange} autoComplete="name" required />
                </div>
                <div className="admin-form-group">
                  <label style={{fontSize: '0.8rem'}}>Phone / WhatsApp Number <span style={{color: 'red'}}>*</span></label>
                  <input type="tel" name="phone" className="admin-input" style={{padding: '0.5rem'}} placeholder="+91..." value={checkoutData.phone} onChange={handlePhoneChange} autoComplete="tel" required />
                </div>
                <div className="admin-form-group">
                  <label style={{fontSize: '0.8rem'}}>Delivery Address <span style={{color: 'red'}}>*</span></label>
                  <textarea name="address" className="admin-input" style={{padding: '0.5rem', resize: 'vertical', height: '60px'}} value={checkoutData.address} onChange={handleCheckoutChange} autoComplete="street-address" required></textarea>
                </div>
                <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '1rem', border: 'none'}} disabled={loading}>
                  {loading ? 'Placing Order...' : '💬 Confirm & Order on WhatsApp'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* FULL SCREEN ADD TO CART ANIMATION */}
      {animatingCart && animatingProduct && (
        <div className="cart-anim-overlay">
          <div className="cart-anim-content">
            <div className="cart-anim-icon">🛒</div>
            <img src={animatingProduct.image || '/images/default.jpg'} alt="Product" className="cart-anim-product" />
            <h3 className="cart-anim-text">Added {animatingProduct.name} to Cart!</h3>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
