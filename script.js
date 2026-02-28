// Budget Tracker - Clean and Simple

// Global state
let budgetData = { first: [], second: [] };
let salaryData = { first: 0, second: 0 };
let payrollBalanceData = { first: 0, second: 0 };
let cashMoneyData = { first: 0, second: 0 };
let previousBalanceData = { first: 0, second: 0 };
let currentFilter = null;
let presets = {};
let currentEditingPreset = 1;
let currentModal = { editRow: null, editTable: null, expenseRow: null, expenseTable: null };
const STORAGE_SCHEMA_VERSION = 3;
const CURRENCY_SYMBOL = '\u20B1';
const CATEGORY_TYPES = ['fixed', 'essential', 'lifestyle', 'sinking', 'savings', 'investing', 'debt'];
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
let allocationTargets = { ...DEFAULT_ALLOCATION_TARGETS };
let categoryCaps = { ...DEFAULT_CATEGORY_CAPS };

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

function sumExpenses(item) {
    if (!item || !Array.isArray(item.expenses)) return 0;
    return item.expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
}

function inferCategoryType(categoryName = '') {
    const text = categoryName.toLowerCase();
    if (text.includes('rent') || text.includes('mortgage') || text.includes('utility') || text.includes('insurance')) return 'fixed';
    if (text.includes('saving')) return 'savings';
    if (text.includes('invest')) return 'investing';
    if (text.includes('debt') || text.includes('loan') || text.includes('credit')) return 'debt';
    if (text.includes('emergency') || text.includes('repair') || text.includes('gift') || text.includes('maintenance')) return 'sinking';
    if (text.includes('entertainment') || text.includes('dining') || text.includes('shopping') || text.includes('leisure')) return 'lifestyle';
    return 'essential';
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

    return normalized;
}

function normalizeMonthPayload(rawPayload) {
    const rawData = rawPayload && rawPayload.data ? rawPayload.data : rawPayload;
    return {
        first: Array.isArray(rawData?.first) ? rawData.first.map(normalizeBudgetItem) : [],
        second: Array.isArray(rawData?.second) ? rawData.second.map(normalizeBudgetItem) : []
    };
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

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializePresets();
    // Load settings first so currentFilter is restored before loading month-specific data
    loadSettings();
    loadAdvisorConfig();
    loadData();
    loadSalaries();
    loadPayrollBalances();
    loadCashMoney();
    initializeTables();
    setupEventHandlers();
    initializeDarkMode();

    window.addEventListener('storage', function(event) {
        if (event.key !== ADVISOR_CONFIG_STORAGE_KEY) return;
        loadAdvisorConfig();
        updateFinancialDashboard();
    });
});

function initializeTables() {
    
    // Only add sample data if no saved data exists at all
    const hasExistingData = (budgetData.first && budgetData.first.length > 0) || 
                           (budgetData.second && budgetData.second.length > 0);
    
    if (!hasExistingData) {
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
            { id: generateId(), category: 'Utilities', date: '2025-07-01', budget: 150, type: 'fixed', expenses: [] }
        ];
        
        // Save the sample data
        saveData();
    } else {
    }

    renderBothTables();
    initializeDragAndDrop();
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
        { id: generateId(), category: 'Utilities', budget: 150, type: 'fixed', expenses: [] }
    ];
}

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
    row.dataset.id = item.id;

    const totalSpent = sumExpenses(item);
    const variance = item.budget - totalSpent;
    const budgetPercentage = item.budget > 0 ? (totalSpent / item.budget) * 100 : 0;
    const isPaid = Boolean(item.paid);

    // Determine styling based on budget percentage
    let rowClass = '';
    let spentClass = '';

    if (budgetPercentage <= 79) {
        // 0-79%: Green (safe)
        rowClass = 'budget-safe';
        spentClass = 'spent-safe';
    } else if (budgetPercentage >= 80 && budgetPercentage <= 99) {
        // 80-99%: Orange (warning)
        rowClass = 'budget-warning';
        spentClass = 'spent-warning';
    } else if (budgetPercentage === 100) {
        // Exactly 100%: Yellow
        rowClass = 'budget-exact';
        spentClass = 'spent-exact';
    } else {
        // Over 100%: Red (over budget)
        rowClass = 'budget-over';
        spentClass = 'spent-over';
    }

    // Apply styling to the row
    row.classList.add(rowClass);

    // Create spent cell with conditional styling
    const spentDisplay = `<span class="spent-amount ${spentClass}">${formatCurrency(totalSpent)}</span>`;
    const varianceClass = variance >= 0 ? 'variance-positive' : 'variance-negative';
    const varianceDisplay = `<span class="variance-pill ${varianceClass}">${variance >= 0 ? '+' : '-'}${formatCurrency(Math.abs(variance))}</span>`;
    const typeLabel = (item.type || 'essential').replace(/^\w/, c => c.toUpperCase());

    row.innerHTML = `
        <td class="col-order drag-handle">::</td>
        <td class="col-category">${item.category}<span class="category-type-chip">${typeLabel}</span></td>
        <td class="col-budget">${formatCurrency(item.budget)}</td>
        <td class="col-spent spent-cell">
            ${spentDisplay}
            ${varianceDisplay}
            <button class="add-expense-btn" onclick="openExpenseModal('${item.id}', '${tableType}')" title="Open breakdown">+</button>
        </td>
        <td class="col-action action-cell">
            <div class="action-buttons">
                <button class="action-btn edit-btn" onclick="editRow('${item.id}', '${tableType}')">Edit</button>
                <button class="action-btn paid-toggle-btn ${isPaid ? 'unpaid-btn' : ''}" onclick="markAsPaid('${item.id}', '${tableType}')">${isPaid ? 'Unpaid' : 'Paid'}</button>
                <button class="action-btn delete-btn" onclick="deleteRow('${item.id}', '${tableType}')">Del</button>
            </div>
        </td>
    `;

    return row;
}
// Category management
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
    document.getElementById('editDate').value = item.date || '';
    document.getElementById('editBudget').value = item.budget;
    document.getElementById('editType').value = item.type || inferCategoryType(item.category);
    document.getElementById('editModal').style.display = 'block';
}

