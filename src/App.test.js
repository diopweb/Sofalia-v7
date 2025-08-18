import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import App, {
    formatCurrency,
    formatDateTime,
    formatDate,
    toInputDate,
    resizeImage,
    Modal,
    AlertModal,
    ConfirmModal,
    ProductForm,
    CategoryForm,
    CustomerForm,
    SaleForm,
    PaymentForm,
    DepositForm,
    CompanyProfileForm,
    ProductSelectionModal,
    ProductDetailModal,
    DashboardView,
    ProductsView,
    CategoriesView,
    CustomersView,
    CustomerDetailsView,
    SalesView,
    DebtsView,
    RefundsView,
    SettingsView
} from './App'; // Adjust the import path as needed
import {
    initializeApp
} from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
    signInWithCustomToken
} from 'firebase/auth';
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

// Mock Firebase and Firestore
jest.mock('firebase/app', () => ({
    initializeApp: jest.fn(),
}));
jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(),
    onAuthStateChanged: jest.fn(),
    signInAnonymously: jest.fn(),
    signInWithCustomToken: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
    getFirestore: jest.fn(),
    collection: jest.fn(),
    doc: jest.fn(),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    onSnapshot: jest.fn(),
    query: jest.fn(),
    writeBatch: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    getDocs: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    runTransaction: jest.fn(),
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
    Printer: () => < div > PrinterIcon < /div>,
    Plus: () => < div > PlusIcon < /div>,
    Trash2: () => < div > Trash2Icon < /div>,
    Edit: () => < div > EditIcon < /div>,
    X: () => < div > XIcon < /div>,
    Users: () => < div > UsersIcon < /div>,
    Package: () => < div > PackageIcon < /div>,
    ShoppingCart: () => < div > ShoppingCartIcon < /div>,
    DollarSign: () => < div > DollarSignIcon < /div>,
    BarChart2: () => < div > BarChart2Icon < /div>,
    Tag: () => < div > TagIcon < /div>,
    ImageIcon: () => < div > ImageIcon < /div>,
    CreditCard: () => < div > CreditCardIcon < /div>,
    CheckCircle: () => < div > CheckCircleIcon < /div>,
    ListChecks: () => < div > ListChecksIcon < /div>,
    Settings: () => < div > SettingsIcon < /div>,
    AlertCircle: () => < div > AlertCircleIcon < /div>,
    FileText: () => < div > FileTextIcon < /div>,
    ArrowLeft: () => < div > ArrowLeftIcon < /div>,
    Filter: () => < div > FilterIcon < /div>,
    Share2: () => < div > Share2Icon < /div>,
    List: () => < div > ListIcon < /div>,
    LayoutGrid: () => < div > LayoutGridIcon < /div>,
    MinusCircle: () => < div > MinusCircleIcon < /div>,
    PlusCircle: () => < div > PlusCircleIcon < /div>,
    Search: () => < div > SearchIcon < /div>,
    Archive: () => < div > ArchiveIcon < /div>,
    ChevronDown: () => < div > ChevronDownIcon < /div>,
}));


// Mock utility functions that interact with browser APIs
// Mock FileReader and Image for resizeImage
global.FileReader = class {
    readAsDataURL() {
        this.onload({
            target: {
                result: 'data:image/png;base64,test'
            }
        });
    }
};
global.Image = class {
    constructor() {
        setTimeout(() => {
            this.width = 100;
            this.height = 100;
            this.onload();
        }, 10);
    }
};
global.document.createElement = jest.fn((tag) => {
    if (tag === 'canvas') {
        return {
            getContext: () => ({
                drawImage: jest.fn()
            }),
            toDataURL: () => 'data:image/jpeg;base64,resized',
        };
    }
    const element = jest.fn();
    element.style = {}; // Mock style object
    return element;
});
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock window.print
global.window.print = jest.fn();

// Mock window.jspdf and html2canvas
global.window.jspdf = {
    jsPDF: jest.fn(() => ({
        internal: {
            pageSize: {
                getWidth: () => 210,
                getHeight: () => 297
            }
        },
        addImage: jest.fn(),
        save: jest.fn(),
        output: () => new Blob(['fake pdf content'], {
            type: 'application/pdf'
        }),
    })),
};
global.window.html2canvas = jest.fn((element, options) => {
    return Promise.resolve({
        toDataURL: () => 'data:image/png;base64,canvasimage'
    });
});

// Mock navigator.share and navigator.canShare
global.navigator.share = jest.fn();
global.navigator.canShare = jest.fn(() => true);


