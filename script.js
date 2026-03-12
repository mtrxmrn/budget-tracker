// Budget Tracker application state and helpers.

// ----------------------------------
// Global state
// ----------------------------------
let budgetData = { first: [], second: [] };
let salaryData = { first: 0, second: 0 };
let previousBalanceData = { first: 0, second: 0 };
let currentFilter = null;
let presets = {};
let currentEditingPreset = 1;
let currentPresetSlot = 1;
let currentModal = { editRow: null, editTable: null, expenseRow: null, expenseTable: null };
let expenseDatePicker = null;
let presetChartEventsBound = false;
let presetSortablesInitialized = false;
const STORAGE_SCHEMA_VERSION = 3;
const CURRENCY_SYMBOL = '\u20B1';
const CATEGORY_TYPES = ['essential', 'lifestyle', 'sinking', 'savings', 'investing', 'debt'];
const DEFAULT_ALLOCATION_TARGETS = {
    essentials: 50,
    savings: 15,
    investing: 10,
    debt: 10,
    sinking: 10,
    lifestyle: 5
};
const DEFAULT_CATEGORY_CAPS = {
    lifestyle: 20,
    debt: 20,
    essentials: 60
};
const ADVISOR_CONFIG_STORAGE_KEY = 'budgetTrackerAdvisorConfig';
const PRESET_AVG_NET_PAY_STORAGE_KEY = 'budgetTrackerPresetAverageNetPayPerCutoff';
let allocationTargets = { ...DEFAULT_ALLOCATION_TARGETS };
let categoryCaps = { ...DEFAULT_CATEGORY_CAPS };

// ----------------------------------
// Shared formatting and normalization
// ----------------------------------
function toPercentValue(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(100, parsed));
}

