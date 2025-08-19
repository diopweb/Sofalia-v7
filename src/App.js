import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    writeBatch,
    getDoc,
    setDoc,
    getDocs,
    where,
    orderBy,
    runTransaction,
} from 'firebase/firestore';
import { Printer, Plus, Trash2, Edit, X, Users, Package, ShoppingCart, DollarSign, BarChart2, Tag, Image as ImageIcon, CreditCard, CheckCircle, ListChecks, Settings, AlertCircle, FileText, ArrowLeft, Filter, Share2, List, LayoutGrid, MinusCircle, PlusCircle, Search, Archive, ChevronDown } from 'lucide-react';

// --- Translations ---
const translations = {
    fr: {
        dashboard: "Tableau de Bord", products: "Produits", categories: "Catégories", customers: "Clients", sales: "Ventes",
        debts: "Créances", refunds: "Remboursements", settings: "Paramètres", newSale: "Nouvelle Vente", searchPlaceholder: "Rechercher une facture, un client, un produit...",
        searchResults: "Résultats de la recherche", invoices: "Factures", salesToday: "Ventes du Jour", totalSales: "Total Ventes",
        lowStock: "Stocks Faibles", currentStock: "Stock Actuel", threshold: "Seuil", recentSales: "Ventes Récentes", invoiceNo: "N° Facture",
        total: "Total", date: "Date", addProduct: "Ajouter Produit", startSale: "Démarrer la Vente", productList: "Liste des produits",
        stockManagement: "Gestion du Stock", photo: "Photo", name: "Nom", category: "Catégorie", stock: "Stock", price: "Prix", actions: "Actions",
        edit: "Modifier", delete: "Supprimer", addCategory: "Ajouter Catégorie", parentCategory: "Catégorie Parente", addCustomer: "Ajouter Client",
        searchCustomer: "Rechercher un client...", nickname: "Surnom", phone: "Téléphone", customerDeposit: "Acompte Client",
        loading: "Chargement...", backToList: "Retour à la liste", purchaseHistory: "Historique des achats", noPurchases: "Aucun achat enregistré.",
        filter: "Filtrer", hide: "Masquer", today: "Aujourd'hui", thisWeek: "Cette semaine", thisMonth: "Ce mois", thisYear: "Cette année", all: "Toutes",
        from: "Du", to: "Au", totalDisplayed: "Total affiché", amountDue: "Montant Dû", makePayment: "Faire un paiement", refundHistory: "Historique de Remboursements",
        amount: "Montant", method: "Méthode", invoiceRef: "Facture Réf.", generalInfo: "Informations Générales", companyName: "Nom de l'entreprise",
        address: "Adresse", docCustomization: "Personnalisation des Documents", salesInvoicePrefix: "Préfixe Facture de Vente",
        refundInvoicePrefix: "Préfixe Facture de Remboursement", depositReceiptPrefix: "Préfixe Reçu d'Acompte", invoiceFooterMessage: "Message de Pied de Facture",
        save: "Enregistrer", language: "Langue", francais: "Français", english: "Anglais",
    },
    en: {
        dashboard: "Dashboard", products: "Products", categories: "Categories", customers: "Customers", sales: "Sales",
        debts: "Debts", refunds: "Refunds", settings: "Settings", newSale: "New Sale", searchPlaceholder: "Search for an invoice, customer, product...",
        searchResults: "Search Results", invoices: "Invoices", salesToday: "Today's Sales", totalSales: "Total Sales",
        lowStock: "Low Stock", currentStock: "Current Stock", threshold: "Threshold", recentSales: "Recent Sales", invoiceNo: "Invoice #",
        total: "Total", date: "Date", addProduct: "Add Product", startSale: "Start Sale", productList: "Product List",
        stockManagement: "Stock Management", photo: "Photo", name: "Name", category: "Category", stock: "Stock", price: "Price", actions: "Actions",
        edit: "Edit", delete: "Delete", addCategory: "Add Category", parentCategory: "Parent Category", addCustomer: "Add Customer",
        searchCustomer: "Search for a customer...", nickname: "Nickname", phone: "Phone", customerDeposit: "Customer Deposit",
        loading: "Loading...", backToList: "Back to list", purchaseHistory: "Purchase History", noPurchases: "No purchases recorded.",
        filter: "Filter", hide: "Hide", today: "Today", thisWeek: "This week", thisMonth: "This month", thisYear: "This year", all: "All",
        from: "From", to: "To", totalDisplayed: "Total displayed", amountDue: "Amount Due", makePayment: "Make Payment", refundHistory: "Refund History",
        amount: "Amount", method: "Method", invoiceRef: "Invoice Ref.", generalInfo: "General Information", companyName: "Company Name",
        address: "Address", docCustomization: "Document Customization", salesInvoicePrefix: "Sales Invoice Prefix",
        refundInvoicePrefix: "Refund Invoice Prefix", depositReceiptPrefix: "Deposit Receipt Prefix", invoiceFooterMessage: "Invoice Footer Message",
        save: "Save", language: "Language", francais: "French", english: "English",
    }
};


// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Constants ---
const PAYMENT_TYPES = ["Espèce", "Wave", "Orange Money", "Créance", "Acompte Client"];
const ROLES = { ADMIN: 'admin', VENDEUR: 'vendeur' };
const SALE_STATUS = {
    COMPLETED: 'Complété',
    PARTIALLY_RETURNED: 'Partiellement Retourné',
    RETURNED: 'Retourné',
    CREDIT: 'Créance',
};
const VAT_RATE = 0.18; // 18%
const PRODUCT_TYPES = { SIMPLE: 'simple', PACK: 'pack', VARIANT: 'variant' };

// --- Utility Functions ---
const formatCurrency = (number, lang = 'fr') => {
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    const currencyDisplay = 'F CFA';
    if (isNaN(Number(number))) return `0 ${currencyDisplay}`;
    return Number(number).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/,/g, ' ') + ` ${currencyDisplay}`;
};

const formatDateTime = (isoString, lang = 'fr') => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.DateTimeFormat(locale, options).format(date);
};

const formatDate = (isoString, lang = 'fr') => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.DateTimeFormat(locale, options).format(date);
};

const toInputDate = (date) => {
 if (!date) return '';
 const d = new Date(date);
 const year = d.getFullYear();
 const month = (d.getMonth() + 1).toString().padStart(2, '0');
 const day = d.getDate().toString().padStart(2, '0');
 return `${year}-${month}-${day}`;
};

const resizeImage = (file, maxWidth, maxHeight) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } }
            else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
});

// --- UI Components ---
const Modal = React.memo(({ children, onClose, size = 'md' }) => {
    const sizeClass = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl', '5xl': 'max-w-5xl', '7xl': 'max-w-7xl' }[size];
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start p-4 overflow-auto">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClass} m-4 mt-12`}>
                <div className="flex justify-end p-2 no-print"><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                <div className="px-4 sm:px-8 pb-8">{children}</div>
            </div>
        </div>
    );
});