// Mock console.error to avoid polluting test output
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

// Setup initial state for Firebase mocks
const mockProducts = [{
    id: 'p1',
    name: 'Product 1',
    price: 100,
    quantity: 10,
    type: 'simple',
    reorderThreshold: 2
}, {
    id: 'p2',
    name: 'Product 2 (Variant)',
    basePrice: 200,
    type: 'variant',
    variants: [{
        id: 'v1',
        name: 'Small',
        priceModifier: -10,
        quantity: 5,
        reorderThreshold: 1
    }, {
        id: 'v2',
        name: 'Large',
        priceModifier: 20,
        quantity: 3,
        reorderThreshold: 1
    }]
}, {
    id: 'p3',
    name: 'Product 3 (Pack)',
    price: 300,
    type: 'pack',
    packItems: [{
        productId: 'p1',
        quantity: 2,
        name: 'Product 1'
    }],
    quantity: 0 // Pack quantity is derived
}, {
    id: 'p4',
    name: 'Low Stock Product',
    price: 50,
    quantity: 1,
    type: 'simple',
    reorderThreshold: 5
}, ];
const mockCustomers = [{
    id: 'c1',
    name: 'Customer 1',
    balance: 500
}, {
    id: 'c2',
    name: 'Customer 2',
    balance: 0
}, ];
const mockCategories = [{
    id: 'cat1',
    name: 'Category 1'
}, {
    id: 'subcat1',
    name: 'Subcategory 1',
    parentId: 'cat1'
}, ];
const mockSales = [{
    id: 's1',
    invoiceId: 'FAC-00001',
    customerId: 'c1',
    customerName: 'Customer 1',
    paymentType: 'Espèce',
    items: [{
        productId: 'p1',
        productName: 'Product 1',
        quantity: 1,
        unitPrice: 100,
        subtotal: 100
    }],
    totalPrice: 100,
    paidAmount: 100,
    status: 'Complété',
    saleDate: new Date().toISOString(),
    userId: 'u1',
    userPseudo: 'Admin',
}, {
    id: 's2',
    invoiceId: 'FAC-00002',
    customerId: 'c2',
    customerName: 'Customer 2',
    paymentType: 'Créance',
    items: [{
        productId: 'p1',
        productName: 'Product 1',
        quantity: 2,
        unitPrice: 100,
        subtotal: 200
    }],
    totalPrice: 200,
    paidAmount: 0,
    status: 'Créance',
    saleDate: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    userId: 'u1',
    userPseudo: 'Admin',
}, {
    id: 's3',
    invoiceId: 'FAC-00003',
    customerId: 'c1',
    customerName: 'Customer 1',
    paymentType: 'Wave',
    items: [{
        productId: 'p2',
        productName: 'Product 2 - Small',
        variant: {
            id: 'v1',
            name: 'Small'
        },
        quantity: 1,
        unitPrice: 190,
        subtotal: 190
    }],
    totalPrice: 190,
    paidAmount: 190,
    status: 'Complété',
    saleDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    userId: 'u1',
    userPseudo: 'Admin',
}, ];
const mockPayments = [{
    id: 'pay1',
    saleId: 's2',
    invoiceId: 'FAC-00002',
    customerName: 'Customer 2',
    amount: 100,
    paymentType: 'Espèce',
    paymentDate: new Date().toISOString(),
}, ];
const mockCompanyProfile = {
    name: "Test Shop",
    address: "Test Address",
    phone: "123456789",
    logo: null,
    invoicePrefix: "TST-",
    refundPrefix: "REF-",
    depositPrefix: "DEP-",
    invoiceFooterMessage: "Thank you!",
    lastInvoiceNumber: 3
};

// Mock Firestore onSnapshot to simulate data loading
let mockSnapshotData = {
    products: mockProducts,
    customers: mockCustomers,
    categories: mockCategories,
    payments: mockPayments,
    sales: mockSales,
    companyProfile: mockCompanyProfile
};
let mockSnapshotListeners = {};