function saveEdit() {
    const category = document.getElementById('editCategory').value.trim();
    const date = document.getElementById('editDate').value;
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
        item.date = date;
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

function markAsPaid(id, tableType) {
    const item = budgetData[tableType].find(entry => entry.id === id);
    if (!item) return;

    if (item.paid) {
        item.expenses = Array.isArray(item.prePaidExpenses) ? item.prePaidExpenses.map(normalizeExpense) : [];
        item.paid = false;
        item.paidAt = '';
        delete item.prePaidExpenses;
    } else {
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

    renderTable(tableType);
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
}

function renderExpenseList(expenses) {
    const expenseList = document.getElementById('expenseList');
    
    if (expenses.length === 0) {
        expenseList.innerHTML = '<p style="text-align: center; color: #666;">No expenses recorded yet.</p>';
        return;
    }
    
    expenseList.innerHTML = expenses.map((expense, index) => `
        <div class="expense-item">
            <div class="expense-details">
                <span class="expense-description">${expense.description}</span>
                ${expense.date ? `<span class="expense-date" style="color: #666; font-size: 12px;">${formatDayWeekday(expense.date)}</span>` : ''}
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
    const date = document.getElementById('expenseDate').value;
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
        document.getElementById('expenseDate').value = '';
        document.getElementById('expenseAmount').value = '';
    }
}

function editExpense(index) {
    const item = budgetData[currentModal.expenseTable].find(item => item.id === currentModal.expenseRow);
    if (item && item.expenses[index]) {
        const expense = item.expenses[index];
        
        // Pre-fill the form with current expense data
        document.getElementById('expenseDescription').value = expense.description || '';
        document.getElementById('expenseDate').value = expense.date || '';
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
    const date = document.getElementById('expenseDate').value;
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
        document.getElementById('expenseDate').value = '';
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
    document.getElementById('expenseDate').value = '';
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

// Calculations
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

    const rowClasses = ['budget-safe', 'budget-warning', 'budget-exact', 'budget-over', 'over-budget'];
    rowClasses.forEach(cls => spentElement.parentElement.classList.remove(cls));

    let spentClass = '';
    let rowClass = '';

    if (totalPercentage <= 79) {
        spentClass = 'spent-safe';
        rowClass = 'budget-safe';
    } else if (totalPercentage >= 80 && totalPercentage <= 99) {
        spentClass = 'spent-warning';
        rowClass = 'budget-warning';
    } else if (Math.abs(totalPercentage - 100) < 0.01) {
        spentClass = 'spent-exact';
        rowClass = 'budget-exact';
    } else if (totalPercentage > 100) {
        spentClass = 'spent-over';
        rowClass = 'budget-over';
    }

    if (spentClass) {
        spentElement.classList.add(spentClass);
        spentElement.parentElement.classList.add(rowClass);
    }

    spentElement.textContent = formatCurrency(totalSpent);

    const salary = parseFloat(salaryData[tableType]) || 0;
    const payrollBalance = parseFloat(payrollBalanceData[tableType]) || 0;
    const cashMoney = parseFloat(cashMoneyData[tableType]) || 0;
    const totalAvailable = salary + payrollBalance + cashMoney;

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
    const totalSalary = (parseFloat(salaryData.first) || 0) + (parseFloat(salaryData.second) || 0);
    const totalPayroll = (parseFloat(payrollBalanceData.first) || 0) + (parseFloat(payrollBalanceData.second) || 0);
    const totalCash = (parseFloat(cashMoneyData.first) || 0) + (parseFloat(cashMoneyData.second) || 0);
    return totalSalary + totalPayroll + totalCash;
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

    const salaryRaw = localStorage.getItem(`budgetTrackerSalary_${monthStr}`);
    const payrollRaw = localStorage.getItem(`budgetTrackerPayrollBalance_${monthStr}`);
    const cashRaw = localStorage.getItem(`budgetTrackerCashMoney_${monthStr}`);

    const salary = salaryRaw ? JSON.parse(salaryRaw) : { first: 0, second: 0 };
    const payroll = payrollRaw ? JSON.parse(payrollRaw) : { first: 0, second: 0 };
    const cash = cashRaw ? JSON.parse(cashRaw) : { first: 0, second: 0 };
    const available = (salary.first || 0) + (salary.second || 0) + (payroll.first || 0) + (payroll.second || 0) + (cash.first || 0) + (cash.second || 0);
    const spent = ['first', 'second'].reduce((sum, tableType) => {
        return sum + monthData[tableType].reduce((tableSum, item) => {
            return tableSum + item.expenses.reduce((eSum, e) => eSum + (Number(e.amount) || 0), 0);
        }, 0);
    }, 0);

    return available - spent;
}

function updateFinancialDashboard() {
    const panel = document.getElementById('financialDashboard');
    if (!panel) return;

    const items = getAllVisibleItems();
    const totalAvailable = getTotalAvailableMoney();
    const totalSpent = items.reduce((sum, item) => sum + sumExpenses(item), 0);
    const plannedTotal = items.reduce((sum, item) => sum + item.budget, 0);

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
        const spent = sumExpenses(item);
        byGroup[group] += spent;
    });

    const savingsRate = totalAvailable > 0 ? ((byGroup.savings + byGroup.investing) / totalAvailable) * 100 : 0;
    const essentialsRatio = totalAvailable > 0 ? (byGroup.essentials / totalAvailable) * 100 : 0;
    const debtRatio = totalAvailable > 0 ? (byGroup.debt / totalAvailable) * 100 : 0;
    const budgetAccuracy = plannedTotal > 0 ? Math.max(0, 100 - (Math.abs(plannedTotal - totalSpent) / plannedTotal) * 100) : 0;

    const prevMonth = getPreviousMonth(currentFilter || getCurrentMonth());
    const rollover = prevMonth ? calculateMonthRollover(prevMonth) : 0;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('kpiSavingsRate', `${savingsRate.toFixed(1)}%`);
    setText('kpiEssentialsRatio', `${essentialsRatio.toFixed(1)}%`);
    setText('kpiDebtRatio', `${debtRatio.toFixed(1)}%`);
    setText('kpiBudgetAccuracy', `${budgetAccuracy.toFixed(1)}%`);
    setText('kpiRollover', formatCurrency(rollover));

    const allocationSummary = document.getElementById('allocationSummary');
    if (allocationSummary) {
        const lines = Object.entries(allocationTargets).map(([key, target]) => {
            const actualPct = totalAvailable > 0 ? (byGroup[key] / totalAvailable) * 100 : 0;
            const width = Math.min(100, Math.max(0, actualPct));
            return `
                <div class="allocation-line">
                    <span>${key.charAt(0).toUpperCase() + key.slice(1)} ${actualPct.toFixed(1)}% / ${target}%</span>
                    <div class="allocation-bar"><div class="allocation-fill" style="width:${width}%"></div></div>
                    <span>${CURRENCY_SYMBOL}${byGroup[key].toFixed(0)}</span>
                </div>
            `;
        }).join('');
        allocationSummary.innerHTML = lines;
    }

    const alerts = [];
    if (savingsRate < 20) {
        alerts.push({
            type: 'warn',
            text: 'Savings + investing is below 20% of available money.',
            suggestion: 'Approach: Move 3-5% from lifestyle spending into savings first.'
        });
    }
    if (essentialsRatio > categoryCaps.essentials) {
        alerts.push({
            type: 'warn',
            text: `Essentials exceeded cap (${categoryCaps.essentials}%).`,
            suggestion: 'Approach: Review fixed bills and cut/renegotiate one major cost.'
        });
    }
    if (debtRatio > categoryCaps.debt) {
        alerts.push({
            type: 'warn',
            text: `Debt exceeded cap (${categoryCaps.debt}%).`,
            suggestion: 'Approach: Pause new installments and prioritize extra debt payoff.'
        });
    }

    const lifestylePct = totalAvailable > 0 ? (byGroup.lifestyle / totalAvailable) * 100 : 0;
    if (lifestylePct > categoryCaps.lifestyle) {
        alerts.push({
            type: 'warn',
            text: `Lifestyle exceeded cap (${categoryCaps.lifestyle}%).`,
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

    const totalSpent = getAllVisibleItems().reduce((sum, item) => {
        return sum + sumExpenses(item);
    }, 0);

    const totalSpare = totalAvailable - totalSpent;

    const totalSalaryElement = document.getElementById('totalSalary');
    const totalSpareElement = document.getElementById('totalSpare');

    if (totalSalaryElement) {
        totalSalaryElement.textContent = formatCurrency(totalAvailable);
    }

    if (totalSpareElement) {
        totalSpareElement.textContent = formatCurrency(totalSpare);
        totalSpareElement.style.color = totalSpare < 0 ? '#dc3545' : '#007cba';
    }
}
function updateSalary(tableType) {
    const salaryInput = document.getElementById(tableType + 'Salary');
    const payrollBalanceInput = document.getElementById(tableType + 'PayrollBalance');
    const cashMoneyInput = document.getElementById(tableType + 'CashMoney');
    
    salaryData[tableType] = parseFloat(salaryInput.value) || 0;
    payrollBalanceData[tableType] = parseFloat(payrollBalanceInput.value) || 0;
    cashMoneyData[tableType] = parseFloat(cashMoneyInput.value) || 0;
    
    updateTotals(tableType);
    saveSalaries();
    savePayrollBalances();
    saveCashMoney();
}

// Drag and drop
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

// Event handlers
function setupEventHandlers() {
    // Removed click-outside-to-close functionality for ALL modals
    // All modals must now be closed using the X button or Close button for better UX
    window.onclick = function(event) {
        // No modal closing on outside clicks - intentionally empty
    };
}

// Storage functions with per-month data organization
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
                const monthData = normalizeMonthPayload(JSON.parse(saved));
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
                        const monthData = normalizeMonthPayload(JSON.parse(saved));
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
            // No saved salaries for this month — reset inputs
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

function savePayrollBalances() {
    try {
        const month = currentFilter || getCurrentMonth();
        const key = `budgetTrackerPayrollBalance_${month}`;
        localStorage.setItem(key, JSON.stringify({ first: payrollBalanceData.first, second: payrollBalanceData.second }));
    } catch (error) {
        console.error('Error saving payroll balances:', error);
    }
}

function loadPayrollBalances() {
    try {
        if (!currentFilter) {
            const aggregated = sumFinancialByPrefix('budgetTrackerPayrollBalance');
            payrollBalanceData.first = aggregated.first;
            payrollBalanceData.second = aggregated.second;
            document.getElementById('firstPayrollBalance').value = payrollBalanceData.first || '';
            document.getElementById('secondPayrollBalance').value = payrollBalanceData.second || '';
            updateTotals('first');
            updateTotals('second');
            return;
        }

        const key = `budgetTrackerPayrollBalance_${currentFilter}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved);
            payrollBalanceData.first = parsed.first || 0;
            payrollBalanceData.second = parsed.second || 0;

            document.getElementById('firstPayrollBalance').value = payrollBalanceData.first || '';
            document.getElementById('secondPayrollBalance').value = payrollBalanceData.second || '';
        } else {
            payrollBalanceData.first = 0;
            payrollBalanceData.second = 0;
            document.getElementById('firstPayrollBalance').value = '';
            document.getElementById('secondPayrollBalance').value = '';
        }

        updateTotals('first');
        updateTotals('second');
    } catch (error) {
        console.error('Error loading payroll balances:', error);
    }
}

