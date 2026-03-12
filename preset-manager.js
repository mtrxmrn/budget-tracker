(function() {
    'use strict';

    const CATEGORY_TYPES = ['essential', 'lifestyle', 'sinking', 'savings', 'investing', 'debt'];
    const STORAGE_KEY = 'budgetTrackerPresets';
    const PRESET_AVG_NET_PAY_STORAGE_KEY = 'budgetTrackerPresetAverageNetPayPerCutoff';
    const ADVISOR_CONFIG_STORAGE_KEY = 'budgetTrackerAdvisorConfig';

    const DEFAULT_ALLOCATION_TARGETS = {
        essentials: 50,
        savings: 15,
        investing: 10,
        debt: 10,
        sinking: 10,
        lifestyle: 5
    };

    const DEFAULT_PRESETS = {
        1: { name: 'Essential Budget', first: [{ category: 'Groceries', budget: 8000, type: 'essential' }, { category: 'Transportation', budget: 3000, type: 'essential' }], second: [{ category: 'Entertainment', budget: 3000, type: 'lifestyle' }] },
        2: { name: 'Student Budget', first: [{ category: 'Food', budget: 5000, type: 'essential' }, { category: 'Transportation', budget: 2000, type: 'essential' }], second: [{ category: 'Entertainment', budget: 1500, type: 'lifestyle' }] },
        3: { name: 'Family Budget', first: [{ category: 'Groceries', budget: 12000, type: 'essential' }, { category: 'Utilities', budget: 4000, type: 'essential' }], second: [{ category: 'Kids Activities', budget: 3000, type: 'lifestyle' }] },
        4: { name: 'Minimalist Budget', first: [{ category: 'Food', budget: 6000, type: 'essential' }, { category: 'Rent', budget: 12000, type: 'essential' }], second: [{ category: 'Savings', budget: 15000, type: 'savings' }] },
        5: { name: 'Custom Preset', first: [{ category: 'Category 1', budget: 1000, type: 'essential' }], second: [{ category: 'Category A', budget: 1000, type: 'essential' }] }
    };

    const state = {
        presets: {},
        currentSlot: 1,
        allocationTargets: { ...DEFAULT_ALLOCATION_TARGETS }
    };

    function inferCategoryType(categoryName) {
        const text = (categoryName || '').toLowerCase();
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

    function mapTypeToAllocationGroup(type) {
        if (type === 'fixed' || type === 'essential') return 'essentials';
        if (type === 'savings') return 'savings';
        if (type === 'investing') return 'investing';
        if (type === 'debt') return 'debt';
        if (type === 'sinking') return 'sinking';
        return 'lifestyle';
    }

    function formatCurrency(value) {
        return `PHP ${(Number(value) || 0).toFixed(2)}`;
    }

    function buildTypeSelect(selectedType) {
        const select = document.createElement('select');
        select.className = 'pm-type';

        CATEGORY_TYPES.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = formatCategoryTypeLabel(type);
            if (type === selectedType) option.selected = true;
            select.appendChild(option);
        });

        return select;
    }

    function normalizePresetItems(items) {
        if (!Array.isArray(items)) return [];
        return items.map(item => {
            const category = (item && item.category ? item.category : '').toString();
            const budget = Number(item && item.budget) || 0;
            const type = CATEGORY_TYPES.includes(item && item.type) ? item.type : inferCategoryType(category);
            return { category, budget, type };
        }).filter(item => item.category);
    }

    function clonePreset(preset) {
        return {
            name: (preset && preset.name) ? String(preset.name) : 'Preset',
            first: normalizePresetItems(preset && preset.first),
            second: normalizePresetItems(preset && preset.second)
        };
    }

    function getPresetFromAnyShape(parsed, slot) {
        if (!parsed) return null;

        if (Array.isArray(parsed)) {
            return parsed[slot - 1] || null;
        }

        if (typeof parsed === 'object') {
            return parsed[slot] || parsed[String(slot)] || null;
        }

        return null;
    }

    function buildNormalizedPresetSet(parsed) {
        const result = {};

        for (let i = 1; i <= 5; i++) {
            const source = getPresetFromAnyShape(parsed, i) || DEFAULT_PRESETS[i];
            result[i] = clonePreset(source);
            if (!result[i].name || !result[i].name.trim()) {
                result[i].name = DEFAULT_PRESETS[i].name;
            }
        }

        return result;
    }

    function loadAllocationTargets() {
        state.allocationTargets = { ...DEFAULT_ALLOCATION_TARGETS };

        try {
            const raw = localStorage.getItem(ADVISOR_CONFIG_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);

            if (parsed && parsed.targets) {
                Object.keys(DEFAULT_ALLOCATION_TARGETS).forEach(key => {
                    const value = Number(parsed.targets[key]);
                    if (Number.isFinite(value) && value >= 0) {
                        state.allocationTargets[key] = value;
                    }
                });
                return;
            }

            const legacyMap = {
                essential: 'essentials',
                savings: 'savings',
                investing: 'investing',
                debt: 'debt',
                sinking: 'sinking',
                lifestyle: 'lifestyle'
            };

            Object.keys(legacyMap).forEach(key => {
                const value = Number(parsed && parsed[key] && parsed[key].target);
                if (Number.isFinite(value) && value >= 0) {
                    state.allocationTargets[legacyMap[key]] = value;
                }
            });
        } catch (error) {
            console.error('Error loading advisor config', error);
        }
    }

    function loadPresets() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                state.presets = buildNormalizedPresetSet(null);
                savePresets();
                return;
            }
            const parsed = JSON.parse(raw);
            state.presets = buildNormalizedPresetSet(parsed);
        } catch (error) {
            console.error('Error loading presets', error);
            state.presets = buildNormalizedPresetSet(null);
        }
    }

    function savePresets() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.presets));
    }

    function getAverageNetPay() {
        const input = document.getElementById('presetAverageNetPay');
        const value = Number(input ? input.value : 0);
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function loadAverageNetPay() {
        const input = document.getElementById('presetAverageNetPay');
        if (!input) return;
        const raw = localStorage.getItem(PRESET_AVG_NET_PAY_STORAGE_KEY);
        const value = Number(raw);
        input.value = Number.isFinite(value) && value > 0 ? String(value) : '';
    }

    function saveAverageNetPay() {
        const input = document.getElementById('presetAverageNetPay');
        if (!input) return;
        const value = Number(input.value);
        if (Number.isFinite(value) && value > 0) {
            localStorage.setItem(PRESET_AVG_NET_PAY_STORAGE_KEY, String(value));
        } else {
            localStorage.removeItem(PRESET_AVG_NET_PAY_STORAGE_KEY);
        }
    }

    function renderSlotList() {
        const list = document.getElementById('slotList');
        if (!list) return;

        list.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const preset = state.presets[i] || DEFAULT_PRESETS[i];
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `pm-slot-btn${i === state.currentSlot ? ' active' : ''}`;
            button.dataset.slot = String(i);
            button.innerHTML = `<div><span class="pm-slot-id">Slot ${i}</span><span class="pm-slot-name">${escapeHtml(preset.name)}</span></div><i class="fas fa-chevron-right"></i>`;
            button.addEventListener('click', () => {
                state.currentSlot = i;
                renderEditor();
            });
            list.appendChild(button);
        }
    }

    function createCategoryRow(item) {
        const row = document.createElement('div');
        row.className = 'pm-category-row';

        const drag = document.createElement('span');
        drag.className = 'drag-handle';
        drag.textContent = '::';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'pm-name';
        nameInput.placeholder = 'Category name';
        nameInput.value = item.category || '';

        const budgetInput = document.createElement('input');
        budgetInput.type = 'number';
        budgetInput.step = '0.01';
        budgetInput.min = '0';
        budgetInput.className = 'pm-budget';
        budgetInput.value = String(Number(item.budget) || 0);

        const typeSelect = buildTypeSelect(CATEGORY_TYPES.includes(item.type) ? item.type : inferCategoryType(item.category));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'pm-remove';
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => {
            row.remove();
            renderCharts();
        });

        [nameInput, budgetInput, typeSelect].forEach(element => {
            element.addEventListener('input', renderCharts);
            element.addEventListener('change', renderCharts);
        });

        row.appendChild(drag);
        row.appendChild(nameInput);
        row.appendChild(budgetInput);
        row.appendChild(typeSelect);
        row.appendChild(remove);

        return row;
    }

    function renderCategoryContainer(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        items.forEach(item => container.appendChild(createCategoryRow(item)));
    }

    function collectCategories(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];

        const result = [];
        Array.from(container.children).forEach(row => {
            const nameInput = row.querySelector('.pm-name');
            const budgetInput = row.querySelector('.pm-budget');
            const typeInput = row.querySelector('.pm-type');

            const category = (nameInput ? nameInput.value : '').trim();
            const budget = Number(budgetInput ? budgetInput.value : 0) || 0;
            const type = CATEGORY_TYPES.includes(typeInput ? typeInput.value : '') ? typeInput.value : inferCategoryType(category);

            if (category) result.push({ category, budget, type });
        });

        return result;
    }

    function summarizeByType(items) {
        const summary = {};
        items.forEach(item => {
            const type = CATEGORY_TYPES.includes(item.type) ? item.type : 'essential';
            summary[type] = (summary[type] || 0) + (Number(item.budget) || 0);
        });
        return summary;
    }

    function renderPieChart(canvasId, legendId, items) {
        const canvas = document.getElementById(canvasId);
        const legend = document.getElementById(legendId);
        if (!canvas || !legend) return;

        const summary = summarizeByType(items);
        const entries = Object.entries(summary).filter(([, value]) => value > 0);
        const total = entries.reduce((sum, [, value]) => sum + value, 0);
        const netPay = getAverageNetPay();
        const utilization = netPay > 0 ? (total / netPay) * 100 : 0;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!entries.length) {
            ctx.beginPath();
            ctx.fillStyle = '#d6e3f3';
            ctx.arc(canvas.width / 2, canvas.height / 2, 72, 0, Math.PI * 2);
            ctx.fill();
        } else {
            let start = -Math.PI / 2;
            entries.forEach(([type, amount]) => {
                const angle = (amount / total) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(canvas.width / 2, canvas.height / 2);
                ctx.arc(canvas.width / 2, canvas.height / 2, 72, start, start + angle);
                ctx.closePath();
                ctx.fillStyle = getTypeColor(type);
                ctx.fill();
                start += angle;
            });
        }

        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 34, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.fillStyle = '#1f3554';
        ctx.font = 'bold 12px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(netPay > 0 ? `${utilization.toFixed(0)}%` : formatCurrency(total), canvas.width / 2, canvas.height / 2 - 7);
        ctx.font = '10px Segoe UI';
        ctx.fillStyle = '#5a6f88';
        ctx.fillText('of net pay', canvas.width / 2, canvas.height / 2 + 10);

        const summaryLine = netPay > 0
            ? `<div class="pm-legend-summary">Total ${formatCurrency(total)} / Net ${formatCurrency(netPay)}</div>`
            : `<div class="pm-legend-summary">Total ${formatCurrency(total)}</div>`;

        legend.innerHTML = summaryLine + CATEGORY_TYPES.map(type => {
            const amount = Number(summary[type]) || 0;
            const group = mapTypeToAllocationGroup(type);
            const targetPct = Number(state.allocationTargets[group]) || 0;
            const pct = netPay > 0 ? (amount / netPay) * 100 : 0;
            return `<div class="pm-legend-item"><span class="pm-legend-dot" style="background:${getTypeColor(type)}"></span><span>${formatCategoryTypeLabel(type)} ${pct.toFixed(1)}% / ${targetPct.toFixed(1)}%</span></div>`;
        }).join('');
    }

    function renderCharts() {
        const first = collectCategories('firstPresetCategories');
        const second = collectCategories('secondPresetCategories');
        renderPieChart('firstPresetPie', 'firstPresetLegend', first);
        renderPieChart('secondPresetPie', 'secondPresetLegend', second);
    }

    function renderEditor() {
        const preset = state.presets[state.currentSlot] || DEFAULT_PRESETS[state.currentSlot];

        document.getElementById('presetSlotLabel').value = `Slot ${state.currentSlot}`;
        document.getElementById('presetName').value = preset.name || `Preset ${state.currentSlot}`;

        renderSlotList();
        renderCategoryContainer('firstPresetCategories', preset.first || []);
        renderCategoryContainer('secondPresetCategories', preset.second || []);

        initializeSortables();
        renderCharts();
    }

    function addCategory(tableType) {
        const containerId = tableType === 'first' ? 'firstPresetCategories' : 'secondPresetCategories';
        const container = document.getElementById(containerId);
        if (!container) return;

        container.appendChild(createCategoryRow({ category: 'New Category', budget: 1000, type: 'essential' }));
        renderCharts();
    }

    function mirrorFirstToSecond() {
        const source = collectCategories('firstPresetCategories');
        renderCategoryContainer('secondPresetCategories', source);
        initializeSortables();
        renderCharts();
    }

    function saveCurrentPreset() {
        const name = (document.getElementById('presetName').value || '').trim();
        if (!name) {
            alert('Please enter a preset name.');
            return;
        }

        const first = collectCategories('firstPresetCategories');
        const second = collectCategories('secondPresetCategories');

        state.presets[state.currentSlot] = {
            name,
            first,
            second
        };

        savePresets();
        saveAverageNetPay();
        renderSlotList();
        alert(`Preset ${state.currentSlot} saved.`);
    }

    function resetCurrentSlot() {
        if (!confirm('Reset this slot to default values?')) return;

        state.presets[state.currentSlot] = clonePreset(DEFAULT_PRESETS[state.currentSlot]);
        savePresets();
        renderEditor();
    }

    function initializeSortables() {
        const first = document.getElementById('firstPresetCategories');
        const second = document.getElementById('secondPresetCategories');
        const config = {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: renderCharts
        };

        if (first && !first.dataset.sortableBound && typeof Sortable !== 'undefined') {
            new Sortable(first, config);
            first.dataset.sortableBound = 'true';
        }

        if (second && !second.dataset.sortableBound && typeof Sortable !== 'undefined') {
            new Sortable(second, config);
            second.dataset.sortableBound = 'true';
        }
    }

    function bindEvents() {
        document.getElementById('savePresetBtn').addEventListener('click', saveCurrentPreset);
        document.getElementById('resetPresetBtn').addEventListener('click', resetCurrentSlot);
        document.getElementById('reloadPresetBtn').addEventListener('click', renderEditor);
        document.getElementById('addFirstBtn').addEventListener('click', () => addCategory('first'));
        document.getElementById('addSecondBtn').addEventListener('click', () => addCategory('second'));
        document.getElementById('mirrorBtn').addEventListener('click', mirrorFirstToSecond);

        const nameInput = document.getElementById('presetName');
        nameInput.addEventListener('input', renderSlotList);

        const netPayInput = document.getElementById('presetAverageNetPay');
        netPayInput.addEventListener('input', () => {
            saveAverageNetPay();
            renderCharts();
        });
        netPayInput.addEventListener('change', () => {
            saveAverageNetPay();
            renderCharts();
        });
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function init() {
        loadAllocationTargets();
        loadPresets();
        loadAverageNetPay();
        bindEvents();
        renderEditor();

        window.addEventListener('storage', event => {
            if (event.key === STORAGE_KEY || event.key === ADVISOR_CONFIG_STORAGE_KEY) {
                loadAllocationTargets();
                loadPresets();
                renderEditor();
            }
            if (event.key === PRESET_AVG_NET_PAY_STORAGE_KEY) {
                loadAverageNetPay();
                renderCharts();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