onSnapshot.mockImplementation((q, callback) => {
    const pathSegments = q.path.split('/');
    const collectionName = pathSegments[pathSegments.length - 1];
    let data;
    if (collectionName === 'companyProfile') {
        data = mockSnapshotData.companyProfile;
    } else {
        data = mockSnapshotData[collectionName] || [];
    }

    // Simulate initial load
    const mockDocs = Array.isArray(data) ?
        data.map(item => ({
            id: item.id || 'mock-id',
            exists: () => true,
            data: () => item
        })) :
        [{
            id: 'main',
            exists: () => !!data,
            data: () => data
        }];
    const mockSnapshot = {
        docs: mockDocs,
        empty: mockDocs.length === 0,
        exists: () => !!data // for doc snapshots
    };

    // Store the callback to simulate updates later if needed
    mockSnapshotListeners[collectionName] = callback;
    callback(mockSnapshot);

    // Return an unsubscribe function
    return jest.fn();
});

// Mock authentication state
let mockAuthStateChangedCallback;
onAuthStateChanged.mockImplementation((auth, callback) => {
    mockAuthStateChangedCallback = callback;
    // Simulate authenticated user immediately
    callback({
        uid: 'u1',
        displayName: 'Test User'
    });
    return jest.fn(); // unsubscribe
});
signInAnonymously.mockResolvedValue({
    user: {
        uid: 'anon-u1',
        displayName: 'Anonymous User'
    }
});
signInWithCustomToken.mockResolvedValue({
    user: {
        uid: 'token-u1',
        displayName: 'Token User'
    }
});

// Mock Firestore CRUD operations
addDoc.mockImplementation(async (colRef, data) => {
    const newId = 'new-' + Math.random().toString(36).substr(2, 9);
    const collectionName = colRef.path.split('/').pop();
    const newItem = {
        id: newId,
        ...data
    };
    mockSnapshotData[collectionName].push(newItem);
    // Simulate snapshot update
    if (mockSnapshotListeners[collectionName]) {
        const mockDocs = mockSnapshotData[collectionName].map(item => ({
            id: item.id,
            exists: () => true,
            data: () => item
        }));
        mockSnapshotListeners[collectionName]({
            docs: mockDocs
        });
    }
    return {
        id: newId
    };
});

updateDoc.mockImplementation(async (docRef, data) => {
    const pathSegments = docRef.path.split('/');
    const collectionName = pathSegments[pathSegments.length - 2];
    const docId = pathSegments[pathSegments.length - 1];

    if (collectionName === 'companyProfile') {
        mockSnapshotData.companyProfile = { ...mockSnapshotData.companyProfile,
            ...data
        };
        if (mockSnapshotListeners.companyProfile) {
            mockSnapshotListeners.companyProfile({
                id: 'main',
                exists: () => true,
                data: () => mockSnapshotData.companyProfile
            });
        }
    } else {
        const index = mockSnapshotData[collectionName].findIndex(item => item.id === docId);
        if (index > -1) {
            mockSnapshotData[collectionName][index] = { ...mockSnapshotData[collectionName][index],
                ...data
            };
            // Simulate snapshot update
            if (mockSnapshotListeners[collectionName]) {
                const mockDocs = mockSnapshotData[collectionName].map(item => ({
                    id: item.id,
                    exists: () => true,
                    data: () => item
                }));
                mockSnapshotListeners[collectionName]({
                    docs: mockDocs
                });
            }
        }
    }
});

deleteDoc.mockImplementation(async (docRef) => {
    const pathSegments = docRef.path.split('/');
    const collectionName = pathSegments[pathSegments.length - 2];
    const docId = pathSegments[pathSegments.length - 1];
    mockSnapshotData[collectionName] = mockSnapshotData[collectionName].filter(item => item.id !== docId);
    // Simulate snapshot update
    if (mockSnapshotListeners[collectionName]) {
        const mockDocs = mockSnapshotData[collectionName].map(item => ({
            id: item.id,
            exists: () => true,
            data: () => item
        }));
        mockSnapshotListeners[collectionName]({
            docs: mockDocs
        });
    }
});

setDoc.mockImplementation(async (docRef, data, options = {}) => {
    const pathSegments = docRef.path.split('/');
    const collectionName = pathSegments[pathSegments.length - 2];
    const docId = pathSegments[pathSegments.length - 1];

    if (collectionName === 'companyProfile' && docId === 'main') {
        if (options.merge) {
            mockSnapshotData.companyProfile = { ...mockSnapshotData.companyProfile,
                ...data
            };
        } else {
            mockSnapshotData.companyProfile = data;
        }
        if (mockSnapshotListeners.companyProfile) {
            mockSnapshotListeners.companyProfile({
                id: 'main',
                exists: () => true,
                data: () => mockSnapshotData.companyProfile
            });
        }
    } else {
        // Generic setDoc implementation (can be extended if needed)
        const index = mockSnapshotData[collectionName].findIndex(item => item.id === docId);
        if (index > -1) {
            mockSnapshotData[collectionName][index] = { ...mockSnapshotData[collectionName][index],
                ...data
            };
        } else {
            mockSnapshotData[collectionName].push({
                id: docId,
                ...data
            });
        }
        if (mockSnapshotListeners[collectionName]) {
            const mockDocs = mockSnapshotData[collectionName].map(item => ({
                id: item.id,
                exists: () => true,
                data: () => item
            }));
            mockSnapshotListeners[collectionName]({
                docs: mockDocs
            });
        }
    }
});