const AlertModal = React.memo(({ message, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm m-4 p-8 text-center">
            <p className="mb-6">{message}</p>
            <button onClick={onClose} className="px-6 py-2 rounded-lg text-white bg-blue-500 hover:bg-blue-600 font-semibold">OK</button>
        </div>
    </div>
));

const ConfirmModal = React.memo(({ message, onConfirm, onClose }) => (
   <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm m-4 p-8 text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <p className="mb-6">{message}</p>
            <div className="flex justify-center space-x-4">
                <button onClick={onClose} className="px-6 py-2 rounded-lg text-gray-600 bg-gray-200 hover:bg-gray-300">Annuler</button>
                <button onClick={onConfirm} className="px-6 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 font-semibold">Confirmer</button>
            </div>
        </div>
    </div>
));

const StatCard = React.memo(({ icon, title, value, color, valueColor = 'text-gray-800' }) => (
    <div className={`bg-white p-6 rounded-2xl shadow-md flex items-center space-x-4 border-l-4 ${color}`}>
        <div className="text-3xl">{icon}</div>
        <div><p className="text-sm text-gray-500 font-medium">{title}</p><p className={`text-2xl font-bold ${valueColor}`}>{value}</p></div>
    </div>
));

// --- Main Component: App ---
export default function App() {
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [language, setLanguage] = useState('fr');
    const userRole = ROLES.ADMIN;
    const userPseudo = 'Admin';
    
    const [currentView, setCurrentView] = useState('dashboard');
    const [viewPayload, setViewPayload] = useState(null);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [sales, setSales] = useState([]);
    const [categories, setCategories] = useState([]);
    const [payments, setPayments] = useState([]);
    const [companyProfile, setCompanyProfile] = useState({
        name: "Ma boutique",
        address: "Dakar - Sénégal",
        phone: "+221",
        logo: null,
        invoicePrefix: "FAC-",
        refundPrefix: "REM-",
        depositPrefix: "DEP-",
        invoiceFooterMessage: "Merci pour votre achat !",
        lastInvoiceNumber: 0,
        language: 'fr',
    });

    const [cart, setCart] = useState([]);
    const [modalState, setModalState] = useState({ isOpen: false, type: null, item: null, size: 'md' });

    const [alertInfo, setAlertInfo] = useState({ show: false, message: '' });
    const [confirmInfo, setConfirmInfo] = useState({ show: false, message: '', onConfirm: null });

    const t = useCallback((key) => {
        return translations[language][key] || key;
    }, [language]);

    const productsToReorder = useMemo(() => {
        const toReorder = [];
        products.forEach(p => {
            if(p.type === PRODUCT_TYPES.VARIANT) {
                p.variants?.forEach(v => {
                    if(v.quantity <= (v.reorderThreshold || 0) && v.quantity > 0){
                        toReorder.push({ id: `${p.id}-${v.id}`, name: `${p.name} - ${v.name}`, quantity: v.quantity, reorderThreshold: v.reorderThreshold || 0 });
                    }
                })
            } else if (p.type === PRODUCT_TYPES.SIMPLE && p.quantity <= (p.reorderThreshold || 0) && p.quantity > 0) {
                 toReorder.push(p);
            }
        });
        return toReorder;
    }, [products]);

    const showAlert = useCallback((message) => setAlertInfo({ show: true, message }), []);
    const showConfirm = useCallback((message, onConfirm) => setConfirmInfo({ show: true, message, onConfirm }), []);

    const navigate = useCallback((view, payload = null) => {
        setCurrentView(view);
        setViewPayload(payload);
    }, []);

    const addToCart = useCallback((product, quantity, variant = null) => {
        setCart(currentCart => {
            const cartItemId = variant ? `${product.id}-${variant.id}` : product.id;
            const existingItem = currentCart.find(item => item.cartId === cartItemId);
            
            if (existingItem) {
                return currentCart.map(item => item.cartId === cartItemId ? { ...item, quantity: item.quantity + quantity } : item);
            }

            const newItem = {
                ...product,
                cartId: cartItemId,
                name: variant ? `${product.name} - ${variant.name}` : product.name,
                price: variant ? (product.basePrice || product.price) + (variant.priceModifier || 0) : product.price,
                quantity,
                variant: variant ? { id: variant.id, name: variant.name } : null
            };
            return [...currentCart, newItem];
        });
    }, []);
    
    // --- Authentication & PDF Script Loading ---
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
            if (authUser) { setUser(authUser); setIsAuthReady(true); } 
            else { try { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } else { await signInAnonymously(auth); } } 
            catch (error) { console.error("Anonymous auth error:", error); setIsAuthReady(true); } }
        });
        const loadScript = (src) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const script = document.createElement('script'); script.src = src;
            script.onload = () => resolve(); script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.body.appendChild(script);
        });
        Promise.all([
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"),
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js")
        ]).catch(error => console.error("Error loading PDF scripts:", error));
        return () => unsubscribeAuth();
    }, []);

    // --- Firestore Data Subscription ---
    useEffect(() => {
        if (!isAuthReady) return;
        const collectionsToSubscribe = [
            { name: 'products', setter: setProducts },
            { name: 'customers', setter: setCustomers },
            { name: 'categories', setter: setCategories },
            { name: 'payments', setter: setPayments },
            { name: 'sales', setter: setSales }
        ];
        const unsubscribers = collectionsToSubscribe.map(({ name, setter }) => {
            const path = `artifacts/${appId}/public/data/${name}`;
            const q = query(collection(db, path));
            return onSnapshot(q, (snapshot) => {
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setter(items);
            }, (err) => console.error(`Error reading ${name}:`, err));
        });

        const profileDocRef = doc(db, `artifacts/${appId}/public/data/companyProfile`, 'main');
        const unsubProfile = onSnapshot(profileDocRef, (docSnap) => {
            if (docSnap.exists()) { 
                const data = docSnap.data();
                setCompanyProfile(prev => ({...prev, ...data}));
                if (data.language) {
                    setLanguage(data.language);
                }
            } 
            else { setDoc(profileDocRef, companyProfile); }
        });
        unsubscribers.push(unsubProfile);
        return () => unsubscribers.forEach(unsub => unsub && unsub());
    }, [isAuthReady, appId]);

    const closeModal = useCallback(() => setModalState({ isOpen: false, type: null, item: null, size: 'md' }), []);
    
    // --- CRUD Functions ---
    const handleAddItem = useCallback(async (collectionName, data, onSuccess) => {
        if (!user) return; const path = `artifacts/${appId}/public/data/${collectionName}`;
        try { const docRef = await addDoc(collection(db, path), data); if (onSuccess) onSuccess({ id: docRef.id, ...data }); closeModal(); } 
        catch (error) { console.error("Add error:", error); showAlert("Add error: " + error.message); }
    }, [user, appId, closeModal, showAlert]);

    const handleEditItem = useCallback(async (collectionName, id, data) => {
        if (!user) return; const path = `artifacts/${appId}/public/data/${collectionName}`;
        try { await updateDoc(doc(db, path, id), data); closeModal(); } 
        catch (error) { console.error("Edit error:", error); showAlert("Edit error: " + error.message); }
    }, [user, appId, closeModal, showAlert]);

    const handleSaveProfile = useCallback(async (profileData) => {
        if (!user) return; const profileDocRef = doc(db, `artifacts/${appId}/public/data/companyProfile`, 'main');
        try { 
            await setDoc(profileDocRef, profileData, { merge: true }); 
            if (profileData.language) {
                setLanguage(profileData.language);
            }
            showAlert("Company profile updated!"); 
        } 
        catch (error) { console.error("Profile update error:", error); showAlert("Error: " + error.message); }
    }, [user, appId, showAlert]);

    const handleDeleteItem = useCallback((collectionName, id) => {
        showConfirm("Are you sure you want to delete this item?", async () => {
            if (!user) return;
            try { const path = `artifacts/${appId}/public/data/${collectionName}`; await deleteDoc(doc(db, path, id)); } 
            catch (error) { console.error("Delete error:", error); showAlert("Error: " + error.message); }
        });
    }, [user, appId, showConfirm, showAlert]);
    
    const openModal = useCallback((type, item = null, size = 'md') => {
        setModalState({ isOpen: true, type, item, size });
    }, []);

    const handleAddSale = useCallback(async (saleData) => {
        if (!user) return;
        const { customerId, paymentType, items, totalPrice, discountAmount, vatAmount } = saleData;
        const customer = customers.find(c => c.id === customerId);
        if (!customer) {
            showAlert("Customer not found!");
            return;
        }
    
        try {
            const newSaleRef = doc(collection(db, `artifacts/${appId}/public/data/sales`));
            const profileRef = doc(db, `artifacts/${appId}/public/data/companyProfile`, 'main');
    
            const newSaleData = await runTransaction(db, async (transaction) => {
                // --- PHASE 1: READ ALL DOCUMENTS ---
                const profileDoc = await transaction.get(profileRef);
                if (!profileDoc.exists()) {
                    throw "Company profile not found.";
                }
    
                const productsToRead = new Map();
                items.forEach(item => {
                    productsToRead.set(item.id, doc(db, `artifacts/${appId}/public/data/products`, item.id));
                });
    
                const mainProductDocs = await Promise.all(Array.from(productsToRead.values()).map(ref => transaction.get(ref)));
    
                const productsDataMap = new Map();
                mainProductDocs.forEach(doc => {
                    if (doc.exists()) {
                        productsDataMap.set(doc.id, doc.data());
                    }
                });
    
                const packItemRefsToRead = new Map();
                productsDataMap.forEach((productData) => {
                    if (productData.type === PRODUCT_TYPES.PACK) {
                        productData.packItems.forEach(packItem => {
                            if (!productsDataMap.has(packItem.productId)) {
                                packItemRefsToRead.set(packItem.productId, doc(db, `artifacts/${appId}/public/data/products`, packItem.productId));
                            }
                        });
                    }
                });
    
                if (packItemRefsToRead.size > 0) {
                    const packItemDocs = await Promise.all(Array.from(packItemRefsToRead.values()).map(ref => transaction.get(ref)));
                    packItemDocs.forEach(doc => {
                        if (doc.exists()) {
                            productsDataMap.set(doc.id, doc.data());
                        }
                    });
                }
    
                // --- PHASE 2: VALIDATE STOCK ---
                for (const item of items) {
                    const productData = productsDataMap.get(item.id);
                    if (!productData) throw `Product ${item.name} not found!`;
    
                    if (item.variant) {
                        const variantIndex = productData.variants.findIndex(v => v.id === item.variant.id);
                        if (variantIndex === -1 || productData.variants[variantIndex].quantity < item.quantity) {
                            throw `Insufficient stock for variant ${item.name}`;
                        }
                    } else if (productData.type === PRODUCT_TYPES.PACK) {
                        for (const packItem of productData.packItems) {
                            const childProductData = productsDataMap.get(packItem.productId);
                            if (!childProductData) throw `Child product ${packItem.name} not found.`;
    
                            if (packItem.variant && packItem.variant.id) {
                                const variantIndex = childProductData.variants.findIndex(v => v.id === packItem.variant.id);
                                if (variantIndex === -1 || childProductData.variants[variantIndex].quantity < packItem.quantity * item.quantity) {
                                    throw `Insufficient stock for ${packItem.name} in the pack.`;
                                }
                            } else {
                                if (childProductData.quantity < packItem.quantity * item.quantity) {
                                    throw `Insufficient stock for ${childProductData.name} in the pack.`;
                                }
                            }
                        }
                    } else {
                        if (productData.quantity < item.quantity) {
                            throw `Insufficient stock for ${item.name}!`;
                        }
                    }
                }
    
                // --- PHASE 3: EXECUTE WRITES ---
                for (const item of items) {
                    const productData = productsDataMap.get(item.id);
                    const productRef = doc(db, `artifacts/${appId}/public/data/products`, item.id);
    
                    if (item.variant) {
                        const newVariants = [...productData.variants];
                        const variantIndex = newVariants.findIndex(v => v.id === item.variant.id);
                        newVariants[variantIndex].quantity -= item.quantity;
                        transaction.update(productRef, { variants: newVariants });
                    } else if (productData.type === PRODUCT_TYPES.PACK) {
                        for (const packItem of productData.packItems) {
                            const childProductData = productsDataMap.get(packItem.productId);
                            const childProductRef = doc(db, `artifacts/${appId}/public/data/products`, packItem.productId);
                            if (packItem.variant && packItem.variant.id) {
                                const newVariants = [...childProductData.variants];
                                const variantIndex = newVariants.findIndex(v => v.id === packItem.variant.id);
                                newVariants[variantIndex].quantity -= packItem.quantity * item.quantity;
                                transaction.update(childProductRef, { variants: newVariants });
                            } else {
                                const newQuantity = childProductData.quantity - (packItem.quantity * item.quantity);
                                transaction.update(childProductRef, { quantity: newQuantity });
                            }
                        }
                    } else {
                        const newQuantity = productData.quantity - item.quantity;
                        transaction.update(productRef, { quantity: newQuantity });
                    }
                }
    
                if (paymentType === 'Acompte Client') {
                    const customerBalance = customer.balance || 0;
                    if (customerBalance < totalPrice) { throw "Insufficient customer deposit."; }
                    const customerRef = doc(db, `artifacts/${appId}/public/data/customers`, customerId);
                    transaction.update(customerRef, { balance: customerBalance - totalPrice });
                }
    
                const lastInvoiceNumber = profileDoc.data().lastInvoiceNumber || 0;
                const newInvoiceNumber = lastInvoiceNumber + 1;
                const invoiceId = `${companyProfile.invoicePrefix || 'FAC-'}${newInvoiceNumber.toString().padStart(5, '0')}`;
                const status = paymentType === 'Créance' ? SALE_STATUS.CREDIT : SALE_STATUS.COMPLETED;
    
                const finalSaleData = {
                    invoiceId, customerId, customerName: customer.name, paymentType,
                    items: items.map(i => ({ productId: i.id, productName: i.name, quantity: i.quantity, unitPrice: i.price, subtotal: i.price * i.quantity, variant: i.variant })),
                    totalPrice, discountAmount, vatAmount, status,
                    paidAmount: status === SALE_STATUS.COMPLETED ? totalPrice : 0,
                    saleDate: new Date().toISOString(), userId: user.uid, userPseudo
                };
    
                transaction.set(newSaleRef, finalSaleData);
                transaction.update(profileRef, { lastInvoiceNumber: newInvoiceNumber });
    
                return finalSaleData;
            });
    
            setCart([]);
            openModal('showInvoice', { ...newSaleData, id: newSaleRef.id, customer }, 'lg');
    
        } catch (error) {
            console.error("Sale transaction error:", error);
            showAlert("Error: " + error.toString());
        }
    }, [user, customers, products, appId, companyProfile.invoicePrefix, showAlert, openModal]);

    const handleShowInvoice = useCallback((sale) => {
        const customer = customers.find(c => c.id === sale.customerId);
        if (!customer) { showAlert("Could not find the customer for this sale."); return; }
        openModal('showInvoice', { ...sale, customer }, 'lg');
    }, [customers, openModal, showAlert]);
    
    const handleMakePayment = useCallback(async (saleToPay, amountPaidStr, paymentType) => {
        const amountPaid = Number(amountPaidStr);
        if (!amountPaid || amountPaid <= 0) { showAlert("Invalid amount."); return; }
    
        const currentPaidAmount = saleToPay.paidAmount || 0;
        const remainingBalance = saleToPay.totalPrice - currentPaidAmount;
    
        if (amountPaid > remainingBalance) {
            showAlert("The amount paid cannot exceed the remaining balance.");
            return;
        }
    
        let newPaidAmount = currentPaidAmount + amountPaid;
        const isFullyPaid = newPaidAmount >= saleToPay.totalPrice;
    
        if (isFullyPaid) {
            newPaidAmount = saleToPay.totalPrice;
        }
    
        const newStatus = isFullyPaid ? SALE_STATUS.COMPLETED : SALE_STATUS.CREDIT;
    
        try {
            const batch = writeBatch(db);
            const saleRef = doc(db, `artifacts/${appId}/public/data/sales`, saleToPay.id);
    
            if (paymentType === 'Acompte Client') {
                const customer = customers.find(c => c.id === saleToPay.customerId);
                if (!customer || (customer.balance || 0) < amountPaid) {
                    showAlert("Insufficient customer deposit.");
                    return;
                }
                const customerRef = doc(db, `artifacts/${appId}/public/data/customers`, saleToPay.customerId);
                batch.update(customerRef, { balance: customer.balance - amountPaid });
            }
    
            const paymentData = {
                saleId: saleToPay.id,
                invoiceId: saleToPay.invoiceId,
                customerName: saleToPay.customerName,
                amount: amountPaid,
                paymentType,
                paymentDate: new Date().toISOString()
            };
            batch.set(doc(collection(db, `artifacts/${appId}/public/data/payments`)), paymentData);
    
            batch.update(saleRef, { paidAmount: newPaidAmount, status: newStatus });
    
            await batch.commit();
    
            openModal('showPaymentReceipt', {
                ...paymentData,
                customer: customers.find(c => c.id === saleToPay.customerId),
                remainingBalance: saleToPay.totalPrice - newPaidAmount,
                companyProfile
            }, 'lg');
        } catch (error) {
            console.error("Error during payment:", error);
            showAlert("Error during payment: " + error.message);
        }
    }, [appId, customers, companyProfile, openModal, showAlert]);
    
    
    const handleAddDeposit = useCallback(async (customerId, amount) => {
        const customer = customers.find(c => c.id === customerId);
        if(!customer || !amount || amount <= 0) { showAlert("Invalid information."); return; }
        const newBalance = (customer.balance || 0) + Number(amount);
        try {
            const customerRef = doc(db, `artifacts/${appId}/public/data/customers`, customerId);
            await updateDoc(customerRef, { balance: newBalance });
            showAlert("Deposit saved!");
            closeModal();
            openModal('showDepositReceipt', { customer: {...customer, balance: newBalance}, amount: Number(amount), companyProfile, depositDate: new Date().toISOString(), customerId }, 'lg');
        } catch (error) { console.error("Error during deposit:", error); showAlert("Error: " + error.message); }
    }, [appId, customers, closeModal, showAlert, openModal, companyProfile]);
    
    const openSaleModal = useCallback((customer = null) => {
        openModal('productSelection', customer ? { preselectedCustomerId: customer.id } : null, '7xl');
    }, [openModal]);

    const navItems = [
        { view: 'dashboard', label: t('dashboard'), icon: <BarChart2 />, activeViews: ['dashboard'] },
        { view: 'products', label: t('products'), icon: <Package />, activeViews: ['products'] },
        { view: 'categories', label: t('categories'), icon: <Tag />, activeViews: ['categories'] },
        { view: 'customers', label: t('customers'), icon: <Users />, activeViews: ['customers', 'customer-details'] },
        { view: 'sales', label: t('sales'), icon: <ShoppingCart />, activeViews: ['sales'] },
        { view: 'debts', label: t('debts'), icon: <CreditCard />, activeViews: ['debts'] },
        { view: 'refunds', label: t('refunds'), icon: <ListChecks />, activeViews: ['refunds'] },
        { view: 'settings', label: t('settings'), icon: <Settings />, activeViews: ['settings'] }
    ];

    // --- View Rendering ---
    const renderModalContent = () => {
        if (!modalState.isOpen) return null;
        const { type, item } = modalState;
        switch (type) {
            case 'productSelection': return <ProductSelectionModal products={products} onAddToCart={addToCart} openModal={openModal} onClose={closeModal} onProceedToCart={() => openModal('addSale', item, '7xl')} cart={cart}/>
            case 'productDetails': return <ProductDetailModal product={item} onAddToCart={addToCart} onClose={closeModal} openModal={openModal} />;
            case 'addProduct': case 'editProduct': return <ProductForm onSubmit={type === 'addProduct' ? (d, cb) => handleAddItem('products', d, cb) : (d) => handleEditItem('products', item.id, d)} initialData={item} categories={categories} products={products} onClose={closeModal} />;
            case 'addCategory': case 'editCategory': return <CategoryForm onSubmit={type === 'addCategory' ? (d) => handleAddItem('categories', d) : (d) => handleEditItem('categories', item.id, d)} initialData={item} categories={categories} onClose={closeModal} />;
            case 'addCustomer': return <CustomerForm onSubmit={(d, cb) => handleAddItem('customers', d, cb)} initialData={item} onClose={closeModal} onSuccess={item?.onSuccess} />;
            case 'editCustomer': return <CustomerForm onSubmit={(d) => handleEditItem('customers', item.id, d)} initialData={item} onClose={closeModal}/>
            case 'addSale': return <SaleForm onSubmit={handleAddSale} customers={customers} onClose={closeModal} cart={cart} setCart={setCart} preselectedCustomerId={item?.preselectedCustomerId} openModal={openModal} showAlert={showAlert} />;
            case 'makePayment': return <PaymentForm onSubmit={(amount, pType) => handleMakePayment(item, amount, pType)} sale={item} customers={customers} onClose={closeModal} />;
            case 'addDeposit': return <DepositForm customer={item} onSubmit={(amount) => handleAddDeposit(item.id, amount)} onClose={closeModal} />;
            case 'showInvoice': return <Invoice sale={item} products={products} companyProfile={companyProfile} onClose={closeModal} showAlert={showAlert} />;
            case 'showPaymentReceipt': return <PaymentReceipt receiptData={item} onClose={closeModal} showAlert={showAlert} />;
            case 'showDepositReceipt': return <DepositReceipt receiptData={item} onClose={closeModal} showAlert={showAlert} />;
            default: return null;
        }
    };
    
    if (!isAuthReady) { return <div className="flex justify-center items-center h-screen bg-gray-100">{t('loading')}</div>; }

    return (
        <>
            <style>{`.invoice-container, .receipt-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; } @media print { body * { visibility: hidden; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; padding: 20px; font-size: 12px; } .no-print { display: none; } }`}</style>
            <div className="flex h-screen bg-gray-100 font-sans">
                <nav className="w-64 bg-white shadow-lg flex flex-col no-print">
                    <div className="p-4 text-2xl font-bold text-gray-800 border-b h-20 flex items-center justify-center bg-transparent">
                        {companyProfile.logo ? <img src={companyProfile.logo} alt={companyProfile.name} className="max-h-full max-w-full object-contain" /> : companyProfile.name}
                    </div>
                    <ul className="flex-1 p-4 space-y-2">
                        {navItems.map(item => (
                            <NavItem 
                                key={item.view}
                                icon={item.icon} 
                                label={item.label} 
                                active={item.activeViews.includes(currentView)}
                                onClick={() => navigate(item.view)} 
                            />
                        ))}
                    </ul>
                    <div className="p-4 border-t text-xs text-gray-500">
                        <p>User: {userPseudo}</p>
                        <p className="font-bold capitalize">Role: {userRole}</p>
                         {cart.length > 0 && (
                          <button onClick={() => openModal('addSale', null, '7xl')} className="w-full mt-2 text-left flex items-center bg-yellow-100 text-yellow-800 p-2 rounded-lg">
                            <ShoppingCart size={16} className="mr-2"/> Cart ({cart.length})
                          </button>
                        )}
                    </div>
                </nav>
                <main className="flex-1 p-8 overflow-y-auto">
                    {currentView === 'dashboard' && <DashboardView sales={sales} products={products} customers={customers} categories={categories} productsToReorder={productsToReorder} openSaleModal={openSaleModal} navigate={navigate} handleShowInvoice={handleShowInvoice} openModal={openModal} t={t} language={language} />}
                    {currentView === 'products' && <ProductsView products={products} categories={categories} openModal={openModal} handleDelete={handleDeleteItem} setCart={setCart} openSaleModal={openSaleModal} productsToReorder={productsToReorder} t={t} language={language} />}
                    {currentView === 'categories' && <CategoriesView categories={categories} openModal={openModal} handleDelete={handleDeleteItem} t={t} language={language} />}
                    {currentView === 'customers' && <CustomersView customers={customers} openModal={openModal} handleDelete={handleDeleteItem} navigate={navigate} t={t} language={language} />}
                    {currentView === 'customer-details' && <CustomerDetailsView customerId={viewPayload?.id} customers={customers} db={db} appId={appId} navigate={navigate} openSaleModal={openSaleModal} t={t} language={language} />}
                    {currentView === 'sales' && <SalesView sales={sales} handleShowInvoice={handleShowInvoice} t={t} language={language} />}
                    {currentView === 'debts' && <DebtsView sales={sales} openModal={openModal} t={t} language={language} />}
                    {currentView === 'refunds' && <RefundsView payments={payments} t={t} language={language} />}
                    {currentView === 'settings' && <SettingsView companyProfile={companyProfile} handleSaveProfile={handleSaveProfile} t={t} />}
                </main>
                {modalState.isOpen && (<Modal onClose={closeModal} size={modalState.size}>{renderModalContent()}</Modal>)}
                {alertInfo.show && <AlertModal message={alertInfo.message} onClose={() => setAlertInfo({ show: false, message: '' })} />}
                {confirmInfo.show && <ConfirmModal message={confirmInfo.message} onConfirm={() => { confirmInfo.onConfirm(); setConfirmInfo({ ...confirmInfo, show: false }); }} onClose={() => setConfirmInfo({ ...confirmInfo, show: false })} />}
            </div>
        </>
    );
}