function loadAdvisorConfig() {
    allocationTargets = { ...DEFAULT_ALLOCATION_TARGETS };
    categoryCaps = { ...DEFAULT_CATEGORY_CAPS };

    try {
        const raw = localStorage.getItem(ADVISOR_CONFIG_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        const targets = parsed && parsed.targets ? parsed.targets : {};
        const caps = parsed && parsed.caps ? parsed.caps : {};

        Object.keys(DEFAULT_ALLOCATION_TARGETS).forEach(key => {
            allocationTargets[key] = toPercentValue(targets[key], DEFAULT_ALLOCATION_TARGETS[key]);
        });
        Object.keys(DEFAULT_CATEGORY_CAPS).forEach(key => {
            categoryCaps[key] = toPercentValue(caps[key], DEFAULT_CATEGORY_CAPS[key]);
        });
    } catch (error) {
        console.error('Error loading advisor configuration:', error);
    }
}

function formatCurrency(value) {
    return `${CURRENCY_SYMBOL}${(Number(value) || 0).toFixed(2)}`;
}

function formatPhpCurrency(value) {
    return `PHP ${(Number(value) || 0).toFixed(2)}`;
}

function sumExpenses(item) {
    if (!item || !Array.isArray(item.expenses)) return 0;
    return item.expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
}

function inferCategoryType(categoryName = '') {
    const text = categoryName.toLowerCase();
    if (text.includes('rent') || text.includes('mortgage') || text.includes('utility') || text.includes('insurance')) return 'essential';
    if (text.includes('saving')) return 'savings';
    if (text.includes('invest')) return 'investing';
    if (text.includes('debt') || text.includes('loan') || text.includes('credit')) return 'debt';
    if (text.includes('emergency') || text.includes('repair') || text.includes('gift') || text.includes('maintenance')) return 'sinking';
    if (text.includes('entertainment') || text.includes('dining') || text.includes('shopping') || text.includes('leisure')) return 'lifestyle';
    return 'essential';
}

function formatCategoryTypeLabel(type) {
    const labels = {
        essential: 'Essential',
        lifestyle: 'Lifestyle',
        sinking: 'Sinking Fund',
        savings: 'Savings',
        investing: 'Investing',
        debt: 'Debt'
    };
    return labels[type] || 'Essential';
}

function getTypeColor(type) {
    const colors = {
        essential: '#2563eb',
        lifestyle: '#f97316',
        sinking: '#14b8a6',
        savings: '#16a34a',
        investing: '#8b5cf6',
        debt: '#dc2626'
    };
    return colors[type] || '#64748b';
}

function getPresetAverageNetPay() {
    const input = document.getElementById('presetAverageNetPay');
    const value = Number(input ? input.value : 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function loadPresetAverageNetPayField() {
    const input = document.getElementById('presetAverageNetPay');
    if (!input) return;
    const raw = localStorage.getItem(PRESET_AVG_NET_PAY_STORAGE_KEY);
    const value = Number(raw);
    input.value = Number.isFinite(value) && value > 0 ? String(value) : '';
}

function savePresetAverageNetPayField() {
    const input = document.getElementById('presetAverageNetPay');
    if (!input) return;
    const value = Number(input.value);
    if (Number.isFinite(value) && value > 0) {
        localStorage.setItem(PRESET_AVG_NET_PAY_STORAGE_KEY, String(value));
    } else {
        localStorage.removeItem(PRESET_AVG_NET_PAY_STORAGE_KEY);
    }
}

function buildTypeOptions(selectedType = 'essential') {
    const safeType = CATEGORY_TYPES.includes(selectedType) ? selectedType : 'essential';
    return CATEGORY_TYPES.map(type => {
        const selected = type === safeType ? 'selected' : '';
        return `<option value="${type}" ${selected}>${formatCategoryTypeLabel(type)}</option>`;
    }).join('');
}

function mapTypeToAllocationGroup(type) {
    if (type === 'fixed' || type === 'essential') return 'essentials';
    if (type === 'savings') return 'savings';
    if (type === 'investing') return 'investing';
    if (type === 'debt') return 'debt';
    if (type === 'sinking') return 'sinking';
    return 'lifestyle';
}

function normalizeExpense(expense = {}) {
    return {
        description: (expense.description || '').toString(),
        date: expense.date || '',
        amount: Number(expense.amount) || 0
    };
}

function normalizeBudgetItem(item = {}) {
    const normalized = {
        id: item.id || generateId(),
        category: (item.category || '').toString(),
        date: item.date || '',
        budget: Number(item.budget) || 0,
        expenses: Array.isArray(item.expenses) ? item.expenses.map(normalizeExpense) : [],
        type: CATEGORY_TYPES.includes(item.type) ? item.type : inferCategoryType(item.category),
        paid: Boolean(item.paid),
        paidAt: item.paidAt || ''
    };

    if (Array.isArray(item.prePaidExpenses)) {
        normalized.prePaidExpenses = item.prePaidExpenses.map(normalizeExpense);
    }
    if (item.advancedSourceCutoff) normalized.advancedSourceCutoff = item.advancedSourceCutoff;
    if (item.advancedFromCategory) normalized.advancedFromCategory = item.advancedFromCategory;
    if (Number.isFinite(Number(item.advancedAmount))) normalized.advancedAmount = Number(item.advancedAmount) || 0;
    if (item.advancedAt) normalized.advancedAt = item.advancedAt;

    return normalized;
}

function normalizeMonthPayload(rawPayload, monthHint = null) {
    const rawData = rawPayload && rawPayload.data ? rawPayload.data : rawPayload;
    const fallbackDate = monthHint ? `${monthHint}-01` : '';
    const normalizeWithFallbackDate = (item = {}) => {
        const normalized = normalizeBudgetItem(item);
        if (!normalized.date && fallbackDate) {
            normalized.date = fallbackDate;
        }
        return normalized;
    };

    return {
        first: Array.isArray(rawData?.first) ? rawData.first.map(normalizeWithFallbackDate) : [],
        second: Array.isArray(rawData?.second) ? rawData.second.map(normalizeWithFallbackDate) : []
    };
}

function getTrackerStorageKeys() {
    return Object.keys(localStorage).filter(key => key && key.startsWith('budgetTracker'));
}

function clearTrackerStorage(keysToKeep = []) {
    const keep = new Set(keysToKeep.filter(Boolean));
    getTrackerStorageKeys().forEach(key => {
        if (!keep.has(key)) {
            localStorage.removeItem(key);
        }
    });
}

// Helper function to format date as "24-Thursday"
function formatDayWeekday(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const day = date.getDate();
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekday = weekdays[date.getDay()];
        return `${day}-${weekday}`;
    } catch (error) {
        console.error('Date formatting error:', error, 'for date:', dateString);
        return dateString; // fallback to original if parsing fails
    }
}

// ----------------------------------
// Application lifecycle
// ----------------------------------
document.addEventListener('DOMContentLoaded', function() {
    initializePresets();
    // Load settings first so currentFilter is restored before loading month-specific data
    loadSettings();
    loadAdvisorConfig();
    loadData();
    loadSalaries();
    initializeTables();
    setupEventHandlers();
    initializeExpenseDatePicker();
    initializeDarkMode();

    // Keep the advisor panel in sync across tabs/windows.
    window.addEventListener('storage', function(event) {
        if (event.key !== ADVISOR_CONFIG_STORAGE_KEY) return;
        loadAdvisorConfig();
        updateFinancialDashboard();
    });
});

function initializeTables() {
    const hasStoredMonthData = getAllMonthStorageKeys().length > 0;
    const hasExistingData = (budgetData.first && budgetData.first.length > 0) || 
                           (budgetData.second && budgetData.second.length > 0);
    
    if (!hasExistingData && !hasStoredMonthData) {
        budgetData.first = [
            { id: generateId(), category: 'Groceries', date: '2025-07-01', budget: 500, type: 'essential', expenses: [
                { description: 'Weekly shopping', date: '2025-07-20', amount: 120 },
                { description: 'Fruits and vegetables', date: '2025-07-22', amount: 45 }
            ]},
            { id: generateId(), category: 'Transportation', date: '2025-07-01', budget: 200, type: 'essential', expenses: [
                { description: 'Gas', date: '2025-07-21', amount: 60 }
            ]}
        ];
        
        budgetData.second = [
            { id: generateId(), category: 'Entertainment', date: '2025-07-01', budget: 300, type: 'lifestyle', expenses: [
                { description: 'Movie tickets', date: '2025-07-19', amount: 25 }
            ]},
            { id: generateId(), category: 'Utilities', date: '2025-07-01', budget: 150, type: 'essential', expenses: [] }
        ];
        
        // Save the sample data
        saveData();
    } else {
    }

    renderBothTables();
    initializeDragAndDrop();
}

// ----------------------------------
// Date handling
// ----------------------------------
function formatDateMMDDYYYY(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${month}/${day}/${year}`;
}

function getTodayMMDDYYYYUtcPlus8() {
    // Use UTC+8 calendar date regardless of local machine timezone.
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const utcPlus8 = new Date(utcMs + (8 * 60 * 60000));
    return formatDateMMDDYYYY(utcPlus8);
}

function normalizeExpenseDateInput(value) {
    const raw = (value || '').toString().trim();
    if (!raw) return getTodayMMDDYYYYUtcPlus8();

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(raw)) {
        const [m, d, yy] = raw.split('/');
        return `${m}/${d}/20${yy}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const parsed = new Date(`${raw}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) return formatDateMMDDYYYY(parsed);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return formatDateMMDDYYYY(parsed);
    return getTodayMMDDYYYYUtcPlus8();
}

function initializeExpenseDatePicker() {
    const dateInput = document.getElementById('expenseDate');
    if (!dateInput || typeof Litepicker === 'undefined') {
        setExpenseDateToToday();
        return;
    }

    expenseDatePicker = new Litepicker({
        element: dateInput,
        singleMode: true,
        autoApply: true,
        allowRepick: true,
        format: 'MM/DD/YYYY',
        numberOfMonths: 1,
        numberOfColumns: 1,
        dropdowns: {
            minYear: 2020,
            maxYear: 2035,
            months: true,
            years: true
        }
    });

    setExpenseDateToToday();
}

function setExpenseDateToToday() {
    const dateInput = document.getElementById('expenseDate');
    if (!dateInput) return;
    const today = getTodayMMDDYYYYUtcPlus8();
    dateInput.value = today;
    if (expenseDatePicker) {
        expenseDatePicker.setDate(today);
    }
}

function setExpenseDateValue(dateValue) {
    const dateInput = document.getElementById('expenseDate');
    if (!dateInput) return;
    const safeDate = normalizeExpenseDateInput(dateValue);
    dateInput.value = safeDate;
    if (expenseDatePicker) {
        expenseDatePicker.setDate(safeDate);
    }
}

function addSampleData() {
    budgetData.first = [
        { id: generateId(), category: 'Groceries', budget: 500, type: 'essential', expenses: [
            { description: 'Weekly shopping', amount: 120 },
            { description: 'Fruits and vegetables', amount: 45 }
        ]},
        { id: generateId(), category: 'Transportation', budget: 200, type: 'essential', expenses: [
            { description: 'Gas', amount: 60 }
        ]}
    ];
    
    budgetData.second = [
        { id: generateId(), category: 'Entertainment', budget: 300, type: 'lifestyle', expenses: [
            { description: 'Movie tickets', amount: 25 }
        ]},
        { id: generateId(), category: 'Utilities', budget: 150, type: 'essential', expenses: [] }
    ];
}

// ----------------------------------
// Table rendering
// ----------------------------------
function renderBothTables() {
    renderTable('first');
    renderTable('second');
}

function getTableDataForView(tableType) {
    if (!currentFilter) return budgetData[tableType];
    return budgetData[tableType].filter(item => {
        if (!item.date) return false;
        return item.date.substring(0, 7) === currentFilter;
    });
}

function renderTable(tableType) {
    const tbody = document.getElementById(tableType + 'CutoffBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Filter data by month if a filter is active
    const dataToRender = getTableDataForView(tableType);
    dataToRender.forEach(item => {
        const row = createTableRow(item, tableType);
        tbody.appendChild(row);
    });
    updateTotals(tableType, dataToRender);
}

function createTableRow(item, tableType) {
    const row = document.createElement('tr');
    row.className = 'category-card';
    row.dataset.id = item.id;

    const totalSpent   = sumExpenses(item);
    const variance     = item.budget - totalSpent;
    const budgetPct    = item.budget > 0 ? (totalSpent / item.budget) * 100 : 0;
    const isPaid       = Boolean(item.paid);
    const resolvedType = CATEGORY_TYPES.includes(item.type) ? item.type : inferCategoryType(item.category);
    const isAdvanced   = Boolean(item.advancedSourceCutoff);
    const advLabel     = item.advancedSourceCutoff === 'first' ? '1st' : '2nd';
    const typeLabel    = formatCategoryTypeLabel(resolvedType);

    // Status
    let cardStatus  = '';
    let spentCls    = '';

    if (budgetPct > 0 && budgetPct < 80) {
        cardStatus  = 'budget-safe';
        spentCls    = 'spent-safe';
    } else if (budgetPct >= 80 && budgetPct < 100) {
        cardStatus  = 'budget-warning';
        spentCls    = 'spent-warning';
    } else if (Math.abs(budgetPct - 100) < 0.01) {
        cardStatus  = 'budget-exact';
        spentCls    = 'spent-exact';
    } else if (budgetPct > 100) {
        cardStatus  = 'budget-over';
        spentCls    = 'spent-over';
    }

    if (cardStatus) row.classList.add(cardStatus);
    if (isAdvanced) row.classList.add('advanced-row');

    const varSign   = variance >= 0 ? '+' : '\u2212';
    const varianceText = `${varSign}${formatCurrency(Math.abs(variance))}`;
    const paidClass = isPaid ? 'paid-toggle-btn unpaid-btn' : 'paid-toggle-btn';
    const paidLabel = isPaid ? 'Unpaid' : 'Paid';

    row.innerHTML = `
        <td class="col-h-drag"><span class="card-drag drag-handle">::</span></td>
        <td class="col-h-name">
            <span class="card-name" title="${item.category}">${item.category}</span>
        </td>
        <td class="col-h-type">
            <span class="type-chip ${resolvedType}">${typeLabel}</span>
            <span class="card-advanced-slot">
                ${isAdvanced ? `<span class="category-advanced-chip">Adv.${advLabel}</span>` : ''}
            </span>
        </td>
        <td class="col-h-budget"><span class="card-budget">${formatCurrency(item.budget)}</span></td>
        <td class="col-h-spent">
            <span class="card-spent-wrap">
                <span class="card-spent ${spentCls}">${formatCurrency(totalSpent)}</span>
                <span class="card-variance-info kpi-info" data-tip="Variance: ${varianceText}" tabindex="0">i</span>
            </span>
        </td>
        <td class="col-h-actions">
            <div class="card-actions">
                <button class="action-btn edit-btn" onclick="editRow('${item.id}', '${tableType}')">Edit</button>
                <div class="action-more-wrap">
                    <button class="action-btn more-btn" type="button" onclick="toggleMoreMenu(event, this)">&#8943;</button>
                    <div class="action-more-menu">
                        <button class="action-btn ${paidClass}" onclick="markAsPaid('${item.id}', '${tableType}')">${paidLabel}</button>
                        <button class="action-btn advance-btn" onclick="advancePayment('${item.id}', '${tableType}')">Advance</button>
                        <button class="action-btn delete-btn" onclick="deleteRow('${item.id}', '${tableType}')">Delete</button>
                    </div>
                </div>
            </div>
        </td>
    `;

    row.addEventListener('click', function(event) {
        if (event.target.closest('.card-actions')) return;
        if (event.target.closest('.card-variance-info')) return;
        openExpenseModal(item.id, tableType);
    });

    return row;
}
// ----------------------------------
// Category management
// ----------------------------------
function addRow(tableType) {
    // Use filtered month if active, otherwise use today's date
    let defaultDate;
    if (currentFilter) {
        // If filtering by month, use the first day of that month
        defaultDate = currentFilter + '-01';
    } else {
        // Use today's date
        defaultDate = new Date().toISOString().split('T')[0];
    }
    
    const newItem = { id: generateId(), category: 'New Category', date: defaultDate, budget: 0, expenses: [], type: 'essential', paid: false, paidAt: '' };
    budgetData[tableType].push(newItem);
    renderTable(tableType);
    saveData();
    editRow(newItem.id, tableType);
}

function editRow(id, tableType) {
    const item = budgetData[tableType].find(item => item.id === id);
    if (!item) return;
    
    currentModal.editRow = id;
    currentModal.editTable = tableType;
    document.getElementById('editCategory').value = item.category;
    document.getElementById('editBudget').value = item.budget;
    document.getElementById('editType').value = item.type || inferCategoryType(item.category);
    document.getElementById('editModal').style.display = 'block';
}

function saveEdit() {
    const category = document.getElementById('editCategory').value.trim();
    const budget = parseFloat(document.getElementById('editBudget').value) || 0;
    const type = document.getElementById('editType').value;
    
    if (!category) {
        alert('Please enter a category name.');
        return;
    }

    if (budget < 0) {
        alert('Budget cannot be negative.');
        return;
    }
    
    const item = budgetData[currentModal.editTable].find(item => item.id === currentModal.editRow);
    if (item) {
        item.category = category;
        item.budget = budget;
        item.type = CATEGORY_TYPES.includes(type) ? type : inferCategoryType(category);
        renderTable(currentModal.editTable);
        saveData();
    }
    closeEditModal();
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentModal.editRow = null;
    currentModal.editTable = null;
}

function deleteRow(id, tableType) {
    if (confirm('Are you sure you want to delete this category?')) {
        budgetData[tableType] = budgetData[tableType].filter(item => item.id !== id);
        renderTable(tableType);
        saveData();
    }
}

// ----------------------------------
// Payment state and expense handling
// ----------------------------------
function getBudgetItemMonth(item) {
    if (item && item.date) return item.date.substring(0, 7);
    return currentFilter || getCurrentMonth();
}

function normalizeCategoryKey(name = '') {
    return name.toString().trim().toLowerCase();
}

function setItemPaidState(item, isPaid) {
    if (!item) return;
    delete item.advancedSourceCutoff;
    delete item.advancedFromCategory;
    delete item.advancedAmount;
    delete item.advancedAt;

    if (!isPaid) {
        item.expenses = Array.isArray(item.prePaidExpenses) ? item.prePaidExpenses.map(normalizeExpense) : [];
        item.paid = false;
        item.paidAt = '';
        delete item.prePaidExpenses;
        return;
    }

    const paidDate = item.date || new Date().toISOString().split('T')[0];
    const paidAmount = parseFloat(item.budget) || 0;
    item.prePaidExpenses = Array.isArray(item.expenses) ? item.expenses.map(normalizeExpense) : [];
    item.expenses = [{
        description: item.category,
        date: paidDate,
        amount: paidAmount
    }];
    item.paid = true;
    item.paidAt = new Date().toISOString();
}

function clearAdvancedFlags(item) {
    if (!item) return;
    delete item.advancedSourceCutoff;
    delete item.advancedFromCategory;
    delete item.advancedAmount;
    delete item.advancedAt;
}

function revertAdvancedCounterpartForSource(sourceItem, sourceTableType) {
    if (!sourceItem) return;
    const counterpartTable = sourceTableType === 'first' ? 'second' : 'first';
    const month = getBudgetItemMonth(sourceItem);
    const sourceCategoryKey = normalizeCategoryKey(sourceItem.category);

    const counterpart = budgetData[counterpartTable].find(entry =>
        getBudgetItemMonth(entry) === month &&
        normalizeCategoryKey(entry.category) === sourceCategoryKey &&
        entry.advancedSourceCutoff === sourceTableType
    );

    if (!counterpart) return;

    const originalBudget = Number(counterpart.advancedAmount) || 0;
    counterpart.budget = originalBudget;
    clearAdvancedFlags(counterpart);
}

function markAsPaid(id, tableType) {
    const item = budgetData[tableType].find(entry => entry.id === id);
    if (!item) return;
    if (item.paid) {
        revertAdvancedCounterpartForSource(item, tableType);
    }
    setItemPaidState(item, !item.paid);

    renderBothTables();
    saveData();
}

function advancePayment(id, tableType) {
    const sourceItem = budgetData[tableType].find(entry => entry.id === id);
    if (!sourceItem) return;

    setItemPaidState(sourceItem, true);

    const month = getBudgetItemMonth(sourceItem);
    const counterpartTable = tableType === 'first' ? 'second' : 'first';
    const sourceCategoryKey = normalizeCategoryKey(sourceItem.category);
    const counterpart = budgetData[counterpartTable].find(entry => {
        return (
            getBudgetItemMonth(entry) === month &&
            normalizeCategoryKey(entry.category) === sourceCategoryKey
        );
    });

    if (counterpart) {
        const previousBudget = Number(counterpart.budget) || 0;
        counterpart.budget = 0;
        if (counterpart.paid) {
            setItemPaidState(counterpart, false);
        }
        counterpart.advancedSourceCutoff = tableType;
        counterpart.advancedFromCategory = sourceItem.category;
        counterpart.advancedAmount = previousBudget;
        counterpart.advancedAt = new Date().toISOString();
    }

    renderBothTables();
    saveData();
}

// Row reordering functions
function moveRowUp(id, tableType) {
    const items = budgetData[tableType];
    const currentIndex = items.findIndex(item => item.id === id);
    
    if (currentIndex > 0) {
        // Swap with the item above
        [items[currentIndex - 1], items[currentIndex]] = [items[currentIndex], items[currentIndex - 1]];
        renderTable(tableType);
        saveData();
    }
}

function moveRowDown(id, tableType) {
    const items = budgetData[tableType];
    const currentIndex = items.findIndex(item => item.id === id);
    
    if (currentIndex >= 0 && currentIndex < items.length - 1) {
        // Swap with the item below
        [items[currentIndex], items[currentIndex + 1]] = [items[currentIndex + 1], items[currentIndex]];
        renderTable(tableType);
        saveData();
    }
}

// Expense management
function openExpenseModal(id, tableType) {
    const item = budgetData[tableType].find(item => item.id === id);
    if (!item) return;
    
    currentModal.expenseRow = id;
    currentModal.expenseTable = tableType;
    document.getElementById('modalTitle').textContent = `Expense Breakdown - ${item.category}`;
    renderExpenseList(item.expenses);
    document.getElementById('expenseModal').style.display = 'block';
    setExpenseDateToToday();
}

function renderExpenseList(expenses) {
    const expenseList = document.getElementById('expenseList');
    
    if (expenses.length === 0) {
        expenseList.innerHTML = '<p class="expense-empty-state">No expenses recorded yet.</p>';
        return;
    }
    
    expenseList.innerHTML = expenses.map((expense, index) => `
        <div class="expense-item">
            <div class="expense-details">
                <span class="expense-description">${expense.description}</span>
                ${expense.date ? `<span class="expense-date">${formatDayWeekday(expense.date)}</span>` : ''}
            </div>
            <span class="expense-amount">${formatCurrency(expense.amount)}</span>
            <div class="expense-buttons">
                <button class="edit-expense-btn" onclick="editExpense(${index})" title="Edit expense">Edit</button>
                <button class="delete-expense-btn" onclick="deleteExpense(${index})" title="Delete expense">Del</button>
            </div>
        </div>
    `).join('');
}

function addExpense() {
    // Check if we're in edit mode
    if (currentModal.editingExpenseIndex !== undefined) {
        updateExpense();
        return;
    }
    
    const description = document.getElementById('expenseDescription').value.trim();
    const date = normalizeExpenseDateInput(document.getElementById('expenseDate').value);
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    
    if (!description || amount <= 0) {
        alert('Please enter a valid description and amount.');
        return;
    }
    
    const item = budgetData[currentModal.expenseTable].find(item => item.id === currentModal.expenseRow);
    if (item) {
        item.expenses.push({ description, date, amount });
        item.paid = false;
        item.paidAt = '';
        delete item.prePaidExpenses;
        renderExpenseList(item.expenses);
        renderTable(currentModal.expenseTable);
        saveData();
        
        document.getElementById('expenseDescription').value = '';
        setExpenseDateToToday();
        document.getElementById('expenseAmount').value = '';
    }
}

function editExpense(index) {
    const item = budgetData[currentModal.expenseTable].find(item => item.id === currentModal.expenseRow);
    if (item && item.expenses[index]) {
        const expense = item.expenses[index];
        
        // Pre-fill the form with current expense data
        document.getElementById('expenseDescription').value = expense.description || '';
        setExpenseDateValue(expense.date);
        document.getElementById('expenseAmount').value = expense.amount || '';
        
        // Store the index being edited
        currentModal.editingExpenseIndex = index;
        
        // Change the Add button text to Update
        const addButton = document.querySelector('.add-expense-form button');
        addButton.innerHTML = 'Update';
        
        // Scroll to the form
        document.querySelector('.add-expense-form').scrollIntoView({ behavior: 'smooth' });
    }
}

function updateExpense() {
    const description = document.getElementById('expenseDescription').value.trim();
    const date = normalizeExpenseDateInput(document.getElementById('expenseDate').value);
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    
    if (!description || amount <= 0) {
        alert('Please enter a valid description and amount.');
        return;
    }
    
    const item = budgetData[currentModal.expenseTable].find(item => item.id === currentModal.expenseRow);
    const index = currentModal.editingExpenseIndex;
    
    if (item && item.expenses[index] !== undefined) {
        // Update the expense
        item.expenses[index] = { description, date, amount };
        item.paid = false;
        item.paidAt = '';
        delete item.prePaidExpenses;
        
        // Reset form and button
        document.getElementById('expenseDescription').value = '';
        setExpenseDateToToday();
        document.getElementById('expenseAmount').value = '';
        
        // Reset button back to Add
        const addButton = document.querySelector('.add-expense-form button');
        addButton.innerHTML = '<i class="fas fa-plus"></i> Add';
        
        // Clear editing state
        delete currentModal.editingExpenseIndex;
        
        // Refresh displays
        renderExpenseList(item.expenses);
        renderTable(currentModal.expenseTable);
        saveData();
    }
}

function deleteExpense(index) {
    if (confirm('Are you sure you want to delete this expense?')) {
        const item = budgetData[currentModal.expenseTable].find(item => item.id === currentModal.expenseRow);
        if (item) {
            item.expenses.splice(index, 1);
            item.paid = false;
            item.paidAt = '';
            delete item.prePaidExpenses;
            renderExpenseList(item.expenses);
            renderTable(currentModal.expenseTable);
            saveData();
        }
    }
}

function closeModal() {
    document.getElementById('expenseModal').style.display = 'none';
    
    // Reset form
    document.getElementById('expenseDescription').value = '';
    setExpenseDateToToday();
    document.getElementById('expenseAmount').value = '';
    
    // Reset button back to Add if it was in edit mode
    const addButton = document.querySelector('.add-expense-form button');
    if (addButton) {
        addButton.innerHTML = '<i class="fas fa-plus"></i> Add';
    }
    
    // Clear modal state
    currentModal.expenseRow = null;
    currentModal.expenseTable = null;
    delete currentModal.editingExpenseIndex;
}

// ----------------------------------
// Calculations and dashboard updates
// ----------------------------------
function updateTotals(tableType, filteredData = null) {
    const data = filteredData || budgetData[tableType];
    const totalBudget = data.reduce((sum, item) => sum + item.budget, 0);
    const totalSpent = data.reduce((sum, item) => {
        return sum + sumExpenses(item);
    }, 0);

    const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    document.getElementById(tableType + 'TotalBudget').textContent = formatCurrency(totalBudget);

    const spentElement = document.getElementById(tableType + 'TotalSpent');
    const spentClasses = ['spent-safe', 'spent-warning', 'spent-exact', 'spent-over', 'spent-over-budget'];
    spentClasses.forEach(cls => spentElement.classList.remove(cls));

    let spentClass = '';

    if (totalPercentage > 0 && totalPercentage < 80) {
        spentClass = 'spent-safe';
    } else if (totalPercentage >= 80 && totalPercentage < 100) {
        spentClass = 'spent-warning';
    } else if (Math.abs(totalPercentage - 100) < 0.01) {
        spentClass = 'spent-exact';
    } else if (totalPercentage > 100) {
        spentClass = 'spent-over';
    }

    if (spentClass) spentElement.classList.add(spentClass);

    spentElement.textContent = formatCurrency(totalSpent);

    const totalAvailable = parseFloat(salaryData[tableType]) || 0;

    const totalAvailableElement = document.getElementById(tableType + 'TotalAvailable');
    if (totalAvailableElement) {
        totalAvailableElement.textContent = formatCurrency(totalAvailable);
    }

    const remaining = totalAvailable - totalSpent;
    const remainingElement = document.getElementById(tableType + 'SalaryRemaining');

    if (remainingElement) {
        remainingElement.textContent = formatCurrency(remaining);
        remainingElement.className = remaining < 0 ? 'remaining negative' : 'remaining';
    }

    updateTotalSummary();
    updateFinancialDashboard();
}

function getAllVisibleItems() {
    const firstItems = getTableDataForView('first');
    const secondItems = getTableDataForView('second');
    return firstItems.concat(secondItems);
}

function getTotalAvailableMoney() {
    return (parseFloat(salaryData.first) || 0) + (parseFloat(salaryData.second) || 0);
}

function getPreviousMonth(monthStr) {
    if (!monthStr) return null;
    const [y, m] = monthStr.split('-').map(Number);
    if (!y || !m) return null;
    const d = new Date(y, m - 2, 1);
    const py = d.getFullYear();
    const pm = String(d.getMonth() + 1).padStart(2, '0');
    return `${py}-${pm}`;
}

function calculateMonthRollover(monthStr) {
    if (!monthStr) return 0;

    const monthDataRaw = localStorage.getItem(getStorageKey(monthStr));
    if (!monthDataRaw) return 0;

    let monthData;
    try {
        monthData = normalizeMonthPayload(JSON.parse(monthDataRaw));
    } catch {
        return 0;
    }

    let salary = { first: 0, second: 0 };
    const salaryRaw = localStorage.getItem(`budgetTrackerSalary_${monthStr}`);
    if (salaryRaw) {
        try {
            const parsedSalary = JSON.parse(salaryRaw);
            salary.first = Number(parsedSalary.first) || 0;
            salary.second = Number(parsedSalary.second) || 0;
        } catch {
            salary = { first: 0, second: 0 };
        }
    }
    const available = (salary.first || 0) + (salary.second || 0);
    const spent = ['first', 'second'].reduce((sum, tableType) => {
        return sum + monthData[tableType].reduce((tableSum, item) => {
            return tableSum + item.expenses.reduce((eSum, e) => eSum + (Number(e.amount) || 0), 0);
        }, 0);
    }, 0);

    return available - spent;
}

function updateFinancialDashboard() {
    const prevMonth = getPreviousMonth(currentFilter || getCurrentMonth());
    const rollover = prevMonth ? calculateMonthRollover(prevMonth) : 0;

    const statsRolloverEl = document.getElementById('statsRollover');
    if (statsRolloverEl) {
        statsRolloverEl.textContent = formatCurrency(rollover);
    }

    const panel = document.getElementById('financialDashboard');
    if (!panel) return;

    const buildCutoffSummary = (tableType) => {
        const items = getTableDataForView(tableType);
        const available = parseFloat(salaryData[tableType]) || 0;
        const spent = items.reduce((sum, item) => sum + sumExpenses(item), 0);
        const planned = items.reduce((sum, item) => sum + item.budget, 0);

        const byGroup = {
            essentials: 0,
            savings: 0,
            investing: 0,
            debt: 0,
            sinking: 0,
            lifestyle: 0
        };

        items.forEach(item => {
            const group = mapTypeToAllocationGroup(item.type || inferCategoryType(item.category));
            byGroup[group] += sumExpenses(item);
        });

        const savingsRate = available > 0 ? ((byGroup.savings + byGroup.investing) / available) * 100 : 0;
        const essentialsRatio = available > 0 ? (byGroup.essentials / available) * 100 : 0;
        const debtRatio = available > 0 ? (byGroup.debt / available) * 100 : 0;
        const budgetAccuracy = planned > 0 ? Math.max(0, 100 - (Math.abs(planned - spent) / planned) * 100) : 0;
        const lifestylePct = available > 0 ? (byGroup.lifestyle / available) * 100 : 0;

        return {
            tableType,
            items,
            available,
            byGroup,
            savingsRate,
            essentialsRatio,
            debtRatio,
            budgetAccuracy,
            lifestylePct
        };
    };

    const first = buildCutoffSummary('first');
    const second = buildCutoffSummary('second');
    const totalAvailable = first.available + second.available;
    const combinedByGroup = {
        essentials: first.byGroup.essentials + second.byGroup.essentials,
        savings: first.byGroup.savings + second.byGroup.savings,
        investing: first.byGroup.investing + second.byGroup.investing,
        debt: first.byGroup.debt + second.byGroup.debt,
        sinking: first.byGroup.sinking + second.byGroup.sinking,
        lifestyle: first.byGroup.lifestyle + second.byGroup.lifestyle
    };

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const setKpi = (id, value, status) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
        el.className = 'kpi-value' + (status ? ` kpi-${status}` : '');
    };

    const kpiStatus = (metric, value, available) => {
        if (!available) return '';
        switch (metric) {
            case 'savings':    return value >= 20 ? 'good' : value >= 10 ? 'warn' : 'bad';
            case 'essentials': return value < 50  ? 'good' : value < categoryCaps.essentials ? 'warn' : 'bad';
            case 'debt':       return value < 15  ? 'good' : value < categoryCaps.debt       ? 'warn' : 'bad';
            case 'accuracy':   return value >= 85 ? 'good' : value >= 70                     ? 'warn' : 'bad';
            default:           return '';
        }
    };

    setKpi('kpiSavingsRateFirst',     `${first.savingsRate.toFixed(1)}%`,     kpiStatus('savings',    first.savingsRate,     first.available));
    setKpi('kpiEssentialsRatioFirst', `${first.essentialsRatio.toFixed(1)}%`, kpiStatus('essentials', first.essentialsRatio, first.available));
    setKpi('kpiDebtRatioFirst',       `${first.debtRatio.toFixed(1)}%`,       kpiStatus('debt',       first.debtRatio,       first.available));
    setKpi('kpiBudgetAccuracyFirst',  `${first.budgetAccuracy.toFixed(1)}%`,  kpiStatus('accuracy',   first.budgetAccuracy,  first.available));

    setKpi('kpiSavingsRateSecond',     `${second.savingsRate.toFixed(1)}%`,     kpiStatus('savings',    second.savingsRate,     second.available));
    setKpi('kpiEssentialsRatioSecond', `${second.essentialsRatio.toFixed(1)}%`, kpiStatus('essentials', second.essentialsRatio, second.available));
    setKpi('kpiDebtRatioSecond',       `${second.debtRatio.toFixed(1)}%`,       kpiStatus('debt',       second.debtRatio,       second.available));
    setKpi('kpiBudgetAccuracySecond',  `${second.budgetAccuracy.toFixed(1)}%`,  kpiStatus('accuracy',   second.budgetAccuracy,  second.available));

    setText('kpiRollover', formatCurrency(rollover));

    const allocationSummary = document.getElementById('allocationSummary');
    if (allocationSummary) {
        const lines = Object.entries(allocationTargets).map(([key, target]) => {
            const actualPct = totalAvailable > 0 ? (combinedByGroup[key] / totalAvailable) * 100 : 0;
            const width = Math.min(100, Math.max(0, actualPct));
            return `
                <div class="allocation-line">
                    <span>Combined ${key.charAt(0).toUpperCase() + key.slice(1)} ${actualPct.toFixed(1)}% / ${target}%</span>
                    <div class="allocation-bar"><div class="allocation-fill" style="width:${width}%"></div></div>
                    <span>${CURRENCY_SYMBOL}${combinedByGroup[key].toFixed(0)}</span>
                </div>
            `;
        }).join('');
        allocationSummary.innerHTML = lines;
    }

    const alerts = [];
    if (first.savingsRate < 20) {
        alerts.push({
            type: 'warn',
            text: '1st cut-off: Savings + investing is below 20% of available money.',
            suggestion: 'Approach: Move 3-5% from lifestyle spending into savings first.'
        });
    }
    if (second.savingsRate < 20) {
        alerts.push({
            type: 'warn',
            text: '2nd cut-off: Savings + investing is below 20% of available money.',
            suggestion: 'Approach: Move 3-5% from lifestyle spending into savings first.'
        });
    }

    if (first.essentialsRatio > categoryCaps.essentials) {
        alerts.push({
            type: 'warn',
            text: `1st cut-off: Essentials exceeded cap (${categoryCaps.essentials}%).`,
            suggestion: 'Approach: Review essential costs and cut/renegotiate one major cost.'
        });
    }
    if (second.essentialsRatio > categoryCaps.essentials) {
        alerts.push({
            type: 'warn',
            text: `2nd cut-off: Essentials exceeded cap (${categoryCaps.essentials}%).`,
            suggestion: 'Approach: Review essential costs and cut/renegotiate one major cost.'
        });
    }

    if (first.debtRatio > categoryCaps.debt) {
        alerts.push({
            type: 'warn',
            text: `1st cut-off: Debt exceeded cap (${categoryCaps.debt}%).`,
            suggestion: 'Approach: Pause new installments and prioritize extra debt payoff.'
        });
    }
    if (second.debtRatio > categoryCaps.debt) {
        alerts.push({
            type: 'warn',
            text: `2nd cut-off: Debt exceeded cap (${categoryCaps.debt}%).`,
            suggestion: 'Approach: Pause new installments and prioritize extra debt payoff.'
        });
    }

    if (first.lifestylePct > categoryCaps.lifestyle) {
        alerts.push({
            type: 'warn',
            text: `1st cut-off: Lifestyle exceeded cap (${categoryCaps.lifestyle}%).`,
            suggestion: 'Approach: Set a weekly leisure cap and shift excess to sinking fund.'
        });
    }
    if (second.lifestylePct > categoryCaps.lifestyle) {
        alerts.push({
            type: 'warn',
            text: `2nd cut-off: Lifestyle exceeded cap (${categoryCaps.lifestyle}%).`,
            suggestion: 'Approach: Set a weekly leisure cap and shift excess to sinking fund.'
        });
    }

    if (alerts.length === 0) {
        alerts.push({
            type: 'good',
            text: 'Allocation health checks are within target ranges.',
            suggestion: 'Approach: Keep current plan and review again next cutoff.'
        });
    }

    const alertsContainer = document.getElementById('financialAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = alerts.map(a => `
            <div class="financial-alert ${a.type}">
                <div class="financial-alert-title">${a.text}</div>
                <div class="financial-alert-suggestion">${a.suggestion || ''}</div>
            </div>
        `).join('');
    }
}

function updateTotalSummary() {
    const totalAvailable = getTotalAvailableMoney();
    const totalSpent = getAllVisibleItems().reduce((sum, item) => sum + sumExpenses(item), 0);
    const totalSpare = totalAvailable - totalSpent;

    const salEl   = document.getElementById('totalSalary');
    const spareEl = document.getElementById('totalSpare');
    if (salEl)   salEl.textContent   = formatCurrency(totalAvailable);
    if (spareEl) {
        spareEl.textContent = formatCurrency(totalSpare);
        spareEl.style.color = totalSpare < 0 ? 'var(--danger)' : '';
    }

    updateStatsStrip(totalAvailable, totalSpent, totalSpare);
}

function updateStatsStrip(totalAvailable, totalSpent, totalSpare) {
    const pct    = totalAvailable > 0 ? Math.min(100, (totalSpent / totalAvailable) * 100) : 0;
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setTxt('statsPeriod',    currentFilter || 'All Months');
    setTxt('statsAvailable', formatCurrency(totalAvailable));
    setTxt('statsSpent',     formatCurrency(totalSpent));
    setTxt('statsPct',       pct.toFixed(0) + '%');

    const spareEl = document.getElementById('statsSpare');
    if (spareEl) {
        spareEl.textContent = formatCurrency(totalSpare);
        spareEl.style.color = totalSpare < 0 ? 'var(--danger)' : '';
    }

    const fill = document.getElementById('statsBarFill');
    if (fill) {
        fill.style.width = pct + '%';
        fill.className   = 'stats-bar-fill';
        if (pct >= 100)     fill.classList.add('over');
        else if (pct >= 80) fill.classList.add('warning');
        else                fill.classList.add('safe');
    }

}
function updateSalary(tableType) {
    const salaryInput = document.getElementById(tableType + 'Salary');
    
    salaryData[tableType] = parseFloat(salaryInput.value) || 0;
    
    updateTotals(tableType);
    saveSalaries();
}

// ----------------------------------
// Drag and drop
// ----------------------------------
function initializeDragAndDrop() {
    new Sortable(document.getElementById('firstCutoffBody'), {
        animation: 150,
        handle: '.drag-handle',
        onEnd: (evt) => reorderData('first', evt.oldIndex, evt.newIndex)
    });
    
    new Sortable(document.getElementById('secondCutoffBody'), {
        animation: 150,
        handle: '.drag-handle',
        onEnd: (evt) => reorderData('second', evt.oldIndex, evt.newIndex)
    });
}

function reorderData(tableType, oldIndex, newIndex) {
    const data = budgetData[tableType];
    const movedItem = data.splice(oldIndex, 1)[0];
    data.splice(newIndex, 0, movedItem);
    
    // Re-render the table to reflect the new order
    renderTable(tableType);
    saveData();
}

// ----------------------------------
// Event handlers
// ----------------------------------
function toggleMoreMenu(event, btn) {
    event.stopPropagation();
    const menu = btn.nextElementSibling;
    const isOpen = menu.classList.contains('open');
    const closeAllMoreMenus = () => {
        document.querySelectorAll('.action-more-menu.open').forEach(m => m.classList.remove('open'));
        document.querySelectorAll('.category-card.menu-open').forEach(c => c.classList.remove('menu-open'));
    };

    // Close all other open menus first
    closeAllMoreMenus();

    if (!isOpen) {
        menu.classList.add('open');
        const card = btn.closest('.category-card');
        if (card) card.classList.add('menu-open');
    }
}

function setupEventHandlers() {
    // Close more menus when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.action-more-wrap')) {
            document.querySelectorAll('.action-more-menu.open').forEach(m => m.classList.remove('open'));
            document.querySelectorAll('.category-card.menu-open').forEach(c => c.classList.remove('menu-open'));
        }
    });
}

// ----------------------------------
// Storage and filtering
// ----------------------------------
function getCurrentMonth() {
    const now = new Date();
    return now.toISOString().substring(0, 7); // YYYY-MM format
}

function getStorageKey(month = null) {
    const targetMonth = month || getCurrentMonth();
    return `budgetTracker_${targetMonth}`;
}

function getAllMonthStorageKeys() {
    return Object.keys(localStorage)
        .filter(key => /^budgetTracker_\d{4}-\d{2}$/.test(key))
        .sort();
}

function sumFinancialByPrefix(prefix) {
    const keys = Object.keys(localStorage).filter(key => new RegExp(`^${prefix}_\\d{4}-\\d{2}$`).test(key));
    return keys.reduce((acc, key) => {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '{}');
            acc.first += Number(parsed.first) || 0;
            acc.second += Number(parsed.second) || 0;
        } catch {
            // Ignore malformed keys to keep load resilient.
        }
        return acc;
    }, { first: 0, second: 0 });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function saveData() {
    try {
        // Group data by month and save separately
        const dataByMonth = {};
        
        // Process both tables
        ['first', 'second'].forEach(tableType => {
            budgetData[tableType].forEach(item => {
                const itemMonth = item.date ? item.date.substring(0, 7) : getCurrentMonth();
                
                if (!dataByMonth[itemMonth]) {
                    dataByMonth[itemMonth] = {
                        version: STORAGE_SCHEMA_VERSION,
                        data: { first: [], second: [] }
                    };
                }
                
                dataByMonth[itemMonth].data[tableType].push(normalizeBudgetItem(item));
            });
        });
        
        // Save each month's data separately
        Object.keys(dataByMonth).forEach(month => {
            const storageKey = getStorageKey(month);
            localStorage.setItem(storageKey, JSON.stringify(dataByMonth[month]));
        });

        if (currentFilter) {
            // When editing a filtered month, preserve all other saved months.
            const storageKey = getStorageKey(currentFilter);
            if (!dataByMonth[currentFilter]) {
                localStorage.removeItem(storageKey);
            }
            return;
        }

        // Remove stale month payloads so deleted months do not reappear on reload.
        getAllMonthStorageKeys().forEach(key => {
            const month = key.replace('budgetTracker_', '');
            if (!dataByMonth[month]) {
                localStorage.removeItem(key);
            }
        });
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

function loadData() {
    try {
        budgetData = { first: [], second: [] };
        
        // If we have a filter, load only that month's data
        if (currentFilter) {
            const storageKey = getStorageKey(currentFilter);
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const monthData = normalizeMonthPayload(JSON.parse(saved), currentFilter);
                budgetData.first = monthData.first || [];
                budgetData.second = monthData.second || [];
            }
        } else {
            // Load all months' data
            const allKeys = getAllMonthStorageKeys();
            
            allKeys.forEach(key => {
                const saved = localStorage.getItem(key);
                if (saved) {
                    try {
                        const month = key.replace('budgetTracker_', '');
                        const monthData = normalizeMonthPayload(JSON.parse(saved), month);
                        budgetData.first = budgetData.first.concat(monthData.first || []);
                        budgetData.second = budgetData.second.concat(monthData.second || []);
                    } catch (e) {
                        console.error('Error parsing month data for key:', key, e);
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function saveSalaries() {
    try {
        // Save salaries for the currently selected month (or current month if none)
        const month = currentFilter || getCurrentMonth();
        const key = `budgetTrackerSalary_${month}`;
        localStorage.setItem(key, JSON.stringify({ first: salaryData.first, second: salaryData.second }));
    } catch (error) {
        console.error('Error saving salaries:', error);
    }
}

function loadSalaries() {
    try {
        // Load salaries for the selected month. If no month is selected, clear inputs.
        if (!currentFilter) {
            const aggregated = sumFinancialByPrefix('budgetTrackerSalary');
            salaryData.first = aggregated.first;
            salaryData.second = aggregated.second;
            document.getElementById('firstSalary').value = salaryData.first || '';
            document.getElementById('secondSalary').value = salaryData.second || '';
            updateTotals('first');
            updateTotals('second');
            return;
        }

        const key = `budgetTrackerSalary_${currentFilter}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved);
            salaryData.first = parsed.first || 0;
            salaryData.second = parsed.second || 0;
            
            document.getElementById('firstSalary').value = salaryData.first || '';
            document.getElementById('secondSalary').value = salaryData.second || '';
        } else {
            // No saved salaries for this month - reset inputs.
            salaryData.first = 0;
            salaryData.second = 0;
            document.getElementById('firstSalary').value = '';
            document.getElementById('secondSalary').value = '';
        }

        updateTotals('first');
        updateTotals('second');
    } catch (error) {
        console.error('Error loading salaries:', error);
    }
}