getDoc.mockImplementation(async (docRef) => {
    const pathSegments = docRef.path.split('/');
    const collectionName = pathSegments[pathSegments.length - 2];
    const docId = pathSegments[pathSegments.length - 1];

    let item = null;
    if (collectionName === 'companyProfile' && docId === 'main') {
        item = mockSnapshotData.companyProfile;
    } else {
        item = mockSnapshotData[collectionName]?.find(item => item.id === docId);
    }

    return {
        exists: () => !!item,
        data: () => item,
        id: docId
    };
});


runTransaction.mockImplementation(async (db, updateFunction) => {
    // Simple transaction mock: execute the update function and return its result
    // Does NOT handle retries or concurrent modifications like real transactions
    const mockTransaction = {
        get: getDoc, // Use the mocked getDoc
        update: updateDoc, // Use the mocked updateDoc
        set: setDoc, // Use the mocked setDoc
        // Add other transaction methods if used (e.g., delete)
    };
    const result = await updateFunction(mockTransaction);

    // Manually trigger updates for collections modified within the transaction mock
    // This is a simplification; a real mock might track changes and trigger snapshots
    // based on reads/writes performed within the transaction logic.
    for (const collectionName in mockSnapshotListeners) {
        const mockDocs = mockSnapshotData[collectionName].map(item => ({
            id: item.id,
            exists: () => true,
            data: () => item
        }));
        mockSnapshotListeners[collectionName]({
            docs: mockDocs
        });
    }


    return result;
});


// Mock writeBatch (simplified)
writeBatch.mockImplementation(() => {
    const operations = [];
    return {
        update: (docRef, data) => operations.push({
            type: 'update',
            docRef,
            data
        }),
        set: (docRef, data) => operations.push({
            type: 'set',
            docRef,
            data
        }),
        commit: async () => {
            for (const op of operations) {
                if (op.type === 'update') {
                    await updateDoc(op.docRef, op.data);
                } else if (op.type === 'set') {
                    await setDoc(op.docRef, op.data);
                }
            }
        },
    };
});

getDocs.mockImplementation(async (q) => {
    const pathSegments = q.path.split('/');
    const collectionName = pathSegments[pathSegments.length - 1];
    let items = mockSnapshotData[collectionName] || [];

    // Apply filters (basic mocking)
    if (q._query.fieldFilters) {
        q._query.fieldFilters.forEach(filter => {
            const [field, op, value] = filter;
            if (op === '==') {
                items = items.filter(item => item[field] === value);
            }
            // Add other filter operators if needed
        });
    }

    const mockDocs = items.map(item => ({
        id: item.id,
        exists: () => true,
        data: () => item
    }));
    return {
        docs: mockDocs
    };
});