// --- View and Form Components ---
const NavItem = React.memo(({ icon, label, active, onClick }) => (
    <li><a href="#" onClick={onClick} className={`flex items-center p-3 rounded-lg transition-colors ${active ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>{icon}<span className="ml-4 font-medium">{label}</span></a></li>
));

// --- VIEWS ---
const DashboardView = React.memo(({ sales, products, customers, categories, productsToReorder, openSaleModal, navigate, handleShowInvoice, openModal, t, language }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState(null);

    const handleSearch = useCallback((e) => {
        const term = e.target.value.toLowerCase();
        setSearchTerm(term);

        if (term.length < 2) {
            setSearchResults(null);
            return;
        }

        const foundProducts = products.filter(p => p.name.toLowerCase().includes(term));
        const foundCustomers = customers.filter(c => c.name.toLowerCase().includes(term));
        const foundSales = sales.filter(s => (s.invoiceId && s.invoiceId.toLowerCase().includes(term)) || s.customerName.toLowerCase().includes(term));

        setSearchResults({ products: foundProducts, customers: foundCustomers, sales: foundSales });
    }, [products, customers, sales]);


    const totalCredit = useMemo(() => sales.filter(s => s.status === SALE_STATUS.CREDIT).reduce((acc, s) => acc + (s.totalPrice - (s.paidAmount || 0)), 0), [sales]);
    const totalSalesToday = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return sales.filter(s => s.saleDate && s.saleDate.startsWith(today)).reduce((acc, sale) => acc + sale.totalPrice, 0);
    }, [sales]);
    const displayedSales = useMemo(() => sales.sort((a,b) => new Date(b.saleDate) - new Date(a.saleDate)).slice(0, 5), [sales]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">{t('dashboard')}</h2>
                <button onClick={() => openSaleModal()} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600 transition-colors">
                    <ShoppingCart size={20} className="mr-2" /> {t('newSale')}
                </button>
            </div>
            
            <div className="mb-8 relative">
                <input 
                    type="text" 
                    placeholder={t('searchPlaceholder')} 
                    value={searchTerm} 
                    onChange={handleSearch} 
                    className="w-full pl-12 pr-4 py-3 border rounded-full text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24}/>
            </div>
            
            {searchResults && (
                <div className="bg-white p-6 rounded-2xl shadow-md mb-8">
                    <h3 className="text-xl font-bold text-gray-700 mb-4">{t('searchResults')}</h3>
                    {searchResults.products.length === 0 && searchResults.customers.length === 0 && searchResults.sales.length === 0 && <p>No results found.</p>}
                    
                    {searchResults.products.length > 0 && <div className="mb-4">
                        <h4 className="font-semibold mb-2 text-blue-600">{t('products')}</h4>
                        <ul className="space-y-1">{searchResults.products.map(p => <li key={p.id} onClick={() => openModal('productDetails', p, 'md')} className="cursor-pointer hover:bg-gray-100 p-2 rounded-md">{p.name}</li>)}</ul>
                    </div>}
                    
                    {searchResults.customers.length > 0 && <div className="mb-4">
                        <h4 className="font-semibold mb-2 text-green-600">{t('customers')}</h4>
                        <ul className="space-y-1">{searchResults.customers.map(c => <li key={c.id} onClick={() => navigate('customer-details', { id: c.id })} className="cursor-pointer hover:bg-gray-100 p-2 rounded-md">{c.name}</li>)}</ul>
                    </div>}

                    {searchResults.sales.length > 0 && <div>
                        <h4 className="font-semibold mb-2 text-purple-600">{t('invoices')}</h4>
                        <ul className="space-y-1">{searchResults.sales.map(s => <li key={s.id} onClick={() => handleShowInvoice(s)} className="cursor-pointer hover:bg-gray-100 p-2 rounded-md">{s.invoiceId} for {s.customerName} - {formatCurrency(s.totalPrice, language)}</li>)}</ul>
                    </div>}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard icon={<Package />} title={t('products')} value={products.length} color="border-blue-500" />
                <StatCard icon={<DollarSign />} title={t('salesToday')} value={formatCurrency(totalSalesToday, language)} color="border-yellow-500" />
                <StatCard icon={<CreditCard />} title={t('debts')} value={formatCurrency(totalCredit, language)} color="border-red-500" valueColor="text-red-500"/>
                <StatCard icon={<Users />} title={t('customers')} value={customers.length} color="border-green-500" />
                <StatCard icon={<Tag />} title={t('categories')} value={categories.length} color="border-indigo-500" />
                <StatCard icon={<ShoppingCart />} title={t('totalSales')} value={sales.length} color="border-purple-500" />
            </div>
            {productsToReorder.length > 0 && (
                <div className="mt-8 bg-white p-6 rounded-2xl shadow-md">
                    <h3 className="text-xl font-bold text-orange-600 mb-4 flex items-center"><AlertCircle className="mr-2"/>{t('lowStock')}</h3>
                    <table className="w-full text-left">
                        <thead><tr className="border-b"><th className="p-3">{t('products')}</th><th className="p-3">{t('currentStock')}</th><th className="p-3">{t('threshold')}</th></tr></thead>
                        <tbody>{productsToReorder.map(p => (<tr key={p.id} className="border-b hover:bg-gray-50"><td className="p-3">{p.name}</td><td className="p-3 font-bold text-red-500">{p.quantity}</td><td className="p-3 text-sm text-gray-500">{p.reorderThreshold || 0}</td></tr>))}</tbody>
                    </table>
                </div>
            )}
            <div className="mt-8 bg-white p-6 rounded-2xl shadow-md">
                <h3 className="text-xl font-bold text-gray-700 mb-4">{t('recentSales')}</h3>
                <table className="w-full text-left">
                    <thead><tr className="border-b"><th className="p-3">{t('invoiceNo')}</th><th className="p-3">{t('products')}</th><th className="p-3">{t('customers')}</th><th className="p-3">{t('total')}</th><th className="p-3">{t('date')}</th></tr></thead>
                    <tbody>
                        {displayedSales.map(sale => (
                            <tr key={sale.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-semibold">{sale.invoiceId}</td>
                                <td className="p-3 text-sm">{sale.items.map(i => i.productName).join(', ')}</td>
                                <td className="p-3">{sale.customerName}</td>
                                <td className="p-3 font-medium text-green-600">{formatCurrency(sale.totalPrice, language)}</td>
                                <td className="p-3 text-sm text-gray-500">{formatDate(sale.saleDate, language)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

const StockManagementView = React.memo(({ productsToReorder, openModal }) => {
    return (
        <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Products to Restock</h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b-2">
                            <th className="p-4">Product / Variant</th>
                            <th className="p-4">Current Stock</th>
                            <th className="p-4">Reorder Threshold</th>
                            <th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productsToReorder.length > 0 ? productsToReorder.map(item => (
                            <tr key={item.id} className="border-b hover:bg-gray-50">
                                <td className="p-4">{item.name}</td>
                                <td className="p-4 font-bold text-red-500">{item.quantity}</td>
                                <td className="p-4">{item.reorderThreshold}</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => openModal('addToStock', item, 'md')} className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200">
                                        <Plus size={16} />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                           <tr><td colSpan="4" className="text-center p-8 text-gray-500">No products with low stock.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
});

const ProductsView = React.memo(({ products, categories, openModal, handleDelete, setCart, openSaleModal, productsToReorder, t, language }) => {
    const [viewMode, setViewMode] = useState('list');
    const [selectedProducts, setSelectedProducts] = useState(new Set());
    const [activeTab, setActiveTab] = useState('list');

    const toggleProductSelection = useCallback((product) => {
        setSelectedProducts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(product.id)) {
                newSet.delete(product.id);
            } else {
                newSet.add(product.id);
            }
            return newSet;
        });
    }, []);

    const handleStartSale = useCallback(() => {
        const cartItems = products.filter(p => selectedProducts.has(p.id)).map(p => ({
            ...p,
            cartId: p.id,
            quantity: 1
        }));
        setCart(cartItems);
        setSelectedProducts(new Set());
        openSaleModal();
    }, [products, selectedProducts, setCart, openSaleModal]);
    
    const categoryMap = useMemo(() => categories.reduce((acc, cat) => ({...acc, [cat.id]: cat }), {}), [categories]);

    return (
        <div className="bg-white p-8 rounded-2xl shadow-md">
            <div className="flex justify-between items-center mb-2 flex-wrap gap-4">
                <h2 className="text-3xl font-bold text-gray-800">{t('products')}</h2>
                 {activeTab === 'list' && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}><List/></button>
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}><LayoutGrid/></button>
                        </div>
                        {selectedProducts.size > 0 && (
                            <button onClick={handleStartSale} className="flex items-center bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-green-600 transition-colors">
                                <ShoppingCart size={20} className="mr-2" /> {t('startSale')} ({selectedProducts.size})
                            </button>
                        )}
                        <button onClick={() => openModal('addProduct')} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600 transition-colors"><Plus size={20} className="mr-2" /> {t('addProduct')}</button>
                    </div>
                 )}
            </div>

            <div className="flex border-b mb-6">
                <button onClick={() => setActiveTab('list')} className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${activeTab === 'list' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}><List size={16}/> {t('productList')}</button>
                <button onClick={() => setActiveTab('stock')} className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${activeTab === 'stock' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}><Archive size={16}/> {t('stockManagement')}</button>
            </div>

            <div className="overflow-x-auto">
                {activeTab === 'list' ? (
                    viewMode === 'list' ? (
                         <table className="w-full text-left">
                            <thead className="whitespace-nowrap"><tr className="border-b-2 border-gray-200">
                                <th className="p-4 w-12"><PlusCircle size={20} className="text-gray-400"/></th>
                                <th className="p-4">{t('photo')}</th><th className="p-4">{t('name')}</th><th className="p-4">{t('category')}</th>
                                <th className="p-4">{t('stock')}</th><th className="p-4">{t('price')}</th><th className="p-4 text-right">{t('actions')}</th>
                            </tr></thead>
                            <tbody>{products.map(item => (
                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                    <td className="p-4"><input type="checkbox" disabled={item.type === PRODUCT_TYPES.VARIANT} checked={selectedProducts.has(item.id)} onChange={() => toggleProductSelection(item)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:bg-gray-200"/></td>
                                    <td className="p-4"><img src={item.photoURL || 'https://placehold.co/60x60/e2e8f0/4a5568?text=N/A'} alt={item.name} className="w-12 h-12 rounded-lg object-cover" /></td>
                                    <td className="p-4 font-semibold">{item.name}</td>
                                    <td className="p-4 text-sm">{categoryMap[item.categoryId]?.name || 'N/A'}</td>
                                    <td className="p-4"><span className={item.type !== PRODUCT_TYPES.VARIANT && item.quantity <= (item.reorderThreshold || 0) ? 'font-bold text-red-500' : ''}>{item.type === PRODUCT_TYPES.VARIANT ? 'Variants' : item.quantity}</span></td>
                                    <td className="p-4">{formatCurrency(item.price || item.basePrice, language)}</td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                        <button onClick={() => openModal('editProduct', item)} className="text-blue-500 hover:text-blue-700 mr-4"><Edit size={20} /></button>
                                        <button onClick={() => handleDelete('products', item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={20} /></button>
                                    </td>
                                </tr>
                            ))}</tbody>
                        </table>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {products.map(product => (
                                <div key={product.id} className={`bg-white rounded-2xl shadow-md p-4 flex flex-col items-center text-center relative ${product.type === PRODUCT_TYPES.PACK || product.type === PRODUCT_TYPES.SIMPLE ? 'cursor-pointer' : 'opacity-70'}`} onClick={() => (product.type === PRODUCT_TYPES.PACK || product.type === PRODUCT_TYPES.SIMPLE) && toggleProductSelection(product)}>
                                    <img src={product.photoURL || 'https://placehold.co/150x150/e2e8f0/4a5568?text=N/A'} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-4"/>
                                    <h4 className="font-semibold text-gray-800 flex-grow">{product.name}</h4>
                                    <p className="text-blue-600 font-bold">{formatCurrency(product.price || product.basePrice, language)}</p>
                                    {(product.type === PRODUCT_TYPES.PACK || product.type === PRODUCT_TYPES.SIMPLE) && <input type="checkbox" checked={selectedProducts.has(product.id)} readOnly className="absolute top-2 right-2 h-6 w-6 rounded-md border-gray-400 text-blue-600 focus:ring-blue-500"/>}
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                   <StockManagementView productsToReorder={productsToReorder} openModal={openModal} />
                )}
            </div>
        </div>
    );
});

const CategoriesView = React.memo(({ categories, openModal, handleDelete, t }) => {
    const categoryMap = useMemo(() => categories.reduce((acc, cat) => ({...acc, [cat.id]: cat.name}), {}), [categories]);
    return (
        <div className="bg-white p-8 rounded-2xl shadow-md">
            <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-bold text-gray-800">{t('categories')}</h2>
                <button onClick={() => openModal('addCategory')} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600"><Plus size={20} className="mr-2" /> {t('addCategory')}</button>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left">
                <thead><tr className="border-b-2">
                    <th className="p-4">{t('name')}</th><th className="p-4">{t('parentCategory')}</th><th className="p-4 text-right">{t('actions')}</th>
                </tr></thead>
                <tbody>{categories.map(item => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-4">{item.name}</td>
                        <td className="p-4">{item.parentId ? categoryMap[item.parentId] : "N/A (Main)"}</td>
                        <td className="p-4 text-right">
                            <button onClick={() => openModal('editCategory', item)} className="text-blue-500 hover:text-blue-700 mr-4"><Edit size={20} /></button>
                            <button onClick={() => handleDelete('categories', item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={20} /></button>
                        </td>
                    </tr>
                ))}</tbody>
            </table></div>
        </div>
    );
});

const CustomersView = React.memo(({ customers, openModal, handleDelete, navigate, t, language }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const filteredCustomers = useMemo(() => customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())), [customers, searchTerm]);
    return (
        <div className="bg-white p-8 rounded-2xl shadow-md">
            <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-bold text-gray-800">{t('customers')}</h2>
                <button onClick={() => openModal('addCustomer')} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600"><Plus size={20} className="mr-2" /> {t('addCustomer')}</button>
            </div>
            <div className="mb-4"><input type="text" placeholder={t('searchCustomer')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border rounded-lg" /></div>
            <div className="overflow-x-auto"><table className="w-full text-left">
                <thead><tr className="border-b-2"><th className="p-4">{t('name')}</th><th className="p-4">{t('nickname')}</th><th className="p-4">{t('phone')}</th><th className="p-4">{t('customerDeposit')}</th><th className="p-4 text-right">{t('actions')}</th></tr></thead>
                <tbody>{filteredCustomers.map(item => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-4"><a href="#" onClick={(e) => { e.preventDefault(); navigate('customer-details', { id: item.id }); }} className="text-blue-600 hover:underline">{item.name}</a></td>
                        <td className="p-4">{item.nickname}</td>
                        <td className="p-4">{item.phone}</td>
                        <td className="p-4">{formatCurrency(item.balance || 0, language)}</td>
                        <td className="p-4 text-right">
                            <button onClick={() => openModal('addDeposit', item)} title="Add deposit" className="text-green-500 hover:text-green-700 mr-4"><DollarSign size={20} /></button>
                            <button onClick={() => openModal('editCustomer', item)} className="text-blue-500 hover:text-blue-700 mr-4"><Edit size={20} /></button>
                            <button onClick={() => handleDelete('customers', item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={20} /></button>
                        </td>
                    </tr>
                ))}</tbody>
            </table></div>
        </div>
    );
});

const CustomerDetailsView = React.memo(({ customerId, customers, db, appId, navigate, openSaleModal, t, language }) => {
    const [customerSales, setCustomerSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const customer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);

    useEffect(() => {
        if (!customerId) return;
        setLoading(true);
        const salesRef = collection(db, `artifacts/${appId}/public/data/sales`);
        const q = query(salesRef, where("customerId", "==", customerId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            salesData.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));
            setCustomerSales(salesData);
            setLoading(false);
        }, (err) => {
            console.error("Error reading history:", err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [customerId, db, appId]);
    
    if (!customer) return <div>Customer not found. <button className="text-blue-500 underline" onClick={() => navigate('customers')}>{t('backToList')}</button></div>;
    
    return (
        <div className="bg-white p-8 rounded-2xl shadow-md">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <button onClick={() => navigate('customers')} className="flex items-center text-blue-600 hover:underline mb-4"><ArrowLeft size={18} className="mr-2" /> {t('backToList')}</button>
                    <h2 className="text-3xl font-bold text-gray-800">{customer.name} {customer.nickname && `(${customer.nickname})`}</h2>
                    <p className="text-gray-500">{customer.phone}</p>
                    <p className="text-gray-500">{customer.address}</p>
                </div>
                <button onClick={() => openSaleModal(customer)} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600 transition-colors">
                    <ShoppingCart size={20} className="mr-2"/> {t('newSale')}
                </button>
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
                <p className="text-lg font-bold text-green-700">Available deposit: {formatCurrency(customer.balance || 0, language)}</p>
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-4">{t('purchaseHistory')}</h3>
            <div className="overflow-x-auto">{loading ? <p>{t('loading')}...</p> : <table className="w-full text-left">
                <thead><tr className="border-b"><th className="p-3">{t('invoiceNo')}</th><th className="p-3">{t('date')}</th><th className="p-3">{t('products')}</th><th className="p-3 text-right">{t('total')}</th><th className="p-3 text-center">Status</th></tr></thead>
                <tbody>{customerSales.length > 0 ? customerSales.map(sale => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-semibold">{sale.invoiceId}</td>
                        <td className="p-3">{formatDateTime(sale.saleDate, language)}</td>
                        <td className="p-3 text-sm">{sale.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}</td>
                        <td className="p-3 text-right">{formatCurrency(sale.totalPrice, language)}</td>
                        <td className="p-3 text-center"><StatusBadge status={sale.status} /></td>
                    </tr>
                )) : <tr><td colSpan="5" className="text-center p-8 text-gray-500">{t('noPurchases')}</td></tr>}</tbody>
            </table>}</div>
        </div>
    );
});

const SalesView = React.memo(({ sales, handleShowInvoice, t, language }) => {
    const [activeFilter, setActiveFilter] = useState('day');
    const [customStartDate, setCustomStartDate] = useState(toInputDate(new Date()));
    const [customEndDate, setCustomEndDate] = useState(toInputDate(new Date()));
    const [showFilters, setShowFilters] = useState(false);

    const filteredSales = useMemo(() => {
        if (!sales) return []; let start, end; const now = new Date();
        switch (activeFilter) {
            case 'day': start = new Date(new Date().setHours(0,0,0,0)); end = new Date(new Date().setHours(23,59,59,999)); break;
            case 'week': const first = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1); start = new Date(new Date().setDate(first)); start.setHours(0,0,0,0); end = new Date(new Date(start).setDate(start.getDate() + 6)); end.setHours(23,59,59,999); break;
            case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); break;
            case 'year': start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); break;
            case 'custom': if(customStartDate && customEndDate) { start = new Date(customStartDate); start.setHours(0,0,0,0); end = new Date(customEndDate); end.setHours(23,59,59,999); } break;
            default: return [...sales].sort((a,b) => new Date(b.saleDate) - new Date(a.saleDate));
        }
        if(!start || !end) return [...sales].sort((a,b) => new Date(b.saleDate) - new Date(a.saleDate));
        return sales.filter(s => { const d = new Date(s.saleDate); return d >= start && d <= end; }).sort((a,b) => new Date(b.saleDate) - new Date(a.saleDate));
    }, [sales, activeFilter, customStartDate, customEndDate]);

    const subtotal = useMemo(() => filteredSales.reduce((acc, sale) => acc + sale.totalPrice, 0), [filteredSales]);

    return (
        <div className="bg-white p-8 rounded-2xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">{t('sales')}</h2>
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800"><Filter size={16} className="mr-1" /> {showFilters ? t('hide') : t('filter')}</button>
            </div>
            {showFilters && (<div className="bg-gray-50 p-6 rounded-2xl shadow-inner mb-6 border">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setActiveFilter('day')} className={`px-4 py-2 rounded-lg text-sm ${activeFilter==='day'?'bg-blue-500 text-white':'bg-gray-200'}`}>{t('today')}</button>
                        <button onClick={() => setActiveFilter('week')} className={`px-4 py-2 rounded-lg text-sm ${activeFilter==='week'?'bg-blue-500 text-white':'bg-gray-200'}`}>{t('thisWeek')}</button>
                        <button onClick={() => setActiveFilter('month')} className={`px-4 py-2 rounded-lg text-sm ${activeFilter==='month'?'bg-blue-500 text-white':'bg-gray-200'}`}>{t('thisMonth')}</button>
                        <button onClick={() => setActiveFilter('year')} className={`px-4 py-2 rounded-lg text-sm ${activeFilter==='year'?'bg-blue-500 text-white':'bg-gray-200'}`}>{t('thisYear')}</button>
                        <button onClick={() => setActiveFilter('all')} className={`px-4 py-2 rounded-lg text-sm ${activeFilter==='all'?'bg-blue-500 text-white':'bg-gray-200'}`}>{t('all')}</button>
                    </div>
                    <div className="flex items-end gap-2 border-l-2 pl-4">
                        <div><label className="text-sm">{t('from')}</label><input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg text-sm"/></div>
                        <div><label className="text-sm">{t('to')}</label><input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg text-sm"/></div>
                        <button onClick={() => setActiveFilter('custom')} className={`px-4 py-2 rounded-lg text-sm ${activeFilter==='custom'?'bg-blue-500 text-white':'bg-blue-200'}`}>{t('filter')}</button>
                    </div>
                </div>
            </div>)}
            {filteredSales.length > 0 && <p className="mb-4 text-lg font-bold">{t('totalDisplayed')}: {formatCurrency(subtotal, language)}</p>}
            <div className="overflow-x-auto"><table className="w-full text-left">
                <thead><tr className="border-b"><th className="p-3">{t('invoiceNo')}</th><th className="p-3">{t('products')}</th><th className="p-3">{t('customers')}</th><th className="p-3">{t('total')}</th><th className="p-3">{t('date')}</th><th className="p-3">Status</th><th className="p-3 text-right">{t('actions')}</th></tr></thead>
                <tbody>{filteredSales.map(sale => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-semibold">{sale.invoiceId}</td>
                        <td className="p-3 text-sm">{sale.items.map(i => i.productName).join(', ')}</td>
                        <td className="p-3">{sale.customerName}</td><td className="p-3">{formatCurrency(sale.totalPrice, language)}</td>
                        <td className="p-3">{formatDateTime(sale.saleDate, language)}</td>
                        <td className="p-3"><StatusBadge status={sale.status} /></td>
                        <td className="p-3 text-right"><button onClick={() => handleShowInvoice(sale)}><Printer size={20} /></button></td>
                    </tr>
                ))}</tbody>
            </table></div>
        </div>
    );
});

const DebtsView = React.memo(({ sales, openModal, t, language }) => {
    const debtSales = useMemo(() => sales.filter(s => s.status === SALE_STATUS.CREDIT), [sales]);
    return (
        <div className="bg-white p-8 rounded-2xl shadow-md">
             <h2 className="text-3xl font-bold text-gray-800 mb-6">{t('debts')}</h2>
             <div className="overflow-x-auto"><table className="w-full text-left">
                <thead><tr className="border-b">
                    <th className="p-3">{t('invoiceNo')}</th><th className="p-3">{t('customers')}</th><th className="p-3">{t('amountDue')}</th><th className="p-3">{t('date')}</th><th className="p-3 text-right">{t('actions')}</th>
                </tr></thead>
                <tbody>{debtSales.map(sale => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-semibold">{sale.invoiceId}</td>
                        <td className="p-3">{sale.customerName}</td>
                        <td className="p-3 text-red-600 font-semibold">{formatCurrency(sale.totalPrice - (sale.paidAmount || 0), language)}</td>
                        <td className="p-3">{formatDateTime(sale.saleDate, language)}</td>
                        <td className="p-3 text-right"><button onClick={() => openModal('makePayment', sale)} className="text-green-500"><CheckCircle size={20} /></button></td>
                    </tr>
                ))}</tbody>
             </table></div>
        </div>
    );
});

const RefundsView = React.memo(({ payments, t, language }) => {
    const sortedPayments = useMemo(() => [...payments].sort((a,b) => new Date(b.paymentDate) - new Date(a.paymentDate)), [payments]);
    return (
        <div className="bg-white p-8 rounded-2xl shadow-md">
             <h2 className="text-3xl font-bold text-gray-800 mb-6">{t('refundHistory')}</h2>
             <div className="overflow-x-auto"><table className="w-full text-left">
                <thead><tr className="border-b"><th className="p-3">{t('date')}</th><th className="p-3">{t('customers')}</th><th className="p-3">{t('amount')}</th><th className="p-3">{t('method')}</th><th className="p-3">{t('invoiceRef')}</th></tr></thead>
                <tbody>{sortedPayments.map((item, index) => (<tr key={item.id || index} className="border-b hover:bg-gray-50">
                    <td className="p-3">{formatDateTime(item.paymentDate, language)}</td>
                    <td className="p-3">{item.customerName}</td>
                    <td className="p-3">{formatCurrency(item.amount, language)}</td>
                    <td className="p-3">{item.paymentType}</td>
                    <td className="p-3">{item.invoiceId}</td>
                </tr>))}</tbody>
             </table></div>
        </div>
    );
});

const SettingsView = React.memo(({ companyProfile, handleSaveProfile, t }) => {
    return (
        <div className="bg-white p-8 rounded-2xl shadow-md max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">{t('settings')}</h2>
            <CompanyProfileForm initialData={companyProfile} onSubmit={handleSaveProfile} t={t} />
        </div>
    );
});

// --- FORMS AND MODALS ---

const ProductForm = React.memo(({ onSubmit, initialData, categories, products, onClose }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [price, setPrice] = useState(initialData?.price || '');
    const [basePrice, setBasePrice] = useState(initialData?.basePrice || '');
    const [photoURL, setPhotoURL] = useState(initialData?.photoURL || null);
    const [parentCategoryId, setParentCategoryId] = useState('');
    const [subCategoryId, setSubCategoryId] = useState(initialData?.categoryId || '');
    const [productType, setProductType] = useState(initialData?.type === PRODUCT_TYPES.PACK ? PRODUCT_TYPES.PACK : PRODUCT_TYPES.SIMPLE);
    
    // State for Simple product
    const [quantity, setQuantity] = useState(initialData?.quantity ?? '');
    const [reorderThreshold, setReorderThreshold] = useState(initialData?.reorderThreshold ?? '');

    // State for Pack product
    const [packItems, setPackItems] = useState(() => 
        (initialData?.packItems || []).map(item => ({
            ...item,
            packItemId: crypto.randomUUID()
        }))
    );
    
    // State for Variant product
    const [variants, setVariants] = useState(initialData?.variants || []);

    const parentCategories = useMemo(() => categories.filter(c => !c.parentId), [categories]);
    const subCategories = useMemo(() => parentCategoryId ? categories.filter(c => c.parentId === parentCategoryId) : [], [categories, parentCategoryId]);
    
    useEffect(() => {
        if (initialData?.categoryId) {
            const cat = categories.find(c => c.id === initialData.categoryId);
            if (cat?.parentId) { setParentCategoryId(cat.parentId); setSubCategoryId(cat.id); } 
            else { setParentCategoryId(cat?.id || ''); }
        }
    }, [initialData, categories]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const finalProductType = productType === PRODUCT_TYPES.PACK 
            ? PRODUCT_TYPES.PACK 
            : (variants.length > 0 ? PRODUCT_TYPES.VARIANT : PRODUCT_TYPES.SIMPLE);

        const commonData = { name, description, photoURL, type: finalProductType };
        let data = {};
        
        if (finalProductType !== PRODUCT_TYPES.PACK) {
            commonData.categoryId = subCategoryId || parentCategoryId;
        } else {
            commonData.categoryId = null;
        }

        if (finalProductType === PRODUCT_TYPES.SIMPLE) {
            data = { ...commonData, price: Number(price), quantity: Number(quantity), reorderThreshold: Number(reorderThreshold) };
        } else if (finalProductType === PRODUCT_TYPES.PACK) {
            const finalPackItems = packItems.map(({ packItemId, ...rest }) => rest);
            data = { ...commonData, price: Number(price), packItems: finalPackItems, quantity: 0 };
        } else if (finalProductType === PRODUCT_TYPES.VARIANT) {
            data = { ...commonData, basePrice: Number(basePrice), variants };
        }
        onSubmit(data);
    };
    
    const handlePhotoChange = async (e) => { if (e.target.files[0]) { const r = await resizeImage(e.target.files[0], 400, 400); setPhotoURL(r); } }
    const handleAddPackItem = (item) => { setPackItems(current => [...current, { ...item, packItemId: crypto.randomUUID() }]); };
    const handleRemovePackItem = (packItemId) => { setPackItems(current => current.filter(item => item.packItemId !== packItemId)); };

    const handleAddVariant = (variant) => {
        if (variants.length === 0 && price) {
            setBasePrice(price);
        }
        setVariants(current => [...current, { ...variant, id: crypto.randomUUID() }]);
    };
    const handleRemoveVariant = (variantId) => {
        const newVariants = variants.filter(v => v.id !== variantId);
        if (newVariants.length === 0 && basePrice) {
            setPrice(basePrice);
            setBasePrice('');
        }
        setVariants(newVariants);
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-center">{initialData ? 'Edit Product' : 'Add Product'}</h3>
            <div className="flex flex-col items-center space-y-2">
                 <label className="w-full text-sm font-medium">Photo</label>
                 <div className="w-32 h-32 rounded-lg bg-gray-100 flex items-center justify-center border-2 border-dashed">
                     {photoURL ? <img src={photoURL} alt="Preview" className="w-full h-full object-cover rounded-lg"/> : <ImageIcon className="text-gray-400" size={40}/>}
                 </div>
                 <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
             </div>
            <FormField label="Product Name" type="text" value={name} onChange={e => setName(e.target.value)} required />
            <FormSelect label="Product Type" value={productType} onChange={e => setProductType(e.target.value)}>
                <option value={PRODUCT_TYPES.SIMPLE}>Standard Item (Simple or with Variants)</option>
                <option value={PRODUCT_TYPES.PACK}>Pack</option>
            </FormSelect>
             
            {productType === PRODUCT_TYPES.SIMPLE && (
                <>
                    {variants.length === 0 ? (
                         <>
                            <FormField label="Quantity" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} required min="0" />
                            <FormField label="Reorder Threshold" type="number" value={reorderThreshold} onChange={e => setReorderThreshold(e.target.value)} required min="0" />
                            <FormField label="Sale Price" type="number" value={price} onChange={e => setPrice(e.target.value)} required min="0" />
                         </>
                    ) : (
                         <FormField label="Base Price" type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} required min="0" />
                    )}
                    <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
                        <h4 className="font-semibold">Product Variants (Optional)</h4>
                        <VariantForm onAddVariant={handleAddVariant} />
                         {variants.length > 0 && <ul className="space-y-2">
                            {variants.map(v => (
                                <li key={v.id} className="flex justify-between items-center bg-white p-2 rounded-md text-sm">
                                    <span>{v.name} (Price Mod: {formatCurrency(v.priceModifier)}, Stock: {v.quantity})</span>
                                    <button type="button" onClick={() => handleRemoveVariant(v.id)} className="text-red-500"><Trash2 size={16}/></button>
                                </li>
                            ))}
                        </ul>}
                    </div>
                </>
            )}
            
             {productType === PRODUCT_TYPES.PACK && (<>
                <FormField label="Pack Sale Price" type="number" value={price} onChange={e => setPrice(e.target.value)} required min="0" />
                <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
                    <h4 className="font-semibold">Pack Composition</h4>
                    <PackItemSelector products={products.filter(p => p.type === PRODUCT_TYPES.SIMPLE || p.type === PRODUCT_TYPES.VARIANT)} onAddItem={handleAddPackItem} />
                    <ul className="space-y-2">
                        {packItems.map((item) => (
                            <li key={item.packItemId} className="flex justify-between items-center bg-white p-2 rounded-md">
                                <span>{item.name} x {item.quantity}</span>
                                <button type="button" onClick={() => handleRemovePackItem(item.packItemId)} className="text-red-500"><Trash2 size={16}/></button>
                            </li>
                        ))}
                    </ul>
                </div>
            </>)}

            <FormSelect label="Main Category" value={parentCategoryId} onChange={e => { setParentCategoryId(e.target.value); setSubCategoryId(''); }} disabled={productType === PRODUCT_TYPES.PACK}>
                <option value="">Select...</option>
                {parentCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </FormSelect>
             <FormSelect label="Sub-category" value={subCategoryId} onChange={e => setSubCategoryId(e.target.value)} disabled={!parentCategoryId || subCategories.length === 0 || productType === PRODUCT_TYPES.PACK}>
                <option value="">Select...</option>
                {subCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </FormSelect>
            <FormField label="Description" type="text" value={description} onChange={e => setDescription(e.target.value)} />
            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded-lg text-white bg-blue-500 font-semibold">{initialData ? 'Update' : 'Add'}</button>
            </div>
        </form>
    );
});

const VariantForm = React.memo(({ onAddVariant }) => {
    const [name, setName] = useState('');
    const [priceModifier, setPriceModifier] = useState(0);
    const [quantity, setQuantity] = useState('');
    const [reorderThreshold, setReorderThreshold] = useState('');

    const handleAdd = () => {
        if (!name || quantity === '') return;
        onAddVariant({ name, priceModifier: Number(priceModifier), quantity: Number(quantity), reorderThreshold: Number(reorderThreshold || 0) });
        setName(''); setPriceModifier(0); setQuantity(''); setReorderThreshold('');
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <FormField label="Variant Name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Red, XL..."/>
            <FormField label="Price Mod." type="number" value={priceModifier} onChange={e => setPriceModifier(e.target.value)} placeholder="Ex: 500 or -200" />
            <FormField label="Stock" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Quantity"/>
            <FormField label="Reorder Thresh." type="number" value={reorderThreshold} onChange={e => setReorderThreshold(e.target.value)} placeholder="Threshold"/>
            <button type="button" onClick={handleAdd} className="px-4 py-2 bg-blue-500 text-white rounded-lg h-10"><Plus size={20}/></button>
        </div>
    )
});

const PackItemSelector = React.memo(({ products, onAddItem }) => {
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [quantity, setQuantity] = useState(1);

    const selectedProduct = useMemo(() => {
        return products.find(p => p.id === selectedProductId);
    }, [products, selectedProductId]);

    useEffect(() => {
        setSelectedVariantId('');
    }, [selectedProductId]);

    const handleAdd = () => {
        if (!selectedProduct || quantity <= 0) return;

        if (selectedProduct.type === PRODUCT_TYPES.VARIANT) {
            if (!selectedVariantId) return;
            const variant = selectedProduct.variants.find(v => v.id === selectedVariantId);
            if (variant) {
                const itemToAdd = {
                    productId: selectedProduct.id,
                    name: `${selectedProduct.name} - ${variant.name}`,
                    quantity: quantity,
                    variant: { id: variant.id, name: variant.name }
                };
                onAddItem(itemToAdd);
            }
        } else {
            const itemToAdd = {
                productId: selectedProduct.id,
                name: selectedProduct.name,
                quantity: quantity,
                variant: null
            };
            onAddItem(itemToAdd);
        }

        setSelectedProductId('');
        setSelectedVariantId('');
        setQuantity(1);
    };

    return (
        <div className="flex flex-wrap items-end gap-2">
            <div className="flex-grow min-w-[150px]">
                 <label className="text-sm">Product</label>
                 <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                    <option value="">Choose a product...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
            </div>
            
            {selectedProduct && selectedProduct.type === PRODUCT_TYPES.VARIANT && (
                <div className="flex-grow min-w-[150px]">
                    <label className="text-sm">Variant</label>
                    <select value={selectedVariantId} onChange={e => setSelectedVariantId(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                        <option value="">Choose a variant...</option>
                        {selectedProduct.variants.map(v => <option key={v.id} value={v.id}>{v.name} (Stock: {v.quantity})</option>)}
                    </select>
                </div>
            )}

            <div className="w-24">
                 <label className="text-sm">Quantity</label>
                 <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <button type="button" onClick={handleAdd} className="px-4 py-2 bg-blue-500 text-white rounded-lg h-10 self-end"><Plus size={20}/></button>
        </div>
    )
});

const CategoryForm = React.memo(({ onSubmit, initialData, categories, onClose }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [parentId, setParentId] = useState(initialData?.parentId || '');
    const parentCategories = categories.filter(c => !c.parentId && c.id !== initialData?.id);
    const handleSubmit = (e) => { e.preventDefault(); onSubmit({ name, parentId: parentId || null }); };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-center">{initialData ? 'Edit' : 'Add'} Category</h3>
            <FormField label="Name" type="text" value={name} onChange={e => setName(e.target.value)} required />
            <FormSelect label="Parent Category (Optional)" value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">None (Main)</option>
                {parentCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </FormSelect>
             <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded-lg text-white bg-blue-500 font-semibold">{initialData ? 'Update' : 'Add'}</button>
            </div>
        </form>
    );
});

const CustomerForm = React.memo(({ onSubmit, initialData, onClose, onSuccess }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [nickname, setNickname] = useState(initialData?.nickname || '');
    const [address, setAddress] = useState(initialData?.address || '');
    const [email, setEmail] = useState(initialData?.email || '');
    const [phone, setPhone] = useState(initialData?.phone || '');
    const handleSubmit = (e) => { 
        e.preventDefault(); 
        const data = { name, nickname, address, email, phone, balance: initialData?.balance || 0 };
        if (!initialData && onSuccess) {
            onSubmit(data, onSuccess);
        } else {
            onSubmit(data);
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-center">{initialData ? 'Edit Customer' : 'Add Customer'}</h3>
            <FormField label="Full Name" type="text" value={name} onChange={e => setName(e.target.value)} required />
            <FormField label="Nickname (Optional)" type="text" value={nickname} onChange={e => setNickname(e.target.value)} />
            <FormField label="Address (Optional)" type="text" value={address} onChange={e => setAddress(e.target.value)} />
            <FormField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <FormField label="Phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded-lg text-white bg-blue-500 font-semibold">{initialData ? 'Update' : 'Add'}</button>
            </div>
        </form>
    );
});

const DepositForm = React.memo(({ customer, onSubmit, onClose }) => {
    const [amount, setAmount] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); onSubmit(amount); };
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-center">Add a deposit</h3>
            <p className="text-center">for {customer.name}</p>
            <FormField label="Deposit Amount (F CFA)" type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="1" />
            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded-lg text-white bg-green-500 font-semibold">Save</button>
            </div>
        </form>
    );
});

const SaleForm = React.memo(({ onSubmit, customers, onClose, cart, setCart, preselectedCustomerId, openModal, showAlert }) => {
    const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
    const [paymentType, setPaymentType] = useState(PAYMENT_TYPES[0]);
    const [discountType, setDiscountType] = useState('percentage');
    const [discountValue, setDiscountValue] = useState(0);
    const [applyVAT, setApplyVAT] = useState(false);
    
    const { subtotal, discountAmount, vatAmount, finalTotal } = useMemo(() => {
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const discountAmount = discountType === 'percentage' ? subtotal * (Number(discountValue) / 100) : Number(discountValue);
        const subtotalAfterDiscount = subtotal - discountAmount;
        const vatAmount = applyVAT ? subtotalAfterDiscount * VAT_RATE : 0;
        const finalTotal = subtotalAfterDiscount + vatAmount;
        return { subtotal, discountAmount, vatAmount, finalTotal };
    }, [cart, discountType, discountValue, applyVAT]);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (cart.length === 0) { showAlert("The cart is empty."); return; }
        if (!customerId) { showAlert("Please select a customer."); return; }
        onSubmit({ customerId, paymentType, items: cart, totalPrice: finalTotal, discountAmount, vatAmount });
    };

    const handleAddNewCustomer = () => {
        openModal('addCustomer', { onSuccess: (newCustomer) => {
            setCustomerId(newCustomer.id);
        }}, 'md');
    };

    const updateCartItemQuantity = (cartId, newQuantity) => {
        setCart(currentCart => currentCart.map(item => item.cartId === cartId ? { ...item, quantity: Math.max(0, newQuantity) } : item).filter(item => item.quantity > 0));
    };

    const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-2xl font-bold text-center text-gray-800">Sales Cart</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <h4 className="font-bold text-lg">Items ({cart.length})</h4>
                    <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                    {cart.length > 0 ? cart.map(item => (
                        <div key={item.cartId} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg">
                            <img src={item.photoURL || 'https://placehold.co/60x60'} alt={item.name} className="w-16 h-16 rounded-md object-cover"/>
                            <div className="flex-grow">
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-sm text-gray-600">{formatCurrency(item.price)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => updateCartItemQuantity(item.cartId, item.quantity - 1)} className="text-red-500"><MinusCircle size={20}/></button>
                                <input type="number" value={item.quantity} onChange={(e) => updateCartItemQuantity(item.cartId, parseInt(e.target.value, 10) || 0)} className="w-16 text-center border rounded-md p-1"/>
                                <button type="button" onClick={() => updateCartItemQuantity(item.cartId, item.quantity + 1)} className="text-green-500"><PlusCircle size={20}/></button>
                            </div>
                            <p className="w-24 text-right font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                    )) : <p className="text-center text-gray-500 py-8">The cart is empty.</p>}
                    </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
                    <h4 className="font-bold text-lg">Summary</h4>
                     <div className="flex items-end gap-2">
                         <div className="flex-grow"><FormSelect label="Customer" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                             <option value="" disabled>Select a customer</option>
                             {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </FormSelect></div>
                         <button type="button" onClick={handleAddNewCustomer} className="p-2 bg-blue-500 text-white rounded-lg"><Plus size={20}/></button>
                       </div>
                     <div>
                        <label className="block text-sm font-medium">Discount</label>
                        <div className="flex items-center">
                            <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="w-1/3 px-3 py-2 border rounded-l-lg bg-white">
                                <option value="percentage">%</option><option value="fixed">F CFA</option>
                            </select>
                            <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} min="0" className="w-2/3 px-3 py-2 border-t border-b border-r rounded-r-lg"/>
                        </div>
                    </div>
                    <div className="flex items-center"><input type="checkbox" id="vat-checkbox" checked={applyVAT} onChange={e => setApplyVAT(e.target.checked)} className="h-4 w-4 rounded"/>
                        <label htmlFor="vat-checkbox" className="ml-2 text-sm">Apply VAT (18%)</label>
                    </div>
                    <FormSelect label="Payment Type" value={paymentType} onChange={e => setPaymentType(e.target.value)} required>
                        {PAYMENT_TYPES.map(type => {
                            if(type === 'Acompte Client' && (!selectedCustomer || (selectedCustomer.balance || 0) <= 0)) return null;
                            return <option key={type} value={type}>{type} {type === 'Acompte Client' && `(${formatCurrency(selectedCustomer?.balance || 0)})`}</option>
                        })}
                    </FormSelect>
                    <div className="pt-4 space-y-2 text-right border-t">
                        <p>Subtotal: {formatCurrency(subtotal)}</p>
                        {discountAmount > 0 && <p className="text-red-500">Discount: -{formatCurrency(discountAmount)}</p>}
                        {applyVAT && <p>VAT (18%): +{formatCurrency(vatAmount)}</p>}
                        <p className="text-2xl font-bold text-green-600">Total: {formatCurrency(finalTotal)}</p>
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-4 pt-6">
                 <button type="button" onClick={() => openModal('productSelection', { preselectedCustomerId: customerId }, '7xl')} className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300">Continue Shopping</button>
                <button type="submit" className="px-8 py-3 rounded-lg text-white bg-blue-500 font-semibold">Validate Sale</button>
            </div>
        </form>
    );
});

const PaymentReceipt = React.memo(({ receiptData, onClose, showAlert }) => {
    if (!receiptData) return null;
    const { customer, amount, paymentType, paymentDate, remainingBalance, companyProfile, saleId, invoiceId } = receiptData;
    const [canShare, setCanShare] = useState(false);

    useEffect(() => {
        if (navigator.share && typeof navigator.canShare === 'function') {
            const dummyFile = new File([""], "dummy.pdf", { type: "application/pdf" });
            if (navigator.canShare({ files: [dummyFile] })) {
                setCanShare(true);
            }
        }
    }, []);

    const handlePrint = () => window.print();

    const generatePdf = async () => {
        const { jsPDF } = window.jspdf;
        const input = document.querySelector('.receipt-container.printable-area');
        if (!input || !window.html2canvas) {
            showAlert("PDF generation library is not loaded.");
            return null;
        }
        try {
            const canvas = await window.html2canvas(input, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            return pdf;
        } catch (error) {
            console.error("Error generating PDF:", error);
            showAlert("Could not generate PDF.");
            return null;
        }
    };

    const handleDownloadPDF = async () => { const pdf = await generatePdf(); if(pdf) { pdf.save(`payment-receipt-${invoiceId}.pdf`); } };
    
    const handleSharePDF = async () => {
        const pdf = await generatePdf();
        if (pdf && navigator.share) {
            const pdfBlob = pdf.output('blob');
            const fileName = `payment-receipt-${invoiceId}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            try { await navigator.share({ title: 'Payment Receipt', text: `Here is the payment receipt for invoice ${invoiceId}.`, files: [file] }); } 
            catch (error) { if (error.name !== 'AbortError') { showAlert("An error occurred while sharing."); } }
        }
    };
    
    return (
        <div className="receipt-container">
             <div className="printable-area p-6">
                <div className="flex justify-between items-start">
                    <div><h1 className="text-2xl font-bold">PAYMENT RECEIPT</h1></div>
                    <div className="text-right"><h2 className="text-xl font-bold">{companyProfile.name}</h2></div>
                </div>
                <div className="border-b my-6"></div>
                <div className="flex justify-between mb-6">
                    <div><h3 className="font-bold">Received from:</h3><p>{customer.name}</p></div>
                    <div className="text-right">
                        <p><span className="font-bold">Date:</span> {formatDateTime(paymentDate)}</p>
                        <p><span className="font-bold">Original Invoice:</span> {invoiceId}</p>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-lg">Amount Paid: <span className="font-bold text-green-600">{formatCurrency(amount)}</span></p>
                    <p>Payment Method: {paymentType}</p>
                </div>
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-lg">Remaining Balance on Debt: <span className="font-bold text-red-600">{formatCurrency(remainingBalance)}</span></p>
                </div>
            </div>
            <div className="flex justify-end space-x-2 p-6 bg-gray-50 rounded-b-2xl no-print">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200">Close</button>
                {canShare && ( <button onClick={handleSharePDF} className="flex items-center px-4 py-2 rounded-lg text-white bg-blue-600 font-semibold"><Share2 size={18} className="mr-2" /> Share</button> )}
                <button onClick={handleDownloadPDF} className="flex items-center px-4 py-2 rounded-lg text-white bg-green-600 font-semibold"><FileText size={18} className="mr-2" /> PDF</button>
                <button onClick={handlePrint} className="flex items-center px-4 py-2 rounded-lg text-white bg-gray-500 font-semibold"><Printer size={18} className="mr-2" /> Print</button>
            </div>
        </div>
    );
});