function saveSettings() {
    try {
        localStorage.setItem('budgetTrackerSettings', JSON.stringify({ currentFilter }));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('budgetTrackerSettings');
        if (!saved) return;
        const parsed = JSON.parse(saved);
        currentFilter = parsed.currentFilter || null;
        const monthInput = document.getElementById('monthFilter');
        if (monthInput) {
            monthInput.value = currentFilter || '';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function filterByMonth() {
    const monthInput = document.getElementById('monthFilter');
    const selectedMonth = monthInput ? monthInput.value : '';

    if (!selectedMonth) {
        showAllMonths();
        return;
    }

    currentFilter = selectedMonth;
    loadData();
    loadSalaries();
    renderBothTables();
    saveSettings();
}

function showAllMonths() {
    currentFilter = null;
    const monthInput = document.getElementById('monthFilter');
    if (monthInput) {
        monthInput.value = '';
    }

    loadData();
    loadSalaries();
    renderBothTables();
    saveSettings();
}

// ----------------------------------
// CSV import and export
// ----------------------------------
function exportToCSV() {
    const csvData = [];
    csvData.push(['Table', 'Category', 'Type', 'Date', 'Budget', 'Expense Description', 'Expense Date', 'Expense Amount']);

    ['first', 'second'].forEach(tableType => {
        budgetData[tableType].forEach(item => {
            if (item.expenses && item.expenses.length > 0) {
                item.expenses.forEach(expense => {
                    csvData.push([
                        tableType,
                        item.category,
                        item.type || inferCategoryType(item.category),
                        item.date || '',
                        item.budget,
                        expense.description,
                        expense.date || '',
                        expense.amount
                    ]);
                });
            } else {
                csvData.push([
                    tableType,
                    item.category,
                    item.type || inferCategoryType(item.category),
                    item.date || '',
                    item.budget,
                    '',
                    '',
                    0
                ]);
            }
        });
    });

    const csvContent = csvData.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `budget-tracker-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importFromCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            const rows = csvText.split('\n').map(row => {
                const result = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < row.length; i++) {
                    const char = row[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        result.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                result.push(current.trim());
                return result;
            });

            const dataRows = rows.slice(1).filter(row => row.length >= 7 && row[0]);
            budgetData = { first: [], second: [] };
            const categories = {};

            dataRows.forEach(row => {
                const hasTypeColumn = row.length >= 8;
                const tableType = row[0];
                const category = row[1];
                const type = hasTypeColumn ? row[2] : '';
                const date = hasTypeColumn ? row[3] : row[2];
                const budget = hasTypeColumn ? row[4] : row[3];
                const expenseDesc = hasTypeColumn ? row[5] : row[4];
                const expenseDate = hasTypeColumn ? row[6] : row[5];
                const expenseAmount = hasTypeColumn ? row[7] : row[6];

                const key = `${tableType}-${category}-${date}`;
                if (!categories[key]) {
                    categories[key] = {
                        tableType,
                        category,
                        type: CATEGORY_TYPES.includes(type) ? type : inferCategoryType(category),
                        date,
                        budget: parseFloat(budget) || 0,
                        expenses: []
                    };
                }

                if (expenseDesc && expenseDesc.trim()) {
                    categories[key].expenses.push({
                        description: expenseDesc,
                        date: expenseDate,
                        amount: parseFloat(expenseAmount) || 0
                    });
                }
            });

            Object.values(categories).forEach(cat => {
                const item = {
                    id: generateId(),
                    category: cat.category,
                    type: cat.type || inferCategoryType(cat.category),
                    date: cat.date,
                    budget: cat.budget,
                    expenses: cat.expenses
                };
                if (cat.tableType === 'first' || cat.tableType === 'second') {
                    budgetData[cat.tableType].push(item);
                }
            });

            saveData();
            renderBothTables();
        } catch (error) {
            console.error('CSV import error:', error);
            alert('Error importing CSV file. Please check the file format.');
        }
    };

    reader.readAsText(file);
    event.target.value = '';
}

// ----------------------------------
// Preset management
// ----------------------------------
function initializePresets() {
    const saved = localStorage.getItem('budgetTrackerPresets');
    if (saved) {
        const normalizePresetItems = (items = []) => {
            if (!Array.isArray(items)) return [];
            return items.map(item => {
                const category = (item && item.category ? item.category : '').toString();
                const budget = Number(item && item.budget) || 0;
                const type = CATEGORY_TYPES.includes(item && item.type) ? item.type : inferCategoryType(category);
                return { category, budget, type };
            });
        };
        try {
            const parsed = JSON.parse(saved);
            presets = {
                1: { name: parsed?.[1]?.name || 'Preset 1', first: normalizePresetItems(parsed?.[1]?.first), second: normalizePresetItems(parsed?.[1]?.second) },
                2: { name: parsed?.[2]?.name || 'Preset 2', first: normalizePresetItems(parsed?.[2]?.first), second: normalizePresetItems(parsed?.[2]?.second) },
                3: { name: parsed?.[3]?.name || 'Preset 3', first: normalizePresetItems(parsed?.[3]?.first), second: normalizePresetItems(parsed?.[3]?.second) },
                4: { name: parsed?.[4]?.name || 'Preset 4', first: normalizePresetItems(parsed?.[4]?.first), second: normalizePresetItems(parsed?.[4]?.second) },
                5: { name: parsed?.[5]?.name || 'Preset 5', first: normalizePresetItems(parsed?.[5]?.first), second: normalizePresetItems(parsed?.[5]?.second) }
            };
        } catch (error) {
            console.error('Error loading presets:', error);
            presets = {
                1: { name: "Essential Budget", first: [{ category: 'Groceries', budget: 8000, type: 'essential' }, { category: 'Transportation', budget: 3000, type: 'essential' }], second: [{ category: 'Entertainment', budget: 3000, type: 'lifestyle' }] },
                2: { name: "Student Budget", first: [{ category: 'Food', budget: 5000, type: 'essential' }, { category: 'Transportation', budget: 2000, type: 'essential' }], second: [{ category: 'Entertainment', budget: 1500, type: 'lifestyle' }] },
                3: { name: "Family Budget", first: [{ category: 'Groceries', budget: 12000, type: 'essential' }, { category: 'Utilities', budget: 4000, type: 'essential' }], second: [{ category: 'Kids Activities', budget: 3000, type: 'lifestyle' }] },
                4: { name: "Minimalist Budget", first: [{ category: 'Food', budget: 6000, type: 'essential' }, { category: 'Rent', budget: 12000, type: 'essential' }], second: [{ category: 'Savings', budget: 15000, type: 'savings' }] },
                5: { name: "Custom Preset", first: [{ category: 'Category 1', budget: 1000, type: 'essential' }], second: [{ category: 'Category A', budget: 1000, type: 'essential' }] }
            };
            savePresets();
        }
    } else {
        presets = {
            1: { name: "Essential Budget", first: [{ category: 'Groceries', budget: 8000, type: 'essential' }, { category: 'Transportation', budget: 3000, type: 'essential' }], second: [{ category: 'Entertainment', budget: 3000, type: 'lifestyle' }] },
            2: { name: "Student Budget", first: [{ category: 'Food', budget: 5000, type: 'essential' }, { category: 'Transportation', budget: 2000, type: 'essential' }], second: [{ category: 'Entertainment', budget: 1500, type: 'lifestyle' }] },
            3: { name: "Family Budget", first: [{ category: 'Groceries', budget: 12000, type: 'essential' }, { category: 'Utilities', budget: 4000, type: 'essential' }], second: [{ category: 'Kids Activities', budget: 3000, type: 'lifestyle' }] },
            4: { name: "Minimalist Budget", first: [{ category: 'Food', budget: 6000, type: 'essential' }, { category: 'Rent', budget: 12000, type: 'essential' }], second: [{ category: 'Savings', budget: 15000, type: 'savings' }] },
            5: { name: "Custom Preset", first: [{ category: 'Category 1', budget: 1000, type: 'essential' }], second: [{ category: 'Category A', budget: 1000, type: 'essential' }] }
        };
        savePresets();
    }
    updatePresetButtonLabels();
}

function savePresets() {
    localStorage.setItem('budgetTrackerPresets', JSON.stringify(presets));
}

function loadPreset(presetNumber) {
    if (!presets[presetNumber]) {
        alert('Preset not found!');
        return;
    }
    currentPresetSlot = presetNumber;
    syncPresetQuickSelect();

    const preset = presets[presetNumber];
    if (!confirm(`Load "${preset.name}" preset? This will REPLACE all current categories in both tables.`)) return;

    const currentMonth = getCurrentMonth();
    const defaultDate = currentFilter ? `${currentFilter}-01` : `${currentMonth}-01`;

    if (currentFilter) {
        budgetData.first = budgetData.first.filter(item => (item.date ? item.date.substring(0, 7) : getCurrentMonth()) !== currentFilter);
        budgetData.second = budgetData.second.filter(item => (item.date ? item.date.substring(0, 7) : getCurrentMonth()) !== currentFilter);
    } else {
        budgetData.first = [];
        budgetData.second = [];
    }

    preset.first.forEach(item => {
        const resolvedType = CATEGORY_TYPES.includes(item.type) ? item.type : inferCategoryType(item.category);
        budgetData.first.push({ id: generateId(), category: item.category, date: defaultDate, budget: item.budget, expenses: [], type: resolvedType });
    });
    preset.second.forEach(item => {
        const resolvedType = CATEGORY_TYPES.includes(item.type) ? item.type : inferCategoryType(item.category);
        budgetData.second.push({ id: generateId(), category: item.category, date: defaultDate, budget: item.budget, expenses: [], type: resolvedType });
    });

    saveData();
    renderBothTables();
}

function openPresetManager() {
    window.location.href = 'manage-presets.html';
}

function initializePresetDragAndDrop() {
    if (presetSortablesInitialized || typeof Sortable === 'undefined') return;

    const firstContainer = document.getElementById('firstPresetCategories');
    const secondContainer = document.getElementById('secondPresetCategories');
    if (!firstContainer || !secondContainer) return;

    const sortableConfig = {
        animation: 150,
        handle: '.preset-drag-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: () => updatePresetCategoryCharts()
    };

    new Sortable(firstContainer, sortableConfig);
    new Sortable(secondContainer, sortableConfig);
    presetSortablesInitialized = true;
}

function loadPresetForEditing() {
    currentEditingPreset = parseInt(document.getElementById('presetSelect').value, 10);
    currentPresetSlot = currentEditingPreset;
    syncPresetQuickSelect();
    const preset = presets[currentEditingPreset];
    if (!preset) return;

    document.getElementById('presetName').value = preset.name;

    const firstContainer = document.getElementById('firstPresetCategories');
    firstContainer.innerHTML = '';
    preset.first.forEach((item, index) => addPresetCategoryField('first', item.category, item.budget, index, item.type || inferCategoryType(item.category)));

    const secondContainer = document.getElementById('secondPresetCategories');
    secondContainer.innerHTML = '';
    preset.second.forEach((item, index) => addPresetCategoryField('second', item.category, item.budget, index, item.type || inferCategoryType(item.category)));
    updatePresetCategoryCharts();
}

function addPresetCategory(tableType) {
    const container = document.getElementById(tableType + 'PresetCategories');
    const index = container.children.length;
    addPresetCategoryField(tableType, 'New Category', 1000, index, 'essential');
    updatePresetCategoryCharts();
}

function addPresetCategoryField(tableType, category, budget, index, type = 'essential') {
    const container = document.getElementById(tableType + 'PresetCategories');
    const div = document.createElement('div');
    div.className = 'preset-category-row';
    div.innerHTML = `
        <span class="preset-drag-handle drag-handle" title="Drag to reorder">::</span>
        <div class="preset-category-name-wrap">
            <input type="text" value="${category}" placeholder="Category name" class="preset-category-name">
            <span class="preset-category-info" tabindex="0" data-tip="Usage: 0.0% / 100%&#10;Budget: ${formatPhpCurrency(0)} / ${formatPhpCurrency(0)}">i</span>
        </div>
        <input type="number" value="${budget}" placeholder="Budget" class="preset-category-budget" step="0.01">
        <select class="preset-category-type">${buildTypeOptions(type)}</select>
        <button onclick="removePresetCategoryRow(this)" class="preset-remove-btn">Remove</button>
    `;
    container.appendChild(div);
}

function removePresetCategoryRow(button) {
    if (!button || !button.parentElement) return;
    button.parentElement.remove();
    updatePresetCategoryCharts();
}

function collectPresetCategoriesFromContainer(containerId) {
    const container = document.getElementById(containerId);
    const categories = [];
    if (!container) return categories;

    Array.from(container.children).forEach(div => {
        const categoryInput = div.querySelector('.preset-category-name');
        const budgetInput = div.querySelector('.preset-category-budget');
        const typeInput = div.querySelector('.preset-category-type');
        const category = categoryInput ? categoryInput.value.trim() : '';
        const budget = parseFloat(budgetInput ? budgetInput.value : 0) || 0;
        const type = CATEGORY_TYPES.includes(typeInput ? typeInput.value : '') ? typeInput.value : inferCategoryType(category);
        if (category) categories.push({ category, budget, type });
    });

    return categories;
}

function summarizePresetByType(items = []) {
    const summary = {};
    items.forEach(item => {
        const type = CATEGORY_TYPES.includes(item.type) ? item.type : 'essential';
        summary[type] = (summary[type] || 0) + (Number(item.budget) || 0);
    });
    return summary;
}

function updatePresetCategoryIndicatorsForContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const avgNetPay = getPresetAverageNetPay();
    Array.from(container.children).forEach(row => {
        const info = row.querySelector('.preset-category-info');
        const budgetInput = row.querySelector('.preset-category-budget');
        const typeInput = row.querySelector('.preset-category-type');
        if (!info || !budgetInput || !typeInput) return;

        info.classList.remove('warn', 'danger');

        const budget = parseFloat(budgetInput.value) || 0;
        const type = CATEGORY_TYPES.includes(typeInput.value) ? typeInput.value : 'essential';
        const group = mapTypeToAllocationGroup(type);
        const targetPct = Number(allocationTargets[group]) || 0;
        const allowance = avgNetPay > 0 ? avgNetPay * (targetPct / 100) : 0;

        if (avgNetPay <= 0 || targetPct <= 0 || allowance <= 0) {
            info.dataset.tip = `Usage: 0.0% / 100%\nBudget: ${formatPhpCurrency(0)} / ${formatPhpCurrency(0)}`;
            return;
        }

        const consumptionPct = allowance > 0 ? (budget / allowance) * 100 : 0;
        info.dataset.tip = `Usage: ${consumptionPct.toFixed(1)}% / 100%\nBudget: ${formatPhpCurrency(budget)} / ${formatPhpCurrency(allowance)}`;

        if (consumptionPct > 100) {
            info.classList.add('danger');
        } else if (consumptionPct >= 70) {
            info.classList.add('warn');
        }
    });
}

function updatePresetCategoryIndicators() {
    updatePresetCategoryIndicatorsForContainer('firstPresetCategories');
    updatePresetCategoryIndicatorsForContainer('secondPresetCategories');
}

function renderPresetPieChart(canvasId, legendId, items = []) {
    const canvas = document.getElementById(canvasId);
    const legend = document.getElementById(legendId);
    if (!canvas || !legend) return;

    const summary = summarizePresetByType(items);
    const entries = Object.entries(summary).filter(([, amount]) => amount > 0);
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
    const averageNetPay = getPresetAverageNetPay();
    const utilizationPct = averageNetPay > 0 ? (total / averageNetPay) * 100 : 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!entries.length || total <= 0) {
        ctx.fillStyle = '#d5e2f3';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 55, 0, Math.PI * 2);
        ctx.fill();
    } else {
        let startAngle = -Math.PI / 2;
        entries.forEach(([type, amount]) => {
            const slice = (amount / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, canvas.height / 2);
            ctx.arc(canvas.width / 2, canvas.height / 2, 55, startAngle, startAngle + slice);
            ctx.closePath();
            ctx.fillStyle = getTypeColor(type);
            ctx.fill();
            startAngle += slice;
        });
    }

    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#1f3554';
    ctx.font = 'bold 11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(utilizationPct > 0 ? `${utilizationPct.toFixed(0)}%` : formatCurrency(total), canvas.width / 2, canvas.height / 2 - 5);
    ctx.font = '10px Segoe UI';
    ctx.fillStyle = '#5a6f88';
    ctx.fillText('of net pay', canvas.width / 2, canvas.height / 2 + 9);

    const legendSummaryLine = averageNetPay > 0
        ? `<div class="preset-legend-summary">Total ${formatCurrency(total)} / Net ${formatCurrency(averageNetPay)}</div>`
        : `<div class="preset-legend-summary">Total ${formatCurrency(total)}</div>`;

    legend.innerHTML = legendSummaryLine + CATEGORY_TYPES.map(type => {
        const amount = Number(summary[type]) || 0;
        const designGroup = mapTypeToAllocationGroup(type);
        const designPct = Number(allocationTargets[designGroup]) || 0;
        const currentPct = averageNetPay > 0 ? ((amount / averageNetPay) * 100) : 0;
        return `
            <div class="preset-legend-item">
                <span class="preset-legend-dot" style="background:${getTypeColor(type)}"></span>
                <span>${formatCategoryTypeLabel(type)} ${currentPct.toFixed(1)}% / ${designPct.toFixed(1)}%</span>
            </div>
        `;
    }).join('');
}

function updatePresetCategoryCharts() {
    const first = collectPresetCategoriesFromContainer('firstPresetCategories');
    const second = collectPresetCategoriesFromContainer('secondPresetCategories');
    renderPresetPieChart('firstPresetPie', 'firstPresetLegend', first);
    renderPresetPieChart('secondPresetPie', 'secondPresetLegend', second);
    updatePresetCategoryIndicators();
}

function bindPresetChartEvents() {
    if (presetChartEventsBound) return;
    const firstContainer = document.getElementById('firstPresetCategories');
    const secondContainer = document.getElementById('secondPresetCategories');
    const handler = () => updatePresetCategoryCharts();
    [firstContainer, secondContainer].forEach(container => {
        if (!container) return;
        container.addEventListener('input', handler);
        container.addEventListener('change', handler);
    });
    const netPayInput = document.getElementById('presetAverageNetPay');
    if (netPayInput) {
        netPayInput.addEventListener('input', () => {
            savePresetAverageNetPayField();
            updatePresetCategoryCharts();
        });
        netPayInput.addEventListener('change', () => {
            savePresetAverageNetPayField();
            updatePresetCategoryCharts();
        });
    }
    presetChartEventsBound = true;
}

function mirrorFirstToSecondPreset() {
    const sourceItems = collectPresetCategoriesFromContainer('firstPresetCategories');
    const secondContainer = document.getElementById('secondPresetCategories');
    if (!secondContainer) return;
    secondContainer.innerHTML = '';
    sourceItems.forEach((item, index) => {
        addPresetCategoryField('second', item.category, item.budget, index, item.type);
    });
    updatePresetCategoryCharts();
}

function savePreviousBalances() {
    try {
        localStorage.setItem('budgetTrackerPreviousBalance', JSON.stringify(previousBalanceData));
    } catch (error) {
        console.error('Error saving previous balances:', error);
    }
}

function loadPreviousBalances() {
    try {
        const saved = localStorage.getItem('budgetTrackerPreviousBalance');
        if (saved) {
            const parsed = JSON.parse(saved);
            previousBalanceData.first = parsed.first || 0;
            previousBalanceData.second = parsed.second || 0;
            
            document.getElementById('firstPreviousBalance').value = previousBalanceData.first || '';
            document.getElementById('secondPreviousBalance').value = previousBalanceData.second || '';
            
            updateTotals('first');
            updateTotals('second');
        }
    } catch (error) {
        console.error('Error loading previous balances:', error);
    }
}

function quickSaveCurrentPreset() {
    const slotInput = prompt('Save to preset slot (1-5):', '1');
    const slot = parseInt(slotInput, 10);

    if (![1, 2, 3, 4, 5].includes(slot)) {
        alert('Please choose a preset slot from 1 to 5.');
        return;
    }

    const currentName = presets[slot]?.name || `Preset ${slot}`;
    const nameInput = prompt('Preset name:', currentName);
    const presetName = (nameInput || '').trim() || currentName;

    const buildPresetItems = (tableType) => {
        return getTableDataForView(tableType).map(item => ({
            category: item.category,
            budget: Number(item.budget) || 0,
            type: item.type || inferCategoryType(item.category)
        }));
    };

    presets[slot] = {
        name: presetName,
        first: buildPresetItems('first'),
        second: buildPresetItems('second')
    };

    savePresets();
    updatePresetButtonLabels();
    alert(`Preset ${slot} saved successfully.`);
}

function savePreset() {
    const presetName = document.getElementById('presetName').value.trim();
    if (!presetName) {
        alert('Please enter a preset name.');
        return;
    }
    
    const firstCategories = collectPresetCategoriesFromContainer('firstPresetCategories');
    const secondCategories = collectPresetCategoriesFromContainer('secondPresetCategories');
    
    // Save preset
    presets[currentEditingPreset] = {
        name: presetName,
        first: firstCategories,
        second: secondCategories
    };
    
    savePresets();
    updatePresetButtonLabels();
    alert('Preset saved successfully!');
}

function resetPresetToDefault() {
    if (confirm('Reset this preset to default values?')) {
        const defaultPresets = {
            1: { name: "Essential Budget", first: [{ category: 'Groceries', budget: 8000, type: 'essential' }, { category: 'Transportation', budget: 3000, type: 'essential' }], second: [{ category: 'Entertainment', budget: 3000, type: 'lifestyle' }] },
            2: { name: "Student Budget", first: [{ category: 'Food', budget: 5000, type: 'essential' }, { category: 'Transportation', budget: 2000, type: 'essential' }], second: [{ category: 'Entertainment', budget: 1500, type: 'lifestyle' }] },
            3: { name: "Family Budget", first: [{ category: 'Groceries', budget: 12000, type: 'essential' }, { category: 'Utilities', budget: 4000, type: 'essential' }], second: [{ category: 'Kids Activities', budget: 3000, type: 'lifestyle' }] },
            4: { name: "Minimalist Budget", first: [{ category: 'Food', budget: 6000, type: 'essential' }, { category: 'Rent', budget: 12000, type: 'essential' }], second: [{ category: 'Savings', budget: 15000, type: 'savings' }] },
            5: { name: "Custom Preset", first: [{ category: 'Category 1', budget: 1000, type: 'essential' }], second: [{ category: 'Category A', budget: 1000, type: 'essential' }] }
        };
        
        presets[currentEditingPreset] = defaultPresets[currentEditingPreset];
        loadPresetForEditing();
        savePresets();
        updatePresetButtonLabels();
    }
}

function updatePresetButtonLabels() {
    // Update preset quick-select labels with preset names
    const quickSelect = document.getElementById('presetQuickSelect');
    if (quickSelect) {
        const previous = parseInt(quickSelect.value, 10);
        quickSelect.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const option = document.createElement('option');
            option.value = String(i);
            option.textContent = presets[i] ? presets[i].name : `Preset ${i}`;
            quickSelect.appendChild(option);
        }
        const selectedSlot = presets[currentPresetSlot]
            ? currentPresetSlot
            : (presets[previous] ? previous : 1);
        quickSelect.value = String(selectedSlot);
        currentPresetSlot = selectedSlot;
    }

    // Backward compatibility if legacy preset buttons still exist
    for (let i = 1; i <= 5; i++) {
        const button = document.getElementById(`presetBtn${i}`);
        if (button && presets[i]) {
            button.textContent = presets[i].name;
            button.title = presets[i].name; // Add tooltip for full name
        }
    }
}

function setCurrentPresetSlot(slotValue) {
    const slot = parseInt(slotValue, 10);
    if (![1, 2, 3, 4, 5].includes(slot)) return;
    currentPresetSlot = slot;
}

function syncPresetQuickSelect() {
    const quickSelect = document.getElementById('presetQuickSelect');
    if (!quickSelect) return;
    quickSelect.value = String(currentPresetSlot);
}

function loadSelectedPreset() {
    const quickSelect = document.getElementById('presetQuickSelect');
    if (!quickSelect) return;
    const slot = parseInt(quickSelect.value, 10);
    if (![1, 2, 3, 4, 5].includes(slot)) return;
    loadPreset(slot);
}

function closePresetModal() {
    document.getElementById('presetModal').style.display = 'none';
}

// ----------------------------------
// Data reset utilities
// ----------------------------------
function clearCategories() {
    if (confirm('Are you sure you want to clear all categories? This will remove all categories and their expenses but keep salary data.')) {
        // Clear category data for current filter or all data
        if (currentFilter) {
            // If filtering by month, only clear that month's categories
            budgetData.first = budgetData.first.filter(item => {
                const itemMonth = item.date ? item.date.substring(0, 7) : getCurrentMonth();
                return itemMonth !== currentFilter;
            });
            budgetData.second = budgetData.second.filter(item => {
                const itemMonth = item.date ? item.date.substring(0, 7) : getCurrentMonth();
                return itemMonth !== currentFilter;
            });
            alert(`Categories for ${currentFilter} cleared successfully!`);
        } else {
            // If showing all months, clear all categories
            budgetData = { first: [], second: [] };
            alert('All categories cleared successfully!');
        }
        
        saveData();
        renderBothTables();
    }
}

function clearAllData() {
    if (confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
        budgetData = { first: [], second: [] };
        salaryData = { first: 0, second: 0 };
        clearTrackerStorage();
        
        // Reset UI
        document.getElementById('firstSalary').value = '';
        document.getElementById('secondSalary').value = '';
        currentFilter = null;
        document.getElementById('monthFilter').value = '';
        
        renderBothTables();
        alert('All data cleared successfully!');
    }
}

// ----------------------------------
// Theme
// ----------------------------------
function initializeDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    if (isDarkMode) {
        enableDarkMode();
    } else {
        disableDarkMode();
    }
}

function toggleDarkMode() {
    const body = document.body;
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (body.classList.contains('dark-mode')) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

function enableDarkMode() {
    const body = document.body;
    const toggleIcon = document.querySelector('.toggle-icon');
    
    body.classList.add('dark-mode');
    if (toggleIcon) {
        toggleIcon.textContent = '\u2600\uFE0F';
    }
    
    localStorage.setItem('darkMode', 'true');
}

function disableDarkMode() {
    const body = document.body;
    const toggleIcon = document.querySelector('.toggle-icon');

    body.classList.remove('dark-mode');
    if (toggleIcon) {
        toggleIcon.textContent = '\uD83C\uDF19';
    }

    localStorage.setItem('darkMode', 'false');
}

// ----------------------------------
// Expense reset
// ----------------------------------
function resetBreakdown() {
    if (!confirm('Clear all expenses for this category? This cannot be undone.')) return;
    const item = budgetData[currentModal.expenseTable].find(item => item.id === currentModal.expenseRow);
    if (!item) return;
    item.expenses = [];
    item.paid = false;
    item.paidAt = '';
    delete item.prePaidExpenses;
    renderExpenseList(item.expenses);
    renderTable(currentModal.expenseTable);
    saveData();
}

// ----------------------------------
// JSON Backup / Restore
// ----------------------------------
function exportJSON() {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('budgetTracker')) {
            backup[key] = localStorage.getItem(key);
        }
    }
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (typeof data !== 'object' || data === null) throw new Error('Invalid format');
            if (!confirm('Restore backup? All current data will be replaced.')) return;
            clearTrackerStorage();
            Object.entries(data).forEach(([key, value]) => {
                if (key.startsWith('budgetTracker')) {
                    localStorage.setItem(key, value);
                }
            });
            location.reload();
        } catch (err) {
            alert('Could not read backup file. Make sure it is a valid Budget Tracker JSON export.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}