// Utility component mocks to simplify testing App's view rendering
jest.mock('./App', () => ({
    ...jest.requireActual('./App'), // Use actual implementations for utilities, forms, modals etc.
    DashboardView: jest.fn(({
        sales,
        products,
        customers,
        categories,
        productsToReorder,
        openSaleModal,
        navigate,
        handleShowInvoice,
        openModal
    }) => < div data-testid = "dashboard-view" > Dashboard View < /div>),
    ProductsView: jest.fn(({
        products,
        categories,
        openModal,
        handleDelete,
        setCart,
        openSaleModal,
        productsToReorder
    }) => < div data-testid = "products-view" > Products View < /div>),
    CategoriesView: jest.fn(({
        categories,
        openModal,
        handleDelete
    }) => < div data-testid = "categories-view" > Categories View < /div>),
    CustomersView: jest.fn(({
        customers,
        openModal,
        handleDelete,
        navigate
    }) => < div data-testid = "customers-view" > Customers View < /div>),
    CustomerDetailsView: jest.fn(({
        customerId,
        customers,
        db,
        appId,
        navigate,
        openSaleModal
    }) => < div data-testid = "customer-details-view" > Customer Details View for {
        customerId
    } < /div>),
    SalesView: jest.fn(({
        sales,
        handleShowInvoice
    }) => < div data-testid = "sales-view" > Sales View < /div>),
    DebtsView: jest.fn(({
        sales,
        openModal
    }) => < div data-testid = "debts-view" > Debts View < /div>),
    RefundsView: jest.fn(({
        payments
    }) => < div data-testid = "refunds-view" > Refunds View < /div>),
    SettingsView: jest.fn(({
        companyProfile,
        handleSaveProfile
    }) => < div data-testid = "settings-view" > Settings View < /div>),
    Modal: jest.fn(({
        children,
        onClose,
        size
    }) => < div data-testid = {
        `modal-${size}`
    } > < button onClick = {
        onClose
    } > Close Modal < /button>{children} < /div>),
    AlertModal: jest.fn(({
        message,
        onClose
    }) => < div data-testid = "alert-modal" > Alert: {
        message
    } < button onClick = {
        onClose
    } > OK < /button></div > ),
    ConfirmModal: jest.fn(({
        message,
        onConfirm,
        onClose
    }) => < div data-testid = "confirm-modal" > Confirm: {
        message
    } < button onClick = {
        onConfirm
    } > Confirm < /button><button onClick={onClose}>Cancel</button ></div > ),
    ProductForm: jest.fn(({
        onSubmit,
        initialData,
        categories,
        products,
        onClose
    }) => < form data-testid = "product-form"
        onSubmit = {
            (e) => {
                e.preventDefault();
                onSubmit(initialData || {
                    name: 'Test Product',
                    price: 100,
                    quantity: 10,
                    type: 'simple'
                });
            }
        } > < button type = "submit" > Submit Product Form < /button></form > ),
    CategoryForm: jest.fn(({
        onSubmit,
        initialData,
        categories,
        onClose
    }) => < form data-testid = "category-form"
        onSubmit = {
            (e) => {
                e.preventDefault();
                onSubmit(initialData || {
                    name: 'Test Category'
                });
            }
        } > < button type = "submit" > Submit Category Form < /button></form > ),
    CustomerForm: jest.fn(({
        onSubmit,
        initialData,
        onClose,
        onSuccess
    }) => < form data-testid = "customer-form"
        onSubmit = {
            (e) => {
                e.preventDefault();
                onSubmit(initialData || {
                    name: 'Test Customer'
                });
            }
        } > < button type = "submit" > Submit Customer Form < /button></form > ),
    SaleForm: jest.fn(({
        onSubmit,
        customers,
        onClose,
        cart,
        setCart,
        preselectedCustomerId,
        openModal
    }) => {
        const handleSubmit = (e) => {
            e.preventDefault();
            onSubmit({
                customerId: preselectedCustomerId || (customers.length > 0 ? customers[0].id : 'mock-c-id'),
                paymentType: 'Espèce',
                items: cart,
                totalPrice: cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
                discountAmount: 0,
                vatAmount: 0
            });
        };
        return ( < form data-testid = "sale-form"
            onSubmit = {
                handleSubmit
            } > < button type = "submit" > Submit Sale Form < /button></form > );
    }),
    PaymentForm: jest.fn(({
        onSubmit,
        sale,
        customers,
        onClose
    }) => < form data-testid = "payment-form"
        onSubmit = {
            (e) => {
                e.preventDefault();
                onSubmit(100, 'Espèce');
            }
        } > < button type = "submit" > Submit Payment Form < /button></form > ),
    DepositForm: jest.fn(({
        customer,
        onSubmit,
        onClose
    }) => < form data-testid = "deposit-form"
        onSubmit = {
            (e) => {
                e.preventDefault();
                onSubmit(100);
            }
        } > < button type = "submit" > Submit Deposit Form < /button></form > ),
    Invoice: jest.fn(({
        sale,
        products,
        companyProfile,
        onClose,
        showAlert
    }) => < div data-testid = "invoice-modal" > Invoice < /div>),
    PaymentReceipt: jest.fn(({
        receiptData,
        onClose,
        showAlert
    }) => < div data-testid = "payment-receipt-modal" > Payment Receipt < /div>),
    DepositReceipt: jest.fn(({
        receiptData,
        onClose,
        showAlert
    }) => < div data-testid = "deposit-receipt-modal" > Deposit Receipt < /div>),
    NavItem: jest.fn(({
        icon,
        label,
        active,
        onClick
    }) => < button data-testid = {
        `nav-item-${label.toLowerCase().replace(/\s+/g, '-')}`
    }
        onClick = {
            onClick
        } > {
            label
        } < /button>),
    StatusBadge: jest.fn(({
        status
    }) => < span data-testid = {
        `status-badge-${status}`
    } > {
        status
    } < /span>),
}));