const DepositReceipt = React.memo(({ receiptData, onClose, showAlert }) => {
    if (!receiptData) return null;
    const { customer, amount, depositDate, companyProfile, customerId } = receiptData;
    const [canShare, setCanShare] = useState(false);
    const receiptId = `${companyProfile.depositPrefix || 'DEP-'}${customerId.substring(0,4).toUpperCase()}${new Date(depositDate).getTime().toString().slice(-4)}`;

    useEffect(() => {
        if (navigator.share && typeof navigator.canShare === 'function') {
            const dummyFile = new File([""], "dummy.pdf", { type: "application/pdf" });
            if (navigator.canShare({ files: [dummyFile] })) {
                setCanShare(true);
            }
        }
    }, []);

    const handlePrint = () => window.print();

    const generatePdf = async () => {
        const { jsPDF } = window.jspdf;
        const input = document.querySelector('.receipt-container.printable-area');
        if (!input || !window.html2canvas) { showAlert("PDF generation library is not loaded."); return null; }
        try {
            const canvas = await window.html2canvas(input, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            return pdf;
        } catch (error) { console.error("Error generating PDF:", error); showAlert("Could not generate PDF."); return null; }
    };
    
    const handleDownloadPDF = async () => { const pdf = await generatePdf(); if(pdf) { pdf.save(`deposit-receipt-${receiptId}.pdf`); } };
    
    const handleSharePDF = async () => {
        const pdf = await generatePdf();
        if (pdf && navigator.share) {
            const pdfBlob = pdf.output('blob');
            const fileName = `deposit-receipt-${receiptId}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            try { await navigator.share({ title: 'Deposit Receipt', text: `Here is the deposit receipt for ${customer.name}.`, files: [file] }); } 
            catch (error) { if (error.name !== 'AbortError') { showAlert("An error occurred while sharing."); } }
        }
    };
    
    return (
        <div className="receipt-container">
             <div className="printable-area p-6">
                <div className="flex justify-between items-start">
                    <div><h1 className="text-2xl font-bold">DEPOSIT RECEIPT</h1><p className="text-gray-500 text-sm">{receiptId}</p></div>
                    <div className="text-right"><h2 className="text-xl font-bold">{companyProfile.name}</h2></div>
                </div>
                <div className="border-b my-6"></div>
                <div className="flex justify-between mb-6">
                    <div><h3 className="font-bold">Received from:</h3><p>{customer.name}</p></div>
                    <div className="text-right"><p><span className="font-bold">Date:</span> {formatDateTime(depositDate)}</p></div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-lg">Deposit amount: <span className="font-bold text-green-600">{formatCurrency(amount)}</span></p>
                </div>
                 <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-lg">New deposit balance: <span className="font-bold text-blue-600">{formatCurrency(customer.balance || 0)}</span></p>
                </div>
            </div>
            <div className="flex justify-end space-x-2 p-6 bg-gray-50 rounded-b-2xl no-print">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200">Close</button>
                {canShare && ( <button onClick={handleSharePDF} className="flex items-center px-4 py-2 rounded-lg text-white bg-blue-600 font-semibold"><Share2 size={18} className="mr-2" /> Share</button> )}
                <button onClick={handleDownloadPDF} className="flex items-center px-4 py-2 rounded-lg text-white bg-green-600 font-semibold"><FileText size={18} className="mr-2" /> PDF</button>
                <button onClick={handlePrint} className="flex items-center px-4 py-2 rounded-lg text-white bg-gray-500 font-semibold"><Printer size={18} className="mr-2" /> Print</button>
            </div>
        </div>
    );
});

const Invoice = React.memo(({ sale, products, companyProfile, onClose, showAlert }) => {
    if (!sale) return null;
    const [canShare, setCanShare] = useState(false);

    useEffect(() => {
        if (navigator.share && typeof navigator.canShare === 'function') {
            const dummyFile = new File([""], "dummy.pdf", { type: "application/pdf" });
            if (navigator.canShare({ files: [dummyFile] })) { setCanShare(true); }
        }
    }, []);

    const handlePrint = () => window.print();
    
    const generatePdf = async () => {
        const { jsPDF } = window.jspdf;
        const input = document.querySelector('.invoice-container.printable-area');
        if (!input || !window.html2canvas) { showAlert("PDF generation library is not loaded."); return null; }
        try {
            const canvas = await window.html2canvas(input, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            return pdf;
        } catch (error) { console.error("Error generating PDF:", error); showAlert("Could not generate PDF."); return null; }
    };
    
    const handleDownloadPDF = async () => { const pdf = await generatePdf(); if(pdf) { pdf.save(`invoice-${sale.invoiceId}.pdf`); } };
    
    const handleSharePDF = async () => {
        const pdf = await generatePdf();
        if (pdf && navigator.share) {
            const pdfBlob = pdf.output('blob');
            const fileName = `invoice-${sale.invoiceId}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
             try { await navigator.share({ title: `Invoice ${sale.invoiceId}`, text: `Here is the invoice for ${sale.customer.name}.`, files: [file] }); } 
             catch (error) { if (error.name !== 'AbortError') { showAlert("An error occurred while sharing."); } }
        }
    };

    return (
        <div className="invoice-container">
            <div className="printable-area p-6">
                <div className="flex justify-between items-start">
                    <div><h1 className="text-2xl font-bold">INVOICE</h1><p className="text-gray-500 text-sm">{sale.invoiceId}</p></div>
                    <div className="text-right">
                        {companyProfile.logo && <img src={companyProfile.logo} alt={companyProfile.name} className="h-12 w-auto ml-auto mb-2" />}
                        <h2 className="text-xl font-bold">{companyProfile.name}</h2>
                        <p className="text-sm">{companyProfile.address}</p><p className="text-sm">{companyProfile.phone}</p>
                    </div>
                </div>
                <div className="border-b my-6"></div>
                <div className="flex justify-between mb-6">
                    <div><h3 className="font-bold">Billed to:</h3><p>{sale.customer?.name}</p></div>
                    <div className="text-right"><p><span className="font-bold">Date:</span> {formatDateTime(sale.saleDate)}</p><p><span className="font-bold">Payment:</span> {sale.paymentType}</p></div>
                </div>
                <table className="w-full text-left mb-8">
                    <thead><tr className="bg-gray-100"><th className="p-3">Product</th><th className="p-3">Qty</th><th className="p-3 text-right">P.U.</th><th className="p-3 text-right">Total</th></tr></thead>
                    <tbody>
                        {sale.items.flatMap((item, i) => {
                            const productDetails = products.find(p => p.id === item.productId);
                            const mainRow = (
                                <tr key={item.productId || i}>
                                    <td className="p-3 border-b">{item.productName}</td>
                                    <td className="p-3 border-b">{item.quantity}</td>
                                    <td className="p-3 border-b text-right">{formatCurrency(item.unitPrice)}</td>
                                    <td className="p-3 border-b text-right">{formatCurrency(item.subtotal)}</td>
                                </tr>
                            );

                            if (productDetails && productDetails.type === PRODUCT_TYPES.PACK) {
                                const subRows = productDetails.packItems.map((packItem, j) => (
                                    <tr key={`${item.productId}-${j}`} className="bg-gray-50 text-sm">
                                        <td className="pl-8 pr-3 py-2 text-gray-600 border-b">
                                            {packItem.quantity * item.quantity} x {packItem.name}
                                        </td>
                                        <td className="p-2 border-b"></td>
                                        <td className="p-2 border-b"></td>
                                        <td className="p-2 border-b"></td>
                                    </tr>
                                ));
                                return [mainRow, ...subRows];
                            }
                            return [mainRow];
                        })}
                    </tbody>
                </table>
                <div className="text-right w-full max-w-xs ml-auto">
                    <div className="flex justify-between"><span className="font-semibold">Subtotal:</span><span>{formatCurrency(sale.items.reduce((acc, i) => acc + i.subtotal, 0))}</span></div>
                    {sale.discountAmount > 0 && <div className="flex justify-between text-red-500"><span className="font-semibold">Discount:</span><span>-{formatCurrency(sale.discountAmount)}</span></div>}
                    <div className="flex justify-between"><span className="font-semibold">Amount before tax:</span><span>{formatCurrency(sale.totalPrice - sale.vatAmount)}</span></div>
                    {sale.vatAmount > 0 && <div className="flex justify-between"><span className="font-semibold">VAT (18%):</span><span>+{formatCurrency(sale.vatAmount)}</span></div>}
                    <div className="flex justify-between text-2xl font-bold border-t mt-2 pt-2"><span className="font-semibold">TOTAL:</span><span>{formatCurrency(sale.totalPrice)}</span></div>
                </div>
                <div className="mt-12 text-center text-sm text-gray-500"><p>{companyProfile.invoiceFooterMessage || "Thank you for your purchase!"}</p></div>
            </div>
            <div className="flex justify-end space-x-2 p-6 bg-gray-50 rounded-b-2xl no-print">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200">Close</button>
                 {canShare && ( <button onClick={handleSharePDF} className="flex items-center px-4 py-2 rounded-lg text-white bg-blue-600 font-semibold"><Share2 size={18} className="mr-2" /> Share</button> )}
                <button onClick={handleDownloadPDF} className="flex items-center px-4 py-2 rounded-lg text-white bg-green-600 font-semibold"><FileText size={18} className="mr-2" /> PDF</button>
                <button onClick={handlePrint} className="flex items-center px-4 py-2 rounded-lg text-white bg-gray-500 font-semibold"><Printer size={18} className="mr-2" /> Print</button>
            </div>
        </div>
    );
});

const CompanyProfileForm = React.memo(({ onSubmit, initialData, t }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [address, setAddress] = useState(initialData?.address || '');
    const [phone, setPhone] = useState(initialData?.phone || '');
    const [logo, setLogo] = useState(initialData?.logo || null);
    const [invoicePrefix, setInvoicePrefix] = useState(initialData?.invoicePrefix || 'FAC-');
    const [refundPrefix, setRefundPrefix] = useState(initialData?.refundPrefix || 'REM-');
    const [depositPrefix, setDepositPrefix] = useState(initialData?.depositPrefix || 'DEP-');
    const [invoiceFooterMessage, setInvoiceFooterMessage] = useState(initialData?.invoiceFooterMessage || 'Merci pour votre achat !');
    const [language, setLanguage] = useState(initialData?.language || 'fr');
    const [isDocSettingsVisible, setIsDocSettingsVisible] = useState(false);

    const handleLogoChange = async (e) => {
        if(e.target.files[0]) { try { const r = await resizeImage(e.target.files[0], 200, 200); setLogo(r); } catch (err) { console.error(err); } }
    };
    const handleSubmit = (e) => { e.preventDefault(); onSubmit({ name, address, phone, logo, invoicePrefix, refundPrefix, depositPrefix, invoiceFooterMessage, language }); };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-xl font-bold text-gray-700 mb-4">{t('generalInfo')}</h3>
             <FormSelect label={t('language')} value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="fr">{t('francais')}</option>
                <option value="en">{t('english')}</option>
            </FormSelect>
            <div className="flex flex-col items-center space-y-2">
                <label className="w-full text-sm font-medium">Logo</label>
                <div className="w-32 h-32 rounded-lg bg-gray-100 flex items-center justify-center border-2 border-dashed">
                    {logo ? <img src={logo} alt="Logo preview" className="w-full h-full object-contain rounded-lg"/> : <ImageIcon className="text-gray-400" size={40}/>}
                </div>
                <input type="file" accept="image/*" onChange={handleLogoChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
            </div>
            <FormField label={t('companyName')} type="text" value={name} onChange={e => setName(e.target.value)} required />
            <FormField label={t('address')} type="text" value={address} onChange={e => setAddress(e.target.value)} />
            <FormField label={t('phone')} type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            
            <div className="border-t pt-6">
                <button type="button" onClick={() => setIsDocSettingsVisible(!isDocSettingsVisible)} className="flex justify-between items-center w-full text-left font-semibold text-lg text-gray-700">
                    {t('docCustomization')}
                    <ChevronDown className={`transition-transform ${isDocSettingsVisible ? 'rotate-180' : ''}`} />
                </button>
                {isDocSettingsVisible && (
                    <div className="mt-4 space-y-4">
                        <FormField label={t('salesInvoicePrefix')} value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)} />
                        <FormField label={t('refundInvoicePrefix')} value={refundPrefix} onChange={e => setRefundPrefix(e.target.value)} />
                        <FormField label={t('depositReceiptPrefix')} value={depositPrefix} onChange={e => setDepositPrefix(e.target.value)} />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoiceFooterMessage')}</label>
                            <textarea value={invoiceFooterMessage} onChange={e => setInvoiceFooterMessage(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows="3"></textarea>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex justify-end pt-4">
                <button type="submit" className="px-6 py-2 rounded-lg text-white bg-blue-500 font-semibold">{t('save')}</button>
            </div>
        </form>
    );
});

const PaymentForm = React.memo(({ onSubmit, sale, customers, onClose }) => {
    const customer = useMemo(() => customers.find(c => c.id === sale.customerId), [customers, sale]);
    const remainingBalance = sale.totalPrice - (sale.paidAmount || 0);
    const [amount, setAmount] = useState(remainingBalance);
    const [paymentType, setPaymentType] = useState(PAYMENT_TYPES[0]);
    useEffect(() => {
        if (paymentType === 'Acompte Client' && customer?.balance) { setAmount(Math.min(remainingBalance, customer.balance)); } 
        else { setAmount(remainingBalance); }
    }, [paymentType, customer, remainingBalance]);
    const handleSubmit = (e) => { e.preventDefault(); onSubmit(amount, paymentType); };
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-center">Make a Payment</h3>
            <div className="p-4 bg-gray-50 rounded-lg space-y-1">
                <p><strong>Customer:</strong> {sale.customerName}</p>
                <p className="font-bold text-red-600">Remaining Balance: {formatCurrency(remainingBalance)}</p>
            </div>
            <FormField label="Amount Paid" type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="1" max={paymentType === 'Acompte Client' ? Math.min(remainingBalance, customer?.balance || 0) : remainingBalance} />
            <FormSelect label="Payment Method" value={paymentType} onChange={e => setPaymentType(e.target.value)} required>
                {PAYMENT_TYPES.filter(p => p !== 'Créance').filter(p => p !== 'Acompte Client' || (customer && customer.balance > 0)).map(type => 
                    <option key={type} value={type}>{type} {type === 'Acompte Client' && `(Available: ${formatCurrency(customer?.balance || 0)})`}</option>
                )}
            </FormSelect>
            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded-lg text-white bg-green-500 font-semibold">Save Payment</button>
            </div>
        </form>
    );
});

const FormField = React.memo(({ label, ...props }) => ( <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label><input {...props} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div> ));
const FormSelect = React.memo(({ label, children, ...props }) => ( <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label><select {...props} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">{children}</select></div> ));

const StatusBadge = React.memo(({ status }) => {
    const statusClasses = {
        [SALE_STATUS.COMPLETED]: 'bg-green-100 text-green-800', 
        [SALE_STATUS.PARTIALLY_RETURNED]: 'bg-yellow-100 text-yellow-800',
        [SALE_STATUS.RETURNED]: 'bg-red-100 text-red-800', 
        [SALE_STATUS.CREDIT]: 'bg-orange-100 text-orange-800',
        "Espèce": 'bg-blue-100 text-blue-800', "Wave": 'bg-cyan-100 text-cyan-800', "Orange Money": 'bg-orange-100 text-orange-800', "Acompte Client": 'bg-purple-100 text-purple-800'
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
});

const ProductSelectionModal = React.memo(({ products, onAddToCart, openModal, onClose, onProceedToCart, cart }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const filteredProducts = useMemo(() => products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())), [products, searchTerm]);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold">Select products</h3>
                <div className="relative w-1/3">
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg"/>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-h-[60vh] overflow-y-auto p-2">
                {filteredProducts.map(product => (
                    <div key={product.id} onClick={() => openModal('productDetails', product, 'md')} className="bg-white rounded-lg shadow p-3 flex flex-col items-center text-center cursor-pointer hover:shadow-lg transition-shadow">
                        <img src={product.photoURL || 'https://placehold.co/150x150'} alt={product.name} className="w-full h-28 object-cover rounded-md mb-2"/>
                        <h4 className="font-semibold text-sm flex-grow">{product.name}</h4>
                        <p className="text-blue-600 font-bold text-sm">{formatCurrency(product.price || product.basePrice)}</p>
                    </div>
                ))}
            </div>
            <div className="flex justify-end space-x-4 pt-6 mt-4 border-t">
                <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200">Cancel</button>
                <button type="button" onClick={onProceedToCart} className="px-6 py-2 rounded-lg text-white bg-blue-500 font-semibold flex items-center">
                    View Cart <span className="ml-2 bg-white text-blue-500 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{cart.length}</span>
                </button>
            </div>
        </div>
    )
});

const ProductDetailModal = React.memo(({ product, onAddToCart, onClose, openModal }) => {
    const [quantity, setQuantity] = useState(1);
    const [selectedVariantId, setSelectedVariantId] = useState(product.variants?.[0]?.id || null);

    const handleAddAndReturn = () => {
        if(product.type === PRODUCT_TYPES.VARIANT) {
            const variant = product.variants.find(v => v.id === selectedVariantId);
            if(variant) { 
                onAddToCart(product, quantity, variant);
                // Re-open product selection modal after adding
                openModal('productSelection', null, '7xl');
             }
        } else {
            onAddToCart(product, quantity);
            // Re-open product selection modal after adding
            openModal('productSelection', null, '7xl');
        }
    };

    const selectedVariant = useMemo(() => product.variants?.find(v => v.id === selectedVariantId), [product, selectedVariantId]);
    const maxQuantity = selectedVariant ? selectedVariant.quantity : product.quantity;

    return (
        <div className="p-4">
            <h3 className="text-2xl font-bold text-center mb-4">{product.name}</h3>
            <img src={product.photoURL || 'https://placehold.co/300x200'} alt={product.name} className="w-full h-48 object-cover rounded-lg mb-4"/>
            <p className="text-center text-xl font-bold text-blue-600 mb-4">{formatCurrency(selectedVariant ? (product.basePrice || 0) + (selectedVariant.priceModifier || 0) : product.price)}</p>
            <p className="text-sm text-gray-600 mb-4">{product.description}</p>
            
            {product.type === PRODUCT_TYPES.VARIANT && (
                <div className="mb-4">
                    <label className="font-semibold">Variant:</label>
                    <FormSelect value={selectedVariantId} onChange={e => setSelectedVariantId(e.target.value)}>
                        {product.variants.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (Stock: {v.quantity})</option>
                        ))}
                    </FormSelect>
                </div>
            )}

            <div className="flex items-center justify-center gap-4 mb-6">
                 <label className="font-semibold">Quantity:</label>
                 <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" max={maxQuantity} className="w-24 text-center border rounded-md p-2"/>
            </div>
            <div className="flex justify-center space-x-4">
                <button type="button" onClick={() => openModal('editProduct', product, 'lg')} className="px-6 py-2 rounded-lg bg-gray-200">Manage Stock</button>
                <button type="button" onClick={handleAddAndReturn} className="px-6 py-2 rounded-lg text-white bg-blue-500 font-semibold">Add to Cart</button>
            </div>
        </div>
    );
});