function saveCashMoney() {
    try {
        const month = currentFilter || getCurrentMonth();
        const key = `budgetTrackerCashMoney_${month}`;
        localStorage.setItem(key, JSON.stringify({ first: cashMoneyData.first, second: cashMoneyData.second }));
    } catch (error) {
        console.error('Error saving cash money:', error);
    }
}

function loadCashMoney() {
    try {
        if (!currentFilter) {
            const aggregated = sumFinancialByPrefix('budgetTrackerCashMoney');
            cashMoneyData.first = aggregated.first;
            cashMoneyData.second = aggregated.second;
            document.getElementById('firstCashMoney').value = cashMoneyData.first || '';
            document.getElementById('secondCashMoney').value = cashMoneyData.second || '';
            updateTotals('first');
            updateTotals('second');
            return;
        }

        const key = `budgetTrackerCashMoney_${currentFilter}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved);
            cashMoneyData.first = parsed.first || 0;
            cashMoneyData.second = parsed.second || 0;

            document.getElementById('firstCashMoney').value = cashMoneyData.first || '';
            document.getElementById('secondCashMoney').value = cashMoneyData.second || '';
        } else {
            cashMoneyData.first = 0;
            cashMoneyData.second = 0;
            document.getElementById('firstCashMoney').value = '';
            document.getElementById('secondCashMoney').value = '';
        }

        updateTotals('first');
        updateTotals('second');
    } catch (error) {
        console.error('Error loading cash money:', error);
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
    loadPayrollBalances();
    loadCashMoney();
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
    loadPayrollBalances();
    loadCashMoney();
    renderBothTables();
    saveSettings();
}

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

function initializePresets() {
    const saved = localStorage.getItem('budgetTrackerPresets');
    if (saved) {
        presets = JSON.parse(saved);
    } else {
        presets = {
            1: { name: "Essential Budget", first: [{ category: 'Groceries', budget: 8000 }, { category: 'Transportation', budget: 3000 }], second: [{ category: 'Entertainment', budget: 3000 }] },
            2: { name: "Student Budget", first: [{ category: 'Food', budget: 5000 }, { category: 'Transportation', budget: 2000 }], second: [{ category: 'Entertainment', budget: 1500 }] },
            3: { name: "Family Budget", first: [{ category: 'Groceries', budget: 12000 }, { category: 'Utilities', budget: 4000 }], second: [{ category: 'Kids Activities', budget: 3000 }] },
            4: { name: "Minimalist Budget", first: [{ category: 'Food', budget: 6000 }, { category: 'Rent', budget: 12000 }], second: [{ category: 'Savings', budget: 15000 }] },
            5: { name: "Custom Preset", first: [{ category: 'Category 1', budget: 1000 }], second: [{ category: 'Category A', budget: 1000 }] }
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
        budgetData.first.push({ id: generateId(), category: item.category, date: defaultDate, budget: item.budget, expenses: [], type: item.type || inferCategoryType(item.category) });
    });
    preset.second.forEach(item => {
        budgetData.second.push({ id: generateId(), category: item.category, date: defaultDate, budget: item.budget, expenses: [], type: item.type || inferCategoryType(item.category) });
    });

    saveData();
    renderBothTables();
}

function openPresetManager() {
    currentEditingPreset = 1;
    document.getElementById('presetSelect').value = '1';
    loadPresetForEditing();
    document.getElementById('presetModal').style.display = 'block';
}

function loadPresetForEditing() {
    currentEditingPreset = parseInt(document.getElementById('presetSelect').value, 10);
    const preset = presets[currentEditingPreset];
    if (!preset) return;

    document.getElementById('presetName').value = preset.name;

    const firstContainer = document.getElementById('firstPresetCategories');
    firstContainer.innerHTML = '';
    preset.first.forEach((item, index) => addPresetCategoryField('first', item.category, item.budget, index));

    const secondContainer = document.getElementById('secondPresetCategories');
    secondContainer.innerHTML = '';
    preset.second.forEach((item, index) => addPresetCategoryField('second', item.category, item.budget, index));
}

function addPresetCategory(tableType) {
    const container = document.getElementById(tableType + 'PresetCategories');
    const index = container.children.length;
    addPresetCategoryField(tableType, 'New Category', 1000, index);
}

function addPresetCategoryField(tableType, category, budget, index) {
    const container = document.getElementById(tableType + 'PresetCategories');
    const div = document.createElement('div');
    div.className = 'preset-category-row';
    div.innerHTML = `
        <input type="text" value="${category}" placeholder="Category name" class="preset-category-name">
        <input type="number" value="${budget}" placeholder="Budget" class="preset-category-budget" step="0.01">
        <button onclick="this.parentElement.remove()" class="preset-remove-btn">Remove</button>
    `;
    container.appendChild(div);
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
    
    // Collect first cutoff categories
    const firstContainer = document.getElementById('firstPresetCategories');
    const firstCategories = [];
    Array.from(firstContainer.children).forEach(div => {
        const inputs = div.querySelectorAll('input');
        const category = inputs[0].value.trim();
        const budget = parseFloat(inputs[1].value) || 0;
        if (category) {
            firstCategories.push({ category, budget });
        }
    });
    
    // Collect second cutoff categories
    const secondContainer = document.getElementById('secondPresetCategories');
    const secondCategories = [];
    Array.from(secondContainer.children).forEach(div => {
        const inputs = div.querySelectorAll('input');
        const category = inputs[0].value.trim();
        const budget = parseFloat(inputs[1].value) || 0;
        if (category) {
            secondCategories.push({ category, budget });
        }
    });
    
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
            1: { name: "Essential Budget", first: [{ category: 'Groceries', budget: 8000 }, { category: 'Transportation', budget: 3000 }], second: [{ category: 'Entertainment', budget: 3000 }] },
            2: { name: "Student Budget", first: [{ category: 'Food', budget: 5000 }, { category: 'Transportation', budget: 2000 }], second: [{ category: 'Entertainment', budget: 1500 }] },
            3: { name: "Family Budget", first: [{ category: 'Groceries', budget: 12000 }, { category: 'Utilities', budget: 4000 }], second: [{ category: 'Kids Activities', budget: 3000 }] },
            4: { name: "Minimalist Budget", first: [{ category: 'Food', budget: 6000 }, { category: 'Rent', budget: 12000 }], second: [{ category: 'Savings', budget: 15000 }] },
            5: { name: "Custom Preset", first: [{ category: 'Category 1', budget: 1000 }], second: [{ category: 'Category A', budget: 1000 }] }
        };
        
        presets[currentEditingPreset] = defaultPresets[currentEditingPreset];
        loadPresetForEditing();
        savePresets();
        updatePresetButtonLabels();
    }
}

function updatePresetButtonLabels() {
    // Update button labels with preset names
    for (let i = 1; i <= 5; i++) {
        const button = document.getElementById(`presetBtn${i}`);
        if (button && presets[i]) {
            button.textContent = presets[i].name;
            button.title = presets[i].name; // Add tooltip for full name
        }
    }
}

function closePresetModal() {
    document.getElementById('presetModal').style.display = 'none';
}

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
        payrollBalanceData = { first: 0, second: 0 };
        cashMoneyData = { first: 0, second: 0 };
        
        // Clear localStorage - remove all budget tracker related keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            // Remove any budget tracker month keys and legacy/global keys
            if (key.startsWith('budgetTracker_') || key.startsWith('budgetTrackerSalary_') || key === 'budgetTrackerSalary' || key.startsWith('budgetTrackerPayrollBalance_') || key === 'budgetTrackerPayrollBalance' || key.startsWith('budgetTrackerCashMoney_') || key === 'budgetTrackerCashMoney' || key === 'budgetTrackerSettings' || key === 'budgetTrackerPresets') {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Reset UI
        document.getElementById('firstSalary').value = '';
        document.getElementById('secondSalary').value = '';
        document.getElementById('firstPayrollBalance').value = '';
        document.getElementById('secondPayrollBalance').value = '';
        document.getElementById('firstCashMoney').value = '';
        document.getElementById('secondCashMoney').value = '';
        currentFilter = null;
        document.getElementById('monthFilter').value = '';
        
        renderBothTables();
        alert('All data cleared successfully!');
    }
}

// Dark Mode Functionality
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
        toggleIcon.textContent = '☀️'; // Sun icon for light mode toggle
    }
    
    localStorage.setItem('darkMode', 'true');
}

function disableDarkMode() {
    const body = document.body;
    const toggleIcon = document.querySelector('.toggle-icon');
    
    body.classList.remove('dark-mode');
    if (toggleIcon) {
        toggleIcon.textContent = '🌙'; // Moon icon for dark mode toggle
    }
    
    localStorage.setItem('darkMode', 'false');
}