describe('Utility Functions', () => {
    describe('formatCurrency', () => {
        test('should format number correctly', () => {
            expect(formatCurrency(1234567.89)).toBe('1 234 568 F CFA');
            expect(formatCurrency(1000)).toBe('1 000 F CFA');
            expect(formatCurrency(0)).toBe('0 F CFA');
            expect(formatCurrency('abc')).toBe('0 F CFA');
            expect(formatCurrency(null)).toBe('0 F CFA');
            expect(formatCurrency(undefined)).toBe('0 F CFA');
        });
    });

    describe('formatDateTime', () => {
        test('should format ISO string correctly', () => {
            const isoString = '2023-10-27T10:30:00.000Z';
            const date = new Date(isoString);
            const expected = new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }).format(date);
            expect(formatDateTime(isoString)).toBe(expected);
        });

        test('should return N/A for null or undefined', () => {
            expect(formatDateTime(null)).toBe('N/A');
            expect(formatDateTime(undefined)).toBe('N/A');
            expect(formatDateTime('')).toBe('N/A');
        });
    });

    describe('formatDate', () => {
        test('should format ISO string correctly', () => {
            const isoString = '2023-10-27T10:30:00.000Z';
            const date = new Date(isoString);
            const expected = new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(date);
            expect(formatDate(isoString)).toBe(expected);
        });

        test('should return N/A for null or undefined', () => {
            expect(formatDate(null)).toBe('N/A');
            expect(formatDate(undefined)).toBe('N/A');
            expect(formatDate('')).toBe('N/A');
        });
    });

    describe('toInputDate', () => {
        test('should format Date object or string to YYYY-MM-DD for input type="date"', () => {
            const date = new Date('2023-10-27T10:30:00.000Z');
            expect(toInputDate(date)).toBe('2023-10-27');
            expect(toInputDate('2023-11-05')).toBe('2023-11-05'); // Test with string parsing
        });

        test('should return empty string for null or undefined', () => {
            expect(toInputDate(null)).toBe('');
            expect(toInputDate(undefined)).toBe('');
            expect(toInputDate('')).toBe('');
        });
    });

    describe('resizeImage', () => {
        // This function is hard to test without a real DOM and canvas.
        // Mocking the necessary browser APIs is done globally.
        test('should resolve with data URL', async () => {
            const file = new File(['dummy'], 'test.png', {
                type: 'image/png'
            });
            const result = await resizeImage(file, 100, 100);
            expect(result).toBe('data:image/jpeg;base64,resized');
        });
    });
});

describe('App Component', () => {
    beforeEach(() => {
        // Reset mock data before each test
        mockSnapshotData = {
            products: [{
                id: 'p1',
                name: 'Product 1',
                price: 100,
                quantity: 10,
                type: 'simple',
                reorderThreshold: 2
            }, {
                id: 'p2',
                name: 'Product 2 (Variant)',
                basePrice: 200,
                type: 'variant',
                variants: [{
                    id: 'v1',
                    name: 'Small',
                    priceModifier: -10,
                    quantity: 5,
                    reorderThreshold: 1
                }, {
                    id: 'v2',
                    name: 'Large',
                    priceModifier: 20,
                    quantity: 3,
                    reorderThreshold: 1
                }]
            }, {
                id: 'p3',
                name: 'Product 3 (Pack)',
                price: 300,
                type: 'pack',
                packItems: [{
                    productId: 'p1',
                    quantity: 2,
                    name: 'Product 1'
                }],
                quantity: 0
            }, {
                id: 'p4',
                name: 'Low Stock Product',
                price: 50,
                quantity: 1,
                type: 'simple',
                reorderThreshold: 5
            }, ],
            customers: [{
                id: 'c1',
                name: 'Customer 1',
                balance: 500
            }, {
                id: 'c2',
                name: 'Customer 2',
                balance: 0
            }, ],
            categories: [{
                id: 'cat1',
                name: 'Category 1'
            }, {
                id: 'subcat1',
                name: 'Subcategory 1',
                parentId: 'cat1'
            }, ],
            sales: [{
                id: 's1',
                invoiceId: 'FAC-00001',
                customerId: 'c1',
                customerName: 'Customer 1',
                paymentType: 'Espèce',
                items: