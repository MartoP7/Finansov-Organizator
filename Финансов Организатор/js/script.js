
/* =====================================================
   ФИНАНСОВ ОРГАНИЗАТОР
   Main JavaScript
   Local storage version
===================================================== */

"use strict";


/* =====================================================
   1. ОСНОВНИ НАСТРОЙКИ И ДАННИ
===================================================== */

// const STORAGE_KEY = "financialOrganizerData_v1";



/* ==========================================
   АКТИВЕН ПОТРЕБИТЕЛ
========================================== */

const SESSION_KEY = "financialOrganizerCurrentUser";

const currentUser = JSON.parse(
    sessionStorage.getItem(SESSION_KEY) || "null"
);

if (!currentUser || !currentUser.id) {

    window.location.replace("login.html");

}

const STORAGE_KEY =
    "financialOrganizerData_v1_" + currentUser.id;



const MONTHS = [
    "Януари",
    "Февруари",
    "Март",
    "Април",
    "Май",
    "Юни",
    "Юли",
    "Август",
    "Септември",
    "Октомври",
    "Ноември",
    "Декември"
];

const TYPE_NAMES = {
    income: "Приход",
    expense: "Разход",
    transfer: "Прехвърляне",
    fund: "Вноска във фонд",
    refund: "Възстановена сума"
};

const CATEGORY_NAMES = {
    salary: "Заплата",
    food: "Храна",
    fuel: "Гориво",
    bills: "Сметки",
    shopping: "Покупки",
    entertainment: "Забавление",
    health: "Здраве",
    education: "Образование",
    other: "Други"
};

const currentDate = new Date();

let data = loadData();

syncCategoryNames();

let selectedYear = data.selectedYear;
let selectedMonth = data.selectedMonth;

let selectedRecordId = null;
let selectedAccountId = null;
let selectedFundId = null;

let editingAccountId = null;
let editingFundId = null;

let activeFilters = {
    type: "",
    account: "",
    status: "",
    category: ""
};

let confirmCallback = null;


let selectedCatalogItem = null;

let catalogEditorMode = "add";

let catalogPickerMode = "category";

let selectedCatalogPickerId = null;




function changeRecordStatus(active) {

    if (!selectedRecordId) {

        alert("Моля, избери запис.");
        return;
    }

    const record = data.records.find(
        item => item.id === selectedRecordId
    );

    if (!record) return;

    if (record.active === active) {

        alert(
            active
                ? "Записът вече е активен."
                : "Записът вече е неактивен."
        );

        return;
    }

    record.active = active;

    renderAll();
    saveData();

    setStatus(
        active
            ? "Записът е активиран."
            : "Записът е деактивиран."
    );
}





/* =====================================================
   2. НАЧАЛНИ ДАННИ
===================================================== */



/* =====================================================
   КАТАЛОЗИ: КАТЕГОРИИ, ИЗТОЧНИЦИ И ДОСТАВЧИЦИ
===================================================== */

function createDefaultCatalogs() {
    return {
        categories: Object.entries(CATEGORY_NAMES).map(([id, name]) => ({
            id,
            name,
            active: true,
            builtin: true,
            createdAt: new Date().toISOString()
        })),

        sources: [],
        suppliers: []
    };
}


function normalizeCatalogs(savedCatalogs) {
    const defaults = createDefaultCatalogs();

    if (!savedCatalogs || typeof savedCatalogs !== "object") {
        return defaults;
    }

    const categories = Array.isArray(savedCatalogs.categories)
        ? [...savedCatalogs.categories]
        : [];

    // Добавяме липсващи фабрични категории.
    defaults.categories.forEach(defaultCategory => {
        if (!categories.some(item => item.id === defaultCategory.id)) {
            categories.unshift(defaultCategory);
        }
    });

    return {
        categories,

        sources: Array.isArray(savedCatalogs.sources)
            ? savedCatalogs.sources
            : [],

        suppliers: Array.isArray(savedCatalogs.suppliers)
            ? savedCatalogs.suppliers
            : []
    };
}


// Добавяме персонализираните категории към стария речник.
// Така съществуващите справки и таблици ще продължат да работят.
function syncCategoryNames() {
    data.catalogs.categories.forEach(category => {
        CATEGORY_NAMES[category.id] = category.name;
    });
}


function getCatalogItems(type) {
    return data.catalogs[type] || [];
}


function getCatalogItem(type, id) {
    return getCatalogItems(type).find(item => item.id === id);
}


function getCatalogTypeName(type) {
    const names = {
        categories: "Категории",
        sources: "Източници",
        suppliers: "Доставчици"
    };

    return names[type] || "Данни";
}

function setRecordSourceLocked(locked) {

    const input = document.getElementById("recordSource");

    if (!input) return;

    input.readOnly = locked;

    input.classList.toggle("catalog-source-locked", locked);

    input.title = locked
        ? "Избрано е от запазените данни. Използвай бутона до полето, за да го смениш."
        : "Въведи източник или доставчик.";
}


function getSuggestedSourceType(recordType) {
    if (recordType === "expense") return "suppliers";

    return "sources";
}


function populateRecordCategorySelect(selectedId = "") {
    const select = document.getElementById("recordCategory");

    if (!select) return;

    select.innerHTML = '<option value="">Без категория</option>';

    const categories = data.catalogs.categories
        .filter(item => item.active || item.id === selectedId)
        .sort((a, b) => a.name.localeCompare(b.name, "bg"));

    categories.forEach(category => {
        const option = document.createElement("option");

        option.value = category.id;
        option.textContent = category.name;

        select.appendChild(option);
    });

    // Запазваме възможността за редакция на стар запис,
    // дори ако категорията му вече е изтрита от каталога.
    if (
        selectedId &&
        !categories.some(item => item.id === selectedId)
    ) {
        const option = document.createElement("option");

        option.value = selectedId;
        option.textContent = CATEGORY_NAMES[selectedId] || selectedId;

        select.appendChild(option);
    }

    select.value = selectedId;
}


/* =====================================================
   РЕНДЕРИРАНЕ НА ДЪРВОВИДНАТА СТРУКТУРА
===================================================== */

function renderCatalogManager() {

    const tree = document.getElementById("catalogTree");

    if (!tree) return;

    const search = document.getElementById("catalogManagerSearch")
        .value.trim().toLowerCase();


    function filterItems(items) {
        return items.filter(item =>
            !search || item.name.toLowerCase().includes(search)
        );
    }


    function renderNodes(type, items) {

    const filtered = filterItems(items);

    if (filtered.length === 0) {
        return search
            ? ""
            : '<li class="catalog-tree-empty">Няма записи.</li>';
    }

    return filtered.map(item => {

        const selected =
            selectedCatalogItem &&
            selectedCatalogItem.type === type &&
            selectedCatalogItem.id === item.id;

        const statusIcon = item.active
            ? "images/icons/check.png"
            : "images/icons/cross.png";

        return `
            <li>

                <button type="button"
                        class="catalog-tree-node ${selected ? "selected" : ""}"
                        data-type="${type}"
                        data-id="${escapeHTML(item.id)}">

                    <span class="catalog-tree-status">
                        <img src="${statusIcon}"
                             alt="${item.active ? "Активен" : "Неактивен"}">
                    </span>

                    <span>${escapeHTML(item.name)}</span>

                </button>

            </li>
        `;

    }).join("");
}

function renderGroup(type, label, items) {

    const filtered = filterItems(items);

    if (search && filtered.length === 0) {
        return "";
    }

    return `
        <li>

            <button type="button"
                    class="catalog-tree-group"
                    data-group-toggle>

                <img src="images/icons/folder.png"
                     class="catalog-tree-folder-icon"
                     alt="">

                <span>${label}</span>

            </button>

            <ul>
                ${renderNodes(type, items)}
            </ul>

        </li>
    `;
}
    

    const factoryCategories = data.catalogs.categories
        .filter(item => item.builtin);

    const customCategories = data.catalogs.categories
        .filter(item => !item.builtin);


    const factoryContent = renderNodes(
        "categories",
        factoryCategories
    );

    const personalizedContent = [
        renderGroup(
            "categories",
            "Категории",
            customCategories
        ),

        renderGroup(
            "sources",
            "Източници",
            data.catalogs.sources
        ),

        renderGroup(
            "suppliers",
            "Доставчици",
            data.catalogs.suppliers
        )

    ].join("");


    tree.innerHTML = `

        <li>

            <button type="button"
        class="catalog-tree-group"
        data-group-toggle>

    <img src="images/icons/folder.png"
         class="catalog-tree-folder-icon"
         alt="">

    <span>Фабрични категории</span>

</button>

            <ul>
                ${factoryContent || '<li class="catalog-tree-empty">Няма намерени категории.</li>'}
            </ul>

        </li>


        <li>

            <button type="button"
        class="catalog-tree-group"
        data-group-toggle>

    <img src="images/icons/folder.png"
         class="catalog-tree-folder-icon"
         alt="">

    <span>Персонализирани данни</span>

</button>

            <ul>
                ${personalizedContent || '<li class="catalog-tree-empty">Няма персонализирани записи.</li>'}
            </ul>

        </li>

    `;


    renderCatalogSelectionInfo();
}


/* =====================================================
   ИНФОРМАЦИЯ ЗА ИЗБРАНИЯ ЗАПИС
===================================================== */

function renderCatalogSelectionInfo() {

    const info = document.getElementById("catalogSelectionInfo");

    if (!info) return;

    if (!selectedCatalogItem) {

        info.innerHTML = `
            <div class="catalog-info-empty">
                <img src="images/icons/folder.png" alt="">
                <span>Избери запис от дървовидната структура.</span>
            </div>
        `;

        return;
    }

    const item = getCatalogItem(
        selectedCatalogItem.type,
        selectedCatalogItem.id
    );

    if (!item) {

        selectedCatalogItem = null;

        info.textContent = "Няма избран запис.";

        return;
    }

    const statusIcon = item.active
        ? "images/icons/check.png"
        : "images/icons/cross.png";

    const statusText = item.active
        ? "Активен"
        : "Неактивен";

    const typeName = getCatalogTypeName(selectedCatalogItem.type);

    const itemKind = item.builtin
        ? "Фабричен запис"
        : "Персонализиран запис";

    info.innerHTML = `

        <div class="catalog-info-heading">

            <img src="images/icons/catInfo.png" alt="">

            <span>${escapeHTML(item.name)}</span>

        </div>


        <div class="catalog-info-grid">

            <span class="catalog-info-label">
                Вид на записа:
            </span>

            <span class="catalog-info-value">
                ${escapeHTML(typeName)}
            </span>


            <span class="catalog-info-label">
                Наименование:
            </span>

            <span class="catalog-info-value">
                ${escapeHTML(item.name)}
            </span>


            <span class="catalog-info-label">
                Статус:
            </span>

            <span class="catalog-info-value catalog-info-status">

                <img src="${statusIcon}" alt="">

                ${statusText}

            </span>


            <span class="catalog-info-label">
                Произход:
            </span>

            <span class="catalog-info-value">
                ${itemKind}
            </span>

        </div>

    `;
}


/* =====================================================
   ИЗБОР НА ЕЛЕМЕНТ ОТ ДЪРВОТО
===================================================== */

function selectCatalogItem(type, id) {

    const item = getCatalogItem(type, id);

    if (!item) return;

    selectedCatalogItem = {
        type,
        id
    };

    document.getElementById("catalogEditorType").value = type;

    renderCatalogManager();
}


/* =====================================================
   ДОБАВЯНЕ НА НОВ ЗАПИС
===================================================== */

function startCatalogAdd() {

    catalogEditorMode = "add";

    const type = selectedCatalogItem
        ? selectedCatalogItem.type
        : document.getElementById("catalogEditorType").value;

    document.getElementById("catalogEditorType").value = type;

    document.getElementById("catalogEditorName").value = "";

    document.getElementById("catalogEditorTitle").textContent =
        "Добавяне на нов запис";

    document.getElementById("catalogSaveItemButton").innerHTML = `
        <img src="images/icons/check.png" alt="">
        Добави
    `;

    document.getElementById("catalogEditorName").focus();
}


/* =====================================================
   РЕДАКТИРАНЕ НА ЗАПИС
===================================================== */

function startCatalogEdit() {

    if (!selectedCatalogItem) {
        alert("Първо избери запис от дървото.");
        return;
    }

    const item = getCatalogItem(
        selectedCatalogItem.type,
        selectedCatalogItem.id
    );

    if (!item) return;

    if (item.builtin) {
        alert("Фабричните категории не могат да бъдат преименувани.");
        return;
    }

    catalogEditorMode = "edit";

    document.getElementById("catalogEditorType").value =
        selectedCatalogItem.type;

    document.getElementById("catalogEditorName").value =
        item.name;

    document.getElementById("catalogEditorTitle").textContent =
        "Редактиране на запис";

    document.getElementById("catalogSaveItemButton").innerHTML = `
        <img src="images/icons/check.png" alt="">
        Обнови
    `;

    document.getElementById("catalogEditorName").focus();
}


/* =====================================================
   ЗАПАЗВАНЕ НА КАТЕГОРИЯ / ИЗТОЧНИК / ДОСТАВЧИК
===================================================== */

function saveCatalogEditor() {

    const type = document.getElementById("catalogEditorType").value;

    const name = document.getElementById("catalogEditorName")
        .value.trim();

    if (!name) {
        alert("Въведи наименование.");
        return;
    }

    const items = getCatalogItems(type);

    const duplicate = items.find(item =>
        item.name.toLowerCase() === name.toLowerCase() &&
        (
            catalogEditorMode !== "edit" ||
            item.id !== selectedCatalogItem?.id
        )
    );

    if (duplicate) {
        alert("Вече съществува запис с това наименование.");
        return;
    }


    if (catalogEditorMode === "edit") {

        if (!selectedCatalogItem) return;

        const item = getCatalogItem(
            selectedCatalogItem.type,
            selectedCatalogItem.id
        );

        if (!item || item.builtin) return;

        item.name = name;
        item.updatedAt = new Date().toISOString();

    } else {

        const newItem = {
            id: createId(
                type === "categories"
                    ? "category"
                    : type === "sources"
                        ? "source"
                        : "supplier"
            ),

            name,
            active: true,
            builtin: false,
            createdAt: new Date().toISOString()
        };

        data.catalogs[type].push(newItem);

        selectedCatalogItem = {
            type,
            id: newItem.id
        };
    }


    syncCategoryNames();

    saveData();

    renderCatalogManager();

    populateRecordCategorySelect(
        document.getElementById("recordCategory")?.value || ""
    );

    document.getElementById("catalogEditorName").value = "";

    catalogEditorMode = "add";

    document.getElementById("catalogEditorTitle").textContent =
        "Нов запис";

    document.getElementById("catalogSaveItemButton").innerHTML = `
        <img src="images/icons/check.png" alt="">
        Запази
    `;

    setStatus("Данните са обновени.");
}


/* =====================================================
   АКТИВИРАНЕ И ДЕАКТИВИРАНЕ
===================================================== */

function changeCatalogItemStatus(active) {

    if (!selectedCatalogItem) {
        alert("Избери запис от дървото.");
        return;
    }

    const item = getCatalogItem(
        selectedCatalogItem.type,
        selectedCatalogItem.id
    );

    if (!item) return;

    if (item.active === active) {
        alert(active
            ? "Записът вече е активен."
            : "Записът вече е деактивиран."
        );
        return;
    }

    item.active = active;

    item.updatedAt = new Date().toISOString();

    saveData();

    renderCatalogManager();

    populateRecordCategorySelect(
        document.getElementById("recordCategory")?.value || ""
    );

    setStatus(
        active
            ? "Записът е активиран."
            : "Записът е деактивиран."
    );
}


/* =====================================================
   ИЗТРИВАНЕ
===================================================== */

function deleteCatalogItem() {

    if (!selectedCatalogItem) {
        alert("Избери запис от дървото.");
        return;
    }

    const { type, id } = selectedCatalogItem;

    const item = getCatalogItem(type, id);

    if (!item) return;

    if (item.builtin) {
        alert("Фабричните категории не могат да бъдат изтрити.");
        return;
    }


    // Не позволяваме изтриване на категория,
    // която вече се използва във финансови операции.

    if (
        type === "categories" &&
        data.records.some(record => record.category === id)
    ) {
        alert(
            "Тази категория се използва в съществуващи записи.\n" +
            "Можеш да я деактивираш, вместо да я изтриваш."
        );
        return;
    }


    // Същото правило важи за източниците и доставчиците.

    if (
        (type === "sources" || type === "suppliers") &&
        data.records.some(record =>
            record.source === item.name &&
            (
                record.sourceType === type ||
                !record.sourceType
            )
        )
    ) {
        alert(
            "Този запис се използва в съществуващи операции.\n" +
            "Можеш да го деактивираш, вместо да го изтриваш."
        );
        return;
    }


    if (!confirm(
        "Сигурен ли си, че искаш да изтриеш \"" +
        item.name + "\"?"
    )) {
        return;
    }


    data.catalogs[type] = data.catalogs[type].filter(
        entry => entry.id !== id
    );

    selectedCatalogItem = null;

    syncCategoryNames();

    saveData();

    renderCatalogManager();

    setStatus("Записът е изтрит.");
}


/* =====================================================
   ОТВАРЯНЕ НА ГЛАВНИЯ ПРОЗОРЕЦ
===================================================== */

function openCatalogManager() {

    selectedCatalogItem = null;

    document.getElementById("catalogManagerSearch").value = "";

    renderCatalogManager();

    openDialog("catalogManagerDialog");
}


/* =====================================================
   ПРОЗОРЕЦ ЗА ИЗБОР
===================================================== */

function openCatalogPicker(mode, initialType) {

    catalogPickerMode = mode;

    selectedCatalogPickerId = null;

    const typeSelect = document.getElementById("catalogPickerType");

    if (mode === "category") {

        typeSelect.value = "categories";
        typeSelect.disabled = true;

        document.getElementById("catalogPickerTitle").textContent =
            "Избор на категория";

        const currentSource =
    document.getElementById("recordSource").value.trim();

const matchingItem = getCatalogItems(typeSelect.value).find(
    item => item.name === currentSource
);

selectedCatalogPickerId = matchingItem
    ? matchingItem.id
    : null;

    } else {

        typeSelect.disabled = false;

        typeSelect.querySelector('option[value="categories"]').disabled = true;

        typeSelect.value =
            initialType || "sources";

        document.getElementById("catalogPickerTitle").textContent =
            "Избор на източник или доставчик";

        selectedCatalogPickerId =
            document.getElementById("recordSource").value || null;
    }

    document.getElementById("catalogPickerSearch").value = "";

    renderCatalogPicker();

    openDialog("catalogPickerDialog");
}


function renderCatalogPicker() {

    const type = document.getElementById("catalogPickerType").value;

    const search = document.getElementById("catalogPickerSearch")
        .value.trim().toLowerCase();

    const list = document.getElementById("catalogPickerList");

    const items = getCatalogItems(type)
        .filter(item =>
            item.active &&
            item.name.toLowerCase().includes(search)
        )
        .sort((a, b) => a.name.localeCompare(b.name, "bg"));


    if (items.length === 0) {

        list.innerHTML = `
            <div class="catalog-picker-empty">
                Няма намерени активни записи.
            </div>
        `;

        return;
    }


    list.innerHTML = items.map(item => {

        const selected = selectedCatalogPickerId === item.id;

        return `
    <button type="button"
            class="catalog-picker-item ${selected ? "selected" : ""}"
            data-picker-id="${escapeHTML(item.id)}">

        <img src="images/icons/catInfo.png"
             class="catalog-picker-document-icon"
             alt="">

        <span>${escapeHTML(item.name)}</span>

    </button>
`;

    }).join("");
}


function chooseCatalogPickerItem() {

    const type = document.getElementById("catalogPickerType").value;

    if (!selectedCatalogPickerId) {
        alert("Избери запис от списъка.");
        return;
    }

    const item = getCatalogItem(type, selectedCatalogPickerId);

    if (!item || !item.active) {
        alert("Избраният запис вече не е активен.");
        renderCatalogPicker();
        return;
    }


    if (catalogPickerMode === "category") {

        document.getElementById("recordCategory").value = item.id;

    } else {

        document.getElementById("recordSource").value = item.name;

        document.getElementById("recordSourceType").value = type;

        document.getElementById("recordSourceCatalogId").value = item.id;

        setRecordSourceLocked(true);
    }


    closeDialog("catalogPickerDialog");
}


/* =====================================================
   СВЪРЗВАНЕ НА СЪБИТИЯТА
===================================================== */

function initializeCatalogEvents() {

    // Главен прозорец

    document.getElementById("catalogManagerButton")
        .addEventListener("click", openCatalogManager);


    // Бутони до полетата

    document.getElementById("openCategoryPickerButton")
        .addEventListener("click", () => {
            openCatalogPicker("category", "categories");
        });


    document.getElementById("openSourcePickerButton")
        .addEventListener("click", () => {

            const recordType =
                document.getElementById("recordType").value;

            const currentType =
                document.getElementById("recordSourceType").value;

            openCatalogPicker(
                "source",
                currentType || getSuggestedSourceType(recordType)
            );

        });


    // Дървовидна структура

    document.getElementById("catalogTree")
        .addEventListener("click", event => {

            const groupButton = event.target.closest("[data-group-toggle]");

            if (groupButton) {

                groupButton.classList.toggle("collapsed");

                return;
            }

            const node = event.target.closest(".catalog-tree-node");

            if (!node) return;

            selectCatalogItem(
                node.dataset.type,
                node.dataset.id
            );

        });


    // Действия в главния прозорец

    document.getElementById("activateCatalogButton")
        .addEventListener("click", () => {
            changeCatalogItemStatus(true);
        });

    document.getElementById("deactivateCatalogButton")
        .addEventListener("click", () => {
            changeCatalogItemStatus(false);
        });

    document.getElementById("addCatalogItemButton")
        .addEventListener("click", startCatalogAdd);

    document.getElementById("editCatalogItemButton")
        .addEventListener("click", startCatalogEdit);

    document.getElementById("deleteCatalogItemButton")
        .addEventListener("click", deleteCatalogItem);

    document.getElementById("refreshCatalogButton")
        .addEventListener("click", () => {

            renderCatalogManager();

            setStatus("Дървото с данните е обновено.");
        });

    document.getElementById("searchCatalogButton")
    .addEventListener("click", () => {

        const searchInput =
            document.getElementById("catalogManagerSearch");

        searchInput.focus();

        searchInput.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });

    });


    document.getElementById("catalogManagerSearch")
        .addEventListener("input", renderCatalogManager);


    document.getElementById("catalogSaveItemButton")
        .addEventListener("click", saveCatalogEditor);


    document.getElementById("catalogCancelEditButton")
        .addEventListener("click", () => {

            catalogEditorMode = "add";

            document.getElementById("catalogEditorName").value = "";

            document.getElementById("catalogEditorTitle").textContent =
                "Нов запис";

            document.getElementById("catalogSaveItemButton").innerHTML = `
                <img src="images/icons/check.png" alt="">
                Запази
            `;

        });


    // Прозорец за избор

    document.getElementById("catalogPickerType")
        .addEventListener("change", () => {

            selectedCatalogPickerId = null;

            renderCatalogPicker();

        });


    document.getElementById("catalogPickerSearch")
        .addEventListener("input", renderCatalogPicker);


    document.getElementById("catalogPickerList")
        .addEventListener("click", event => {

            const button = event.target.closest("[data-picker-id]");

            if (!button) return;

            selectedCatalogPickerId = button.dataset.pickerId;

            renderCatalogPicker();

        });


    document.getElementById("catalogPickerChooseButton")
        .addEventListener("click", chooseCatalogPickerItem);


    document.getElementById("catalogPickerRefreshButton")
        .addEventListener("click", renderCatalogPicker);


    document.getElementById("catalogPickerManageButton")
        .addEventListener("click", () => {

            const type = document.getElementById("catalogPickerType").value;

            closeDialog("catalogPickerDialog");

            openCatalogManager();

            document.getElementById("catalogEditorType").value = type;

        });

}



function createInitialData() {

    return {
        version: 1,

        selectedYear: currentDate.getFullYear(),
        selectedMonth: currentDate.getMonth(),

        years: [
            {
                year: currentDate.getFullYear(),
                months: [...Array(12).keys()]
            }
        ],

        records: [],
        accounts: [],
        funds: [],

        catalogs: createDefaultCatalogs()
        };
}


/* =====================================================
   3. ЗАПАЗВАНЕ И ЗАРЕЖДАНЕ
===================================================== */

function loadData() {

    try {

        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return createInitialData();
        }

        const parsed = JSON.parse(saved);

        if (
            !parsed ||
            !Array.isArray(parsed.years) ||
            !Array.isArray(parsed.records) ||
            !Array.isArray(parsed.accounts) ||
            !Array.isArray(parsed.funds)
        ) {
            throw new Error("Невалидни запазени данни.");
        }

        return {
            ...createInitialData(),
            ...parsed,
            catalogs: normalizeCatalogs(parsed.catalogs)
        };

    } catch (error) {

        console.error("Грешка при зареждане:", error);

        alert(
            "Възникна проблем при зареждането на данните. " +
            "Проверете конзолата на браузъра."
        );

        return createInitialData();
    }
}


function saveData() {

    try {

        data.selectedYear = selectedYear;
        data.selectedMonth = selectedMonth;

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );

        setStatus("Данните са запазени.");

    } catch (error) {

        console.error("Грешка при запазване:", error);

        setStatus("Грешка при запазване на данните!");

        alert(
            "Неуспешно запазване! " +
            "Възможно е локалното хранилище да е запълнено."
        );
    }
}


/* =====================================================
   4. ПОМОЩНИ ФУНКЦИИ
===================================================== */

function createId(prefix) {

    return prefix + "_" +
        Date.now().toString(36) + "_" +
        Math.random().toString(36).substring(2, 8);
}


function todayString() {

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function formatMoney(value) {

    return Number(value || 0).toLocaleString("bg-BG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " €";
}


function formatDate(date) {

    if (!date) return "-";

    const parts = date.split("-");

    if (parts.length !== 3) return "-";

    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}


function getYearObject(year) {

    return data.years.find(item => item.year === Number(year));
}

function isSelectedPeriodArchived() {

    if (selectedYear === null || selectedMonth === null) {
        return false;
    }

    const yearObject = getYearObject(selectedYear);

    if (!yearObject) {
        return false;
    }

    // Ако цялата година е архивирана
    if (yearObject.archived === true) {
        return true;
    }

    // Ако конкретният месец е архивиран
    return Array.isArray(yearObject.archivedMonths) &&
        yearObject.archivedMonths.includes(Number(selectedMonth));
}


function updateRecordToolbarState() {

    const isArchived = isSelectedPeriodArchived();

    const buttonIds = [
        "activateRecordButton",
        "deactivateRecordButton",
        "addRecordButton",
        "editRecordButton",
        "deleteRecordButton"
    ];

    buttonIds.forEach(id => {

        const button = document.getElementById(id);

        if (button) {
            button.disabled = isArchived;
        }

    });
}

function getSelectedPeriodRecords() {

    if (selectedMonth === null) {
        return [];
    }

    return data.records.filter(record => {

        if (!record.date) return false;

        const parts = record.date.split("-");

        const accountingYear =
            record.accountingYear !== undefined
                ? Number(record.accountingYear)
                : Number(parts[0]);

        const accountingMonth =
            record.accountingMonth !== undefined
                ? Number(record.accountingMonth)
                : Number(parts[1]) - 1;

        return (
            accountingYear === Number(selectedYear) &&
            accountingMonth === Number(selectedMonth)
        );

    });
}



function getAccount(accountId) {

    return data.accounts.find(
        account => account.id === accountId
    );
}


function getFund(fundId) {

    return data.funds.find(
        fund => fund.id === fundId
    );
}


function getAccountName(accountId) {

    const account = getAccount(accountId);

    return account
        ? account.name
        : "Изтрита сметка";
}


function setStatus(message) {

    const element = document.getElementById("statusMessage");

    if (element) {
        element.textContent = message;
    }
}


function openDialog(id) {

    const dialog = document.getElementById(id);

    if (dialog && !dialog.open) {
        dialog.showModal();
    }
}


function closeDialog(id) {

    const dialog = document.getElementById(id);

    if (dialog && dialog.open) {
        dialog.close();
    }
}


function showConfirm(message, callback) {

    document.getElementById("confirmMessage").textContent = message;

    confirmCallback = callback;

    openDialog("confirmDialog");
}


function sortByDate(records) {

    return [...records].sort((a, b) =>
        b.date.localeCompare(a.date)
    );
}


/* =====================================================
   5. ФИНАНСОВИ ИЗЧИСЛЕНИЯ
===================================================== */

/*
    Баланс на сметка:

    Начална наличност
    + Приходи
    + Възстановени суми
    + Получени прехвърляния
    - Разходи
    - Изпратени прехвърляния
    - Вноски във фондове
*/


// function calculateAccountBalance(accountId) {

//     const account = getAccount(accountId);

//     if (!account) return 0;

//     let balance = Number(account.initialBalance || 0);

//     data.records.forEach(record => {

//         if (!record.active) return;

//         const amount = Number(record.amount || 0);

//         if (record.type === "income" || record.type === "refund") {

//             if (record.accountId === accountId) {
//                 balance += amount;
//             }

//         }

//         if (record.type === "expense" || record.type === "fund") {

//             if (record.accountId === accountId) {
//                 balance -= amount;
//             }

//         }

//         if (record.type === "transfer") {

//             if (record.accountId === accountId) {
//                 balance -= amount;
//             }

//             if (record.destinationAccountId === accountId) {
//                 balance += amount;
//             }

//         }

//     });

//     return balance;
// }
function calculateAccountBalance(accountId) {

    const account = getAccount(accountId);

    if (!account) return 0;

    let balance = Number(account.initialBalance || 0);

    data.records.forEach(record => {

        if (!record.active) return;

        const amount = Number(record.amount || 0);

        switch (record.type) {

            case "income":
            case "refund":

                if (record.accountId === accountId) {
                    balance += amount;
                }

                break;

            case "expense":
            case "fund":

                if (record.accountId === accountId) {
                    balance -= amount;
                }

                break;

            case "transfer":

                if (record.accountId === accountId) {
                    balance -= amount;
                }

                if (record.destinationAccountId === accountId) {
                    balance += amount;
                }

                break;
        }

    });

    return balance;
}


function calculateFundBalance(fundId) {

    const fund = getFund(fundId);

    if (!fund) return 0;

    let balance = Number(fund.initialAmount || 0);

    data.records.forEach(record => {

        if (
            record.active &&
            record.type === "fund" &&
            record.fundId === fundId
        ) {
            balance += Number(record.amount || 0);
        }

    });

    return balance;
}


function calculateMonthSummary() {

    const records = getSelectedPeriodRecords();

    let income = 0;
    let expenses = 0;
    let activeCount = 0;

    records.forEach(record => {

        if (!record.active) return;

        activeCount++;

        const amount = Number(record.amount || 0);

        if (record.type === "income" || record.type === "refund") {
            income += amount;
        }

        if (record.type === "expense" || record.type === "fund") {
            expenses += amount;
        }

    });

    return {
        income,
        expenses,
        balance: income - expenses,
        activeCount
    };
}


function calculateTotalAccounts() {

    return data.accounts.reduce((total, account) => {

        return total + calculateAccountBalance(account.id);

    }, 0);
}


function calculateTotalFunds() {

    return data.funds.reduce((total, fund) => {

        return total + calculateFundBalance(fund.id);

    }, 0);
}


/* =====================================================
   6. ГОДИНИ И МЕСЕЦИ
===================================================== */


/* ==========================================
   АРХИВИРАНЕ НА ГОДИНИ И МЕСЕЦИ
========================================== */

function isPeriodArchived(year, month) {
    const yearObject = getYearObject(year);

    if (!yearObject) return false;

    // Архивирана година заключва всичките си месеци
    if (yearObject.archived === true) {
        return true;
    }

    // Проверка за архивиран конкретен месец
    const archivedMonths = yearObject.archivedMonths || [];

    return month !== null &&
        archivedMonths.includes(month);
}


function getRecordAccountingPeriod(record) {
    const date = record.date || "";

    return {
        year: Number(
            record.accountingYear || date.slice(0, 4)
        ),
        month: record.accountingMonth !== undefined &&
               record.accountingMonth !== null
            ? Number(record.accountingMonth)
            : Number(date.slice(5, 7)) - 1
    };
}

function showArchiveConfirmation(title, message, onConfirm) {

    // Премахване на предишен прозорец, ако има такъв
    document.getElementById("archiveConfirmDialog")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "archiveConfirmDialog";
    overlay.className = "dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "dialog-window archive-confirm-window";

    const titleBar = document.createElement("div");
    titleBar.className = "dialog-titlebar";

    const titleText = document.createElement("span");
    titleText.textContent = title;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "dialog-close";
    closeButton.textContent = "×";
    

    titleBar.append(titleText, closeButton);

    const content = document.createElement("div");
    content.className = "dialog-content";

    const messageContainer = document.createElement("div");
    messageContainer.className = "archive-confirm-message";

    const icon = document.createElement("img");
    icon.className = "archive-confirm-icon";
    icon.src = title.includes("Разархивиране") ? "images/icons/unlock.png" : "images/icons/lock.png";

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    messageContainer.append(icon, paragraph);

    const actions = document.createElement("div");
    actions.className = "dialog-actions";

    const yesButton = document.createElement("button");
    yesButton.type = "button";
    yesButton.className = "win-button";
    yesButton.textContent = "Да";

    const noButton = document.createElement("button");
    noButton.type = "button";
    noButton.className = "win-button";
    noButton.textContent = "Не";

    actions.append(yesButton, noButton);

    content.append(messageContainer, actions);
    dialog.append(titleBar, content);
    overlay.appendChild(dialog);

    document.body.appendChild(overlay);

    function closeDialog() {
        overlay.remove();
    }

    closeButton.addEventListener("click", closeDialog);
    noButton.addEventListener("click", closeDialog);
    closeButton.focus();

    yesButton.addEventListener("click", () => {
        closeDialog();
        onConfirm();
    });

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            closeDialog();
        }
    });
}


function toggleYearArchive(year) {

    const yearObject = getYearObject(year);

    if (!yearObject) return;

    const isArchived = yearObject.archived === true;

    showArchiveConfirmation(
        isArchived ? "Разархивиране на година" : "Архивиране на година",

        isArchived
            ? `Сигурен ли си, че искаш да разархивираш цялата година ${year}?`
            : `Сигурен ли си, че искаш да архивираш цялата година ${year}? Всички нейни месеци ще бъдат заключени.`,

        () => {

            yearObject.archived = !isArchived;

            renderAll();
            saveData();

            setStatus(
                isArchived
                    ? `Година ${year} е разархивирана.`
                    : `Година ${year} е архивирана.`
            );
        }
    );
}


function toggleMonthArchive(year, month) {

    const yearObject = getYearObject(year);

    if (!yearObject) return;

    if (yearObject.archived) {
        alert("Първо разархивирай годината, за да промениш архива на месеца.");
        return;
    }

    if (!Array.isArray(yearObject.archivedMonths)) {
        yearObject.archivedMonths = [];
    }

    const isArchived = yearObject.archivedMonths.includes(month);

    showArchiveConfirmation(
        isArchived ? "Разархивиране на месец" : "Архивиране на месец",

        isArchived
            ? `Сигурен ли си, че искаш да разархивираш ${MONTHS[month]} ${year}?`
            : `Сигурен ли си, че искаш да архивираш ${MONTHS[month]} ${year}?`,

        () => {

            const index = yearObject.archivedMonths.indexOf(month);

            if (index === -1) {
                yearObject.archivedMonths.push(month);
            } else {
                yearObject.archivedMonths.splice(index, 1);
            }

            renderAll();
            saveData();

            setStatus(
                isArchived
                    ? `${MONTHS[month]} ${year} е разархивиран.`
                    : `${MONTHS[month]} ${year} е архивиран.`
            );
        }
    );
}





/* =====================================================
   АРХИВ - ПЪЛНОФУНКЦИОНАЛЕН МОДУЛ
===================================================== */

let selectedArchivePeriod = null;

/* -----------------------------------------
   ПОМОЩНИ ФУНКЦИИ
----------------------------------------- */

function getArchiveRecords(year, month = null) {

    return data.records.filter(record => {

        const period = getRecordAccountingPeriod(record);

        return (
            period.year === Number(year) &&
            (month === null || period.month === Number(month))
        );

    });
}


function getArchivePeriodName(year, month = null) {

    return month === null
        ? `${year} година`
        : `${MONTHS[month]} ${year}`;
}


function getArchivePeriods() {

    const periods = [];

    [...data.years]
        .sort((a, b) => b.year - a.year)
        .forEach(yearObject => {

            const year = Number(yearObject.year);

            if (yearObject.archived === true) {

                periods.push({
                    year,
                    month: null,
                    key: `${year}-all`,
                    name: getArchivePeriodName(year),
                    type: "year"
                });

                return;
            }

            const archivedMonths = [
                ...new Set(yearObject.archivedMonths || [])
            ]
                .filter(month =>
                    Number.isInteger(month) &&
                    month >= 0 &&
                    month <= 11 &&
                    yearObject.months.includes(month)
                )
                .sort((a, b) => a - b);

            archivedMonths.forEach(month => {

                periods.push({
                    year,
                    month,
                    key: `${year}-${month}`,
                    name: getArchivePeriodName(year, month),
                    type: "month"
                });

            });

        });

    return periods;
}


function calculateArchiveSummary(records) {

    let income = 0;
    let expenses = 0;
    let transfers = 0;
    let fundContributions = 0;
    let activeCount = 0;
    let inactiveCount = 0;

    records.forEach(record => {

        if (!record.active) {
            inactiveCount++;
            return;
        }

        activeCount++;

        const amount = Number(record.amount || 0);

        if (
            record.type === "income" ||
            record.type === "refund"
        ) {
            income += amount;
        }

        if (record.type === "expense") {
            expenses += amount;
        }

        if (record.type === "fund") {
            expenses += amount;
            fundContributions += amount;
        }

        if (record.type === "transfer") {
            transfers += amount;
        }

    });

    return {
        income,
        expenses,
        balance: income - expenses,
        transfers,
        fundContributions,
        activeCount,
        inactiveCount,
        totalCount: records.length
    };
}


function getArchiveCategoryTotals(records) {

    const totals = {};

    records.forEach(record => {

        if (!record.active || record.type !== "expense") {
            return;
        }

        const category =
            CATEGORY_NAMES[record.category] || "Други";

        totals[category] =
            (totals[category] || 0) +
            Number(record.amount || 0);

    });

    return Object.entries(totals)
        .sort((a, b) => b[1] - a[1]);
}


/* -----------------------------------------
   СМЕТКИ - СПРАВКА ЗА ПЕРИОДА
----------------------------------------- */

function getArchiveAccountReports(records) {

    return data.accounts.map(account => {

        let income = 0;
        let expenses = 0;
        let transfersIn = 0;
        let transfersOut = 0;
        let fundPayments = 0;

        records.forEach(record => {

            if (!record.active) return;

            const amount = Number(record.amount || 0);

            if (
                record.accountId === account.id &&
                (record.type === "income" || record.type === "refund")
            ) {
                income += amount;
            }

            if (
                record.accountId === account.id &&
                record.type === "expense"
            ) {
                expenses += amount;
            }

            if (
                record.accountId === account.id &&
                record.type === "fund"
            ) {
                fundPayments += amount;
            }

            if (record.type === "transfer") {

                if (record.accountId === account.id) {
                    transfersOut += amount;
                }

                if (record.destinationAccountId === account.id) {
                    transfersIn += amount;
                }

            }

        });

        return {
            name: account.name,
            number: account.number,
            income,
            expenses,
            fundPayments,
            transfersIn,
            transfersOut,
            change:
                income +
                transfersIn -
                expenses -
                fundPayments -
                transfersOut
        };

    }).filter(account =>
        account.income !== 0 ||
        account.expenses !== 0 ||
        account.fundPayments !== 0 ||
        account.transfersIn !== 0 ||
        account.transfersOut !== 0
    );

}


/* -----------------------------------------
   ФОНДОВЕ - СПРАВКА ЗА ПЕРИОДА
----------------------------------------- */

function getArchiveFundReports(records) {

    return data.funds.map(fund => {

        const contributions = records.filter(record =>
            record.active &&
            record.type === "fund" &&
            record.fundId === fund.id
        );

        const total = contributions.reduce(
            (sum, record) => sum + Number(record.amount || 0),
            0
        );

        return {
            name: fund.name,
            number: fund.number,
            target: Number(fund.target || 0),
            contributions: total,
            currentBalance: calculateFundBalance(fund.id),
            remaining: Math.max(
                0,
                Number(fund.target || 0) - calculateFundBalance(fund.id)
            ),
            count: contributions.length
        };

    }).filter(fund =>
        fund.contributions > 0 ||
        fund.currentBalance > 0
    );

}


/* -----------------------------------------
   СЪЗДАВАНЕ НА АРХИВНИЯ СПИСЪК
----------------------------------------- */

function renderArchivePeriods() {

    const list = document.getElementById("archivePeriodsList");

    if (!list) return;

    const periods = getArchivePeriods();

    list.innerHTML = "";

    const yearsCount = document.getElementById("archiveYearsCount");
    const monthsCount = document.getElementById("archiveMonthsCount");
    const recordsCount = document.getElementById("archiveRecordsCount");
    const listInfo = document.getElementById("archiveListInfo");
    const message = document.getElementById("archiveMessage");

    let yearCount = 0;
    let monthCount = 0;
    let recordCount = 0;

    periods.forEach(period => {

        const records = getArchiveRecords(
            period.year,
            period.month
        );

        recordCount += records.length;

        if (period.type === "year") {
            yearCount++;
        } else {
            monthCount++;
        }

        const row = document.createElement("div");

        row.className = "archive-period-row";

        row.dataset.archiveKey = period.key;

        if (
            selectedArchivePeriod &&
            selectedArchivePeriod.key === period.key
        ) {
            row.classList.add("selected");
        }

        const icon = document.createElement("img");

        icon.src = "images/icons/lock.png";
        icon.alt = "";

        const name = document.createElement("span");

        name.className = "archive-period-name";
        name.textContent = period.name;

        const count = document.createElement("span");

        count.className = "archive-period-records";
        count.textContent =
            `${records.length} ${records.length === 1 ? "запис" : "записа"}`;

        // const status = document.createElement("span");

        // status.className = "archive-period-status";
        // status.textContent = "АРХИВИРАН";

        row.append(icon, name, count);

        list.appendChild(row);

    });

    if (yearsCount) yearsCount.textContent = yearCount;
    if (monthsCount) monthsCount.textContent = monthCount;
    if (recordsCount) recordsCount.textContent = recordCount;

    if (listInfo) {
        listInfo.textContent =
            `${periods.length} архивирани периода`;
    }

    if (message) {
        message.textContent = "";
    }

    if (periods.length === 0) {

        const empty = document.createElement("div");

        empty.className = "archive-empty";

        const title = document.createElement("strong");
        title.textContent = "Няма архивирани периоди";

        const description = document.createElement("span");
        description.textContent =
            "Архивираните години и месеци ще се показват тук.";

        empty.append(title, description);

        list.appendChild(empty);

        if (listInfo) {
            listInfo.textContent = "Няма архиви";
        }

        selectedArchivePeriod = null;
        renderArchiveDetails();

    } else {

        if (
            !selectedArchivePeriod ||
            !periods.some(period =>
                period.key === selectedArchivePeriod.key
            )
        ) {
            selectedArchivePeriod = periods[0];
        }

        renderArchiveDetails();

    }

    // Делегирано събитие за избиране на архив
    list.onclick = event => {

        const row = event.target.closest(".archive-period-row");

        if (!row) return;

        const period = periods.find(item =>
            item.key === row.dataset.archiveKey
        );

        if (!period) return;

        selectedArchivePeriod = period;

        renderArchivePeriods();

    };

}


/* -----------------------------------------
   СЪЗДАВАНЕ НА ПАНЕЛА ЗА ПОДРОБЕН ОТЧЕТ
----------------------------------------- */

function getArchiveDetailsContainer() {

    const list = document.getElementById("archivePeriodsList");

    if (!list) return null;

    let panel = document.getElementById("archiveDetailsPanel");

    if (!panel) {

        panel = document.createElement("div");

        panel.id = "archiveDetailsPanel";
        panel.className = "archive-details-panel";

        list.insertAdjacentElement("afterend", panel);

    }

    return panel;

}


/* -----------------------------------------
   ПОДРОБЕН АРХИВЕН ОТЧЕТ
----------------------------------------- */

function renderArchiveDetails() {

    const panel = getArchiveDetailsContainer();

    if (!panel) return;

    if (!selectedArchivePeriod) {

        panel.innerHTML =
            '<p class="archive-no-selection">Избери архивиран период.</p>';

        return;
    }

    const period = selectedArchivePeriod;

    const records = sortByDate(
    getArchiveRecords(period.year, period.month)
    ).reverse();

    const summary = calculateArchiveSummary(records);

    const categories = getArchiveCategoryTotals(records);

    const accounts = getArchiveAccountReports(records);

    const funds = getArchiveFundReports(records);

    const categoryMaximum = Math.max(
        1,
        ...categories.map(item => item[1])
    );

    const recordRows = records.map(record => {

        const accountName = getAccountName(record.accountId);

        const destination = record.destinationAccountId
            ? " → " + getAccountName(record.destinationAccountId)
            : "";

        return `
            <tr>
                <td>${record.active ? "✓" : "✕"}</td>
                <td>${escapeHTML(TYPE_NAMES[record.type] || record.type)}</td>
                <td>${escapeHTML(formatDate(record.date))}</td>
                <td>${escapeHTML(formatMoney(record.amount))}</td>
                <td>${escapeHTML(accountName + destination)}</td>
                <td>${escapeHTML(CATEGORY_NAMES[record.category] || "-")}</td>
                <td>${escapeHTML(record.source || "-")}</td>
                <td>${escapeHTML(record.description || "-")}</td>
            </tr>
        `;

    }).join("");

    const categoryRows = categories.length
        ? categories.map(([name, amount]) => {

            const width = amount / categoryMaximum * 100;

            return `
                <div class="archive-chart-row">
                    <div class="archive-chart-label">
                        <span>${escapeHTML(name)}</span>
                        <strong>${escapeHTML(formatMoney(amount))}</strong>
                    </div>

                    <div class="archive-chart-track">
                        <div class="archive-chart-bar"
                             style="width:${width}%"></div>
                    </div>
                </div>
            `;

        }).join("")
        : "<p>Няма активни разходи по категории.</p>";

    const accountRows = accounts.length
        ? accounts.map(account => `
            <tr>
                <td>${escapeHTML(account.number)}</td>
                <td>${escapeHTML(account.name)}</td>
                <td>${escapeHTML(formatMoney(account.income))}</td>
                <td>${escapeHTML(formatMoney(account.expenses))}</td>
                <td>${escapeHTML(formatMoney(account.transfersIn))}</td>
                <td>${escapeHTML(formatMoney(account.transfersOut))}</td>
                <td>${escapeHTML(formatMoney(account.fundPayments))}</td>
                <td>${escapeHTML(formatMoney(account.change))}</td>
            </tr>
        `).join("")
        : '<tr><td colspan="8">Няма движения по сметки за периода.</td></tr>';

    const fundRows = funds.length
        ? funds.map(fund => `
            <tr>
                <td>${escapeHTML(fund.number)}</td>
                <td>${escapeHTML(fund.name)}</td>
                <td>${escapeHTML(formatMoney(fund.contributions))}</td>
                <td>${fund.count}</td>
                <td>${escapeHTML(formatMoney(fund.currentBalance))}</td>
                <td>${escapeHTML(formatMoney(fund.remaining))}</td>
            </tr>
        `).join("")
        : '<tr><td colspan="6">Няма вноски във фондове за периода.</td></tr>';

    const comparisonOptions = getArchivePeriods()
        .filter(item => item.key !== period.key)
        .map(item => `
            <option value="${escapeHTML(item.key)}">
                ${escapeHTML(item.name)}
            </option>
        `).join("");

    panel.innerHTML = `

        <div class="archive-detail-heading">

            <div>
                <h3>${escapeHTML(period.name)}</h3>
                <p>Подробен финансов отчет на периода</p>
            </div>

            <div class="archive-detail-actions">

                <button type="button" id="archiveExportCSV">
                    <div class="archive-panel-btn-cont">
                        <img src="images/icons/csv.png" class="archive-panel-btn-icon">
                        Експорт CSV
                    </div>
                </button>

                <button type="button" id="archiveExportPDF">
                <div class="archive-panel-btn-cont">
                        <img src="images/icons/pdf.png" class="archive-panel-btn-icon">
                        Експорт PDF
                    </div>
                </button>

                <button type="button" id="archiveRestoreButton">
                    <div class="archive-panel-btn-cont">
                        <img src="images/icons/refresh.png" class="archive-panel-btn-icon">
                        Възстановяване
                    </div>
                </button>

            </div>

        </div>

        <div class="archive-section">

            <h4>Общи финансови показатели</h4>

            <div class="archive-stat-grid">

                <div class="archive-stat">
                    <span>Приходи</span>
                    <strong>${escapeHTML(formatMoney(summary.income))}</strong>
                </div>

                <div class="archive-stat">
                    <span>Разходи</span>
                    <strong>${escapeHTML(formatMoney(summary.expenses))}</strong>
                </div>

                <div class="archive-stat">
                    <span>Баланс</span>
                    <strong>${escapeHTML(formatMoney(summary.balance))}</strong>
                </div>

                <div class="archive-stat">
                    <span>Прехвърляния</span>
                    <strong>${escapeHTML(formatMoney(summary.transfers))}</strong>
                </div>

                <div class="archive-stat">
                    <span>Вноски във фондове</span>
                    <strong>${escapeHTML(formatMoney(summary.fundContributions))}</strong>
                </div>

                <div class="archive-stat">
                    <span>Активни записи</span>
                    <strong>${summary.activeCount}</strong>
                </div>

                <div class="archive-stat">
                    <span>Неактивни записи</span>
                    <strong>${summary.inactiveCount}</strong>
                </div>

                <div class="archive-stat">
                    <span>Общо записи</span>
                    <strong>${summary.totalCount}</strong>
                </div>

            </div>

        </div>

        <div class="archive-section">

            <h4>Графики и категории</h4>

            <h5>Разходи по категории</h5>

            <div class="archive-chart">
                ${categoryRows}
            </div>

        </div>

        <div class="archive-section">

            <h4>Справки по сметки</h4>

            <div class="archive-table-wrapper">

                <table class="archive-report-table">

                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Сметка</th>
                            <th>Приходи</th>
                            <th>Разходи</th>
                            <th>Получени</th>
                            <th>Изпратени</th>
                            <th>Към фондове</th>
                            <th>Нетна промяна</th>
                        </tr>
                    </thead>

                    <tbody>${accountRows}</tbody>

                </table>

            </div>

        </div>

        <div class="archive-section">

            <h4>Справки по фондове</h4>

            <div class="archive-table-wrapper">

                <table class="archive-report-table">

                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Фонд</th>
                            <th>Вноски за периода</th>
                            <th>Брой вноски</th>
                            <th>Текущ баланс</th>
                            <th>До целта</th>
                        </tr>
                    </thead>

                    <tbody>${fundRows}</tbody>

                </table>

            </div>

            <p class="archive-note">
                Текущият баланс на фонда включва всички негови активни вноски,
                а не само тези от архивирания период.
            </p>

        </div>

        <div class="archive-section">

            <h4>Сравнение между периоди</h4>

            <div class="archive-compare-controls">

                <select id="archiveCompareSelect">
                    <option value="">Избери друг архивиран период...</option>
                    ${comparisonOptions}
                </select>

                <button type="button" id="archiveCompareButton">
                    <div class="archive-panel-btn-cont">
                        <img src="images/icons/compare.png" class="archive-panel-btn-icon">
                        Сравни
                    </div>
                </button>

            </div>

            <div id="archiveCompareResult"></div>

        </div>

        <div class="archive-section">

            <h4>Всички финансови записи</h4>

            <div class="archive-table-wrapper">

                <table class="archive-report-table">

                    <thead>
                        <tr>
                            <th>Статус</th>
                            <th>Вид</th>
                            <th>Дата</th>
                            <th>Сума</th>
                            <th>Сметка</th>
                            <th>Категория</th>
                            <th>Източник</th>
                            <th>Описание</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${recordRows ||
                            '<tr><td colspan="8">Няма записи в този период.</td></tr>'}
                    </tbody>

                </table>

            </div>

        </div>

    `;

    // Събития за бутоните

    document.getElementById("archiveExportCSV")
        .addEventListener("click", exportArchiveCSV);

    document.getElementById("archiveExportPDF")
        .addEventListener("click", exportArchivePDF);

    document.getElementById("archiveRestoreButton")
        .addEventListener("click", restoreSelectedArchive);

    document.getElementById("archiveCompareButton")
        .addEventListener("click", compareArchivePeriods);

}


/* -----------------------------------------
   СРАВНЕНИЕ НА ДВА АРХИВИРАНИ ПЕРИОДА
----------------------------------------- */

function compareArchivePeriods() {

    const select = document.getElementById("archiveCompareSelect");

    const result = document.getElementById("archiveCompareResult");

    if (!select || !result) return;

    const secondPeriod = getArchivePeriods().find(
        item => item.key === select.value
    );

    if (!secondPeriod) {

        result.textContent = "Избери период за сравнение.";

        return;
    }

    const firstRecords = getArchiveRecords(
        selectedArchivePeriod.year,
        selectedArchivePeriod.month
    );

    const secondRecords = getArchiveRecords(
        secondPeriod.year,
        secondPeriod.month
    );

    const first = calculateArchiveSummary(firstRecords);

    const second = calculateArchiveSummary(secondRecords);

    function difference(a, b) {

        const value = a - b;

        const sign = value > 0 ? "+" : "";

        return sign + formatMoney(value);

    }

    result.innerHTML = `

        <div class="archive-compare-grid">

            <div>
                <h5>${escapeHTML(selectedArchivePeriod.name)}</h5>
                <p>Приходи: ${escapeHTML(formatMoney(first.income))}</p>
                <p>Разходи: ${escapeHTML(formatMoney(first.expenses))}</p>
                <p>Баланс: ${escapeHTML(formatMoney(first.balance))}</p>
                <p>Записи: ${first.totalCount}</p>
            </div>

            <div>
                <h5>${escapeHTML(secondPeriod.name)}</h5>
                <p>Приходи: ${escapeHTML(formatMoney(second.income))}</p>
                <p>Разходи: ${escapeHTML(formatMoney(second.expenses))}</p>
                <p>Баланс: ${escapeHTML(formatMoney(second.balance))}</p>
                <p>Записи: ${second.totalCount}</p>
            </div>

        </div>

        <h5>Разлика между първия и втория период</h5>

        <p>Приходи: ${escapeHTML(difference(first.income, second.income))}</p>
        <p>Разходи: ${escapeHTML(difference(first.expenses, second.expenses))}</p>
        <p>Баланс: ${escapeHTML(difference(first.balance, second.balance))}</p>

    `;

}


/* -----------------------------------------
   CSV ЕКСПОРТ НА АРХИВ
----------------------------------------- */

function exportArchiveCSV() {

    if (!selectedArchivePeriod) return;

    const period = selectedArchivePeriod;

    const records = sortByDate(
        getArchiveRecords(period.year, period.month)
    );

    const headers = [
        "Статус",
        "Вид",
        "Дата",
        "Отчетна година",
        "Отчетен месец",
        "Сума EUR",
        "Сметка",
        "Получаваща сметка",
        "Фонд",
        "Категория",
        "Източник",
        "Описание"
    ];

    const rows = records.map(record => {

        const accounting = getRecordAccountingPeriod(record);

        return [

            record.active ? "Активен" : "Неактивен",

            TYPE_NAMES[record.type] || record.type,

            record.date || "",

            accounting.year,

            MONTHS[accounting.month] || "",

            Number(record.amount || 0).toFixed(2),

            getAccountName(record.accountId),

            record.destinationAccountId
                ? getAccountName(record.destinationAccountId)
                : "",

            getFund(record.fundId)?.name || "",

            CATEGORY_NAMES[record.category] || "",

            record.source || "",

            record.description || ""

        ];

    });

    const csv = [headers, ...rows]
        .map(row =>
            row.map(value =>
                '"' + String(value).replace(/"/g, '""') + '"'
            ).join(";")
        )
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
        `Arhiv_${period.year}_${period.month === null
            ? "godina"
            : String(period.month + 1).padStart(2, "0")}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    setStatus("Архивният CSV отчет е експортиран.");

}


/* -----------------------------------------
   PDF ЕКСПОРТ НА АРХИВ
   Отваря отчет за принтиране / Save as PDF
----------------------------------------- */

function exportArchivePDF() {

    if (!selectedArchivePeriod) return;

    const period = selectedArchivePeriod;

    const records = sortByDate(
        getArchiveRecords(period.year, period.month)
    );

    const summary = calculateArchiveSummary(records);

    const categories = getArchiveCategoryTotals(records);

    const accounts = getArchiveAccountReports(records);

    const funds = getArchiveFundReports(records);

    const printWindow = window.open(
        "",
        "_blank",
        "width=1100,height=800"
    );

    if (!printWindow) {

        alert("Браузърът блокира прозореца за PDF отчет.");

        return;
    }

    const rows = records.map(record => `

        <tr>
            <td>${record.active ? "Активен" : "Неактивен"}</td>
            <td>${escapeHTML(TYPE_NAMES[record.type] || record.type)}</td>
            <td>${escapeHTML(formatDate(record.date))}</td>
            <td>${escapeHTML(formatMoney(record.amount))}</td>
            <td>${escapeHTML(getAccountName(record.accountId))}</td>
            <td>${escapeHTML(CATEGORY_NAMES[record.category] || "-")}</td>
            <td>${escapeHTML(record.description || "-")}</td>
        </tr>

    `).join("");

    const categoryHTML = categories.map(([name, amount]) => `
        <tr>
            <td>${escapeHTML(name)}</td>
            <td>${escapeHTML(formatMoney(amount))}</td>
        </tr>
    `).join("");

    const accountHTML = accounts.map(account => `
        <tr>
            <td>${escapeHTML(account.name)}</td>
            <td>${escapeHTML(formatMoney(account.income))}</td>
            <td>${escapeHTML(formatMoney(account.expenses))}</td>
            <td>${escapeHTML(formatMoney(account.change))}</td>
        </tr>
    `).join("");

    const fundHTML = funds.map(fund => `
        <tr>
            <td>${escapeHTML(fund.name)}</td>
            <td>${escapeHTML(formatMoney(fund.contributions))}</td>
            <td>${escapeHTML(formatMoney(fund.currentBalance))}</td>
        </tr>
    `).join("");

    printWindow.document.write(`

        <!DOCTYPE html>
        <html lang="bg">

        <head>

            <meta charset="UTF-8">

            <title>Архив - ${escapeHTML(period.name)}</title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    color: #222;
                    padding: 25px;
                }

                h1, h2, h3 {
                    margin-bottom: 8px;
                }

                h2 {
                    margin-top: 28px;
                    border-bottom: 1px solid #888;
                    padding-bottom: 6px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 12px;
                }

                th, td {
                    border: 1px solid #999;
                    padding: 7px;
                    text-align: left;
                    font-size: 10px;
                }

                th {
                    background: #e5e5e5;
                }

                .stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin: 20px 0;
                }

                .stat {
                    border: 1px solid #999;
                    padding: 12px;
                }

                .stat strong {
                    display: block;
                    margin-top: 7px;
                }

                .print-button {
                    padding: 9px 20px;
                    margin-bottom: 20px;
                }

                @media print {
                    .print-button {
                        display: none;
                    }
                }

            </style>

        </head>

        <body>

            <button class="print-button" onclick="window.print()">
                Принтирай / Запази като PDF
            </button>

            <h1>ФИНАНСОВ ОРГАНИЗАТОР</h1>

            <h3>Архивен финансов отчет: ${escapeHTML(period.name)}</h3>

            <div class="stats">

                <div class="stat">
                    Приходи
                    <strong>${escapeHTML(formatMoney(summary.income))}</strong>
                </div>

                <div class="stat">
                    Разходи
                    <strong>${escapeHTML(formatMoney(summary.expenses))}</strong>
                </div>

                <div class="stat">
                    Баланс
                    <strong>${escapeHTML(formatMoney(summary.balance))}</strong>
                </div>

                <div class="stat">
                    Прехвърляния
                    <strong>${escapeHTML(formatMoney(summary.transfers))}</strong>
                </div>

                <div class="stat">
                    Вноски във фондове
                    <strong>${escapeHTML(formatMoney(summary.fundContributions))}</strong>
                </div>

                <div class="stat">
                    Общо записи
                    <strong>${summary.totalCount}</strong>
                </div>

            </div>

            <h2>Разходи по категории</h2>

            <table>
                <thead>
                    <tr>
                        <th>Категория</th>
                        <th>Сума</th>
                    </tr>
                </thead>
                <tbody>${categoryHTML}</tbody>
            </table>

            <h2>Справки по сметки</h2>

            <table>
                <thead>
                    <tr>
                        <th>Сметка</th>
                        <th>Приходи</th>
                        <th>Разходи</th>
                        <th>Нетна промяна</th>
                    </tr>
                </thead>
                <tbody>${accountHTML}</tbody>
            </table>

            <h2>Справки по фондове</h2>

            <table>
                <thead>
                    <tr>
                        <th>Фонд</th>
                        <th>Вноски за периода</th>
                        <th>Текущ баланс</th>
                    </tr>
                </thead>
                <tbody>${fundHTML}</tbody>
            </table>

            <h2>Всички финансови записи</h2>

            <table>
                <thead>
                    <tr>
                        <th>Статус</th>
                        <th>Вид</th>
                        <th>Дата</th>
                        <th>Сума</th>
                        <th>Сметка</th>
                        <th>Категория</th>
                        <th>Описание</th>
                    </tr>
                </thead>

                <tbody>
                    ${rows || '<tr><td colspan="7">Няма записи.</td></tr>'}
                </tbody>

            </table>

        </body>

        </html>

    `);

    printWindow.document.close();

    printWindow.focus();

    setStatus("PDF отчетът е подготвен за принтиране.");

}


/* -----------------------------------------
   ВЪЗСТАНОВЯВАНЕ НА АРХИВ
----------------------------------------- */

function restoreSelectedArchive() {

    if (!selectedArchivePeriod) return;

    const period = selectedArchivePeriod;

    showConfirm(
        `Сигурни ли сте, че искате да възстановите ${period.name}?\n\n` +
        "Периодът отново ще може да бъде редактиран.",
        () => {

            const yearObject = getYearObject(period.year);

            if (!yearObject) {

                alert("Годината вече не съществува.");

                return;
            }

            if (period.month === null) {

                // Възстановяване на цялата година
                yearObject.archived = false;

                // Премахваме и старите отделни архиви на месеци,
                // защото се възстановява цялата година.
                yearObject.archivedMonths = [];

            } else {

                // Възстановяване само на конкретния месец
                yearObject.archivedMonths =
                    (yearObject.archivedMonths || [])
                        .filter(month =>
                            Number(month) !== Number(period.month)
                        );

            }

            selectedArchivePeriod = null;

            renderAll();

            saveData();

            renderArchivePeriods();

            setStatus(
                `${period.name} е възстановен успешно.`
            );

        }
    );

}


/* -----------------------------------------
   ОТВАРЯНЕ И ЗАТВАРЯНЕ НА АРХИВА
----------------------------------------- */

function openArchiveWindow() {

    const windowElement =
        document.getElementById("archiveWindow");

    if (!windowElement) return;

    renderArchivePeriods();

    windowElement.style.display = "flex";

    const closeButton =
        document.getElementById("closeArchiveButton");

    if (closeButton) {
        closeButton.focus();
    }

}


function closeArchiveWindow() {

    const windowElement =
        document.getElementById("archiveWindow");

    if (!windowElement) return;

    windowElement.style.display = "none";

}






// function renderYearTree() {

//     const tree = document.getElementById("yearTree");

//     tree.innerHTML = "";

//     const sortedYears = [...data.years].sort(
//         (a, b) => b.year - a.year
//     );

//     sortedYears.forEach(yearObject => {

//         const yearItem = document.createElement("li");

//         yearItem.className = "year-item";

//         const row = document.createElement("div");

//         row.className = "tree-row";

//         if (yearObject.year === selectedYear) {
//             row.classList.add("selected");
//         }

//         const toggle = document.createElement("button");

//         toggle.type = "button";
//         toggle.className = "tree-toggle";

//         const monthList = document.createElement("ul");

//         monthList.className = "month-tree";

//         const isExpanded = yearObject.year === selectedYear;

//         toggle.textContent = isExpanded ? "−" : "+";

//         toggle.addEventListener("click", event => {

//             event.stopPropagation();

//             const currentlyOpen =
//                 monthList.style.display !== "none";

//             monthList.style.display =
//                 currentlyOpen ? "none" : "block";

//             toggle.textContent = currentlyOpen ? "+" : "−";
//         });

//         const icon = document.createElement("img");

//         icon.className = "tree-icon";
//         icon.src = "images/icons/clock.png";

//         const label = document.createElement("span");

//         label.className = "tree-label";
//         label.textContent = `${yearObject.year} Година`;

//         const addMonth = document.createElement("button");

//         addMonth.type = "button";
//         addMonth.className = "add-month-button";
//         addMonth.textContent = "+";
//         addMonth.title = "Добави месец";



//         addMonth.addEventListener("click", event => {

//             event.stopPropagation();

//             addMonthToYear(yearObject.year);
//         });

//         row.append(toggle, icon, label, addMonth);

//         row.addEventListener("click", () => {

//             selectedYear = yearObject.year;

//             const availableMonths = yearObject.months;

//             if (!availableMonths.includes(selectedMonth)) {
//                 selectedMonth = availableMonths[0] ?? null;
//             }

//             selectedRecordId = null;

//             renderAll();
//             saveData();
//         });

//         yearItem.appendChild(row);

//         yearObject.months
//             .slice()
//             .sort((a, b) => a - b)
//             .forEach(monthIndex => {

//                 const monthItem = document.createElement("li");

//                 monthItem.className = "month-item";

//                 if (
//                     yearObject.year === selectedYear &&
//                     monthIndex === selectedMonth
//                 ) {
//                     monthItem.classList.add("selected-month");
//                 }

//                 const bullet = document.createElement("img");


//                 bullet.className = "tree-icon";
//                 bullet.src = "images/icons/calendar.png";

                
//                 const monthName = document.createElement("span");

//                 monthName.textContent = MONTHS[monthIndex];

//                 monthItem.append(bullet, monthName);

//                 monthItem.addEventListener("click", () => {

//                     selectedYear = yearObject.year;
//                     selectedMonth = monthIndex;

//                     selectedRecordId = null;

//                     renderAll();
//                     saveData();
//                 });

//                 monthList.appendChild(monthItem);
//             });

//         if (!isExpanded) {
//             monthList.style.display = "none";
//         }

//         yearItem.appendChild(monthList);

//         tree.appendChild(yearItem);
//     });

//     updateSelectedPeriod();
// }


function renderYearTree() {

    const tree = document.getElementById("yearTree");
    tree.innerHTML = "";

    const sortedYears = [...data.years].sort(
    (a, b) => a.year - b.year
    );

    sortedYears.forEach(yearObject => {

        // Подготовка на архивните данни
        if (!Array.isArray(yearObject.archivedMonths)) {
            yearObject.archivedMonths = [];
        }

        const yearArchived = yearObject.archived === true;

        const yearItem = document.createElement("li");
        yearItem.className = "year-item";

        const row = document.createElement("div");
        row.className = "tree-row";

        if (yearObject.year === selectedYear) {
            row.classList.add("selected");
        }

        if (yearArchived) {
            row.classList.add("archived-period");
        }

        // Бутон за разгъване
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "tree-toggle";

        const monthList = document.createElement("ul");
        monthList.className = "month-tree";

        const isExpanded = yearObject.year === selectedYear;

        toggle.textContent = isExpanded ? "−" : "+";

        toggle.addEventListener("click", event => {

            event.stopPropagation();

            const currentlyOpen =
                monthList.style.display !== "none";

            monthList.style.display =
                currentlyOpen ? "none" : "block";

            toggle.textContent = currentlyOpen ? "+" : "−";
        });

        // Икона на годината
        const icon = document.createElement("img");
        icon.className = "tree-icon";
        icon.src = "images/icons/clock.png";

        // Име на годината
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = `${yearObject.year} Година`;

        // Катинарче на годината
        const yearLock = document.createElement("img");
        yearLock.type = "img";
        yearLock.className = "period-lock-button";
        yearLock.src = yearArchived ? "images/icons/lock.png" : "images/icons/unlock.png";
        yearLock.title = yearArchived
            ? "Разархивирай годината"
            : "Архивирай годината";

        yearLock.addEventListener("click", event => {
            event.stopPropagation();
            toggleYearArchive(yearObject.year);
        });

        // Добавяне на месец
        const addMonth = document.createElement("button");
        addMonth.type = "button";
        addMonth.className = "add-month-button";
        addMonth.textContent = "+";
        addMonth.title = "Добави месец";
        addMonth.disabled = yearArchived;

        addMonth.addEventListener("click", event => {

            event.stopPropagation();

            if (yearArchived) return;

            addMonthToYear(yearObject.year);
        });

        row.append(
            toggle,
            icon,
            label,
            yearLock,
            addMonth
        );

        row.addEventListener("click", () => {

            selectedYear = yearObject.year;

            const availableMonths = yearObject.months;

            if (!availableMonths.includes(selectedMonth)) {
                selectedMonth = availableMonths[0] ?? null;
            }

            selectedRecordId = null;

            renderAll();
            saveData();
        });

        yearItem.appendChild(row);

        // Месеци
        yearObject.months
            .slice()
            .sort((a, b) => a - b)
            .forEach(monthIndex => {

                const monthItem = document.createElement("li");
                monthItem.className = "month-item";

                const monthArchived =
                    yearArchived ||
                    yearObject.archivedMonths.includes(monthIndex);

                if (
                    yearObject.year === selectedYear &&
                    monthIndex === selectedMonth
                ) {
                    monthItem.classList.add("selected-month");
                }

                if (monthArchived) {
                    monthItem.classList.add("archived-period");
                }

                // Икона на месеца
                const bullet = document.createElement("img");
                bullet.className = "tree-icon";
                bullet.src = "images/icons/calendar.png";

                // Име на месеца
                const monthName = document.createElement("span");
                monthName.textContent = MONTHS[monthIndex];

                // Катинарче на месеца
                const monthLock = document.createElement("img");
                monthLock.type = "img";
                monthLock.className = "period-lock-button";
                monthLock.src =
                    monthArchived ? "images/icons/lock.png" : "images/icons/unlock.png";

                monthLock.title = yearArchived
                    ? "Годината е архивирана"
                    : monthArchived
                        ? "Разархивирай месеца"
                        : "Архивирай месеца";

                monthLock.disabled = yearArchived;

                monthLock.addEventListener("click", event => {

                    event.stopPropagation();

                    if (yearArchived) return;

                    toggleMonthArchive(
                        yearObject.year,
                        monthIndex
                    );
                });

                monthItem.append(
                    bullet,
                    monthName,
                    monthLock
                );

                monthItem.addEventListener("click", () => {

                    selectedYear = yearObject.year;
                    selectedMonth = monthIndex;

                    selectedRecordId = null;

                    renderAll();
                    saveData();
                });

                monthList.appendChild(monthItem);
            });

        if (!isExpanded) {
            monthList.style.display = "none";
        }

        yearItem.appendChild(monthList);
        tree.appendChild(yearItem);
    });

    updateSelectedPeriod();
}



function updateSelectedPeriod() {

    const period = selectedMonth === null
        ? `Няма избран месец – ${selectedYear}`
        : `${MONTHS[selectedMonth]} ${selectedYear}`;

    document.getElementById("selectedPeriod").textContent = period;

    document.getElementById("tablePeriod").textContent = period;
}


function addYear() {

    const input = prompt("Въведи година:");

    if (input === null) return;

    const year = Number(input);

    if (
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 2200
    ) {
        alert("Моля, въведи валидна година.");
        return;
    }

    if (getYearObject(year)) {
        alert("Тази година вече съществува.");
        return;
    }

    // Създаваме годината без месеци
    data.years.push({
        year,
        months: []
    });

    selectedYear = year;
    selectedMonth = null;
    selectedRecordId = null;

    renderAll();
    saveData();

    setStatus("Успешно добавена година. Добави първия месец.");
}


function removeYear() {

    const yearObject = getYearObject(selectedYear);

    if (!yearObject) return;

    const hasRecords = data.records.some(record =>
        Number(record.date.substring(0, 4)) === selectedYear
    );

    if (hasRecords) {

        alert(
            "Не можете да премахнете тази година, " +
            "защото в нея има финансови записи."
        );

        return;
    }

    if (data.years.length <= 1) {

        alert("Трябва да има поне една година.");
        return;
    }

    showConfirm(
        `Сигурни ли сте, че искате да премахнете ${selectedYear} година?`,
        () => {

            data.years = data.years.filter(
                item => item.year !== selectedYear
            );

            selectedYear = data.years[0].year;
            selectedMonth = data.years[0].months[0] ?? 0;

            renderAll();
            saveData();
        }
    );
}


function addMonthToYear(year) {

    const yearObject = getYearObject(year);

    if (!yearObject) return;

    const available = MONTHS
        .map((name, index) => ({
            name,
            index
        }))
        .filter(item =>
            !yearObject.months.includes(item.index)
        );

    if (available.length === 0) {

        alert("Всички месеци вече са добавени.");
        return;
    }

    const choices = available
        .map(item => `${item.index + 1} - ${item.name}`)
        .join("\n");

    const input = prompt(
        `Избери месец за ${year}:\n\n${choices}`
    );

    if (input === null) return;

    const monthIndex = Number(input) - 1;

    if (
        !Number.isInteger(monthIndex) ||
        monthIndex < 0 ||
        monthIndex > 11
    ) {
        alert("Невалиден месец.");
        return;
    }

    if (yearObject.months.includes(monthIndex)) {

        alert("Този месец вече съществува.");
        return;
    }

    yearObject.months.push(monthIndex);

    selectedYear = year;
    selectedMonth = monthIndex;

    renderAll();
    saveData();
}


function removeMonth() {

    const yearObject = getYearObject(selectedYear);
    if (selectedMonth === null) return;
    if (!yearObject) return;

    if (yearObject.months.length <= 1) {

        alert("Годината трябва да съдържа поне един месец.");
        return;
    }

    const hasRecords = data.records.some(record => {

        const parts = record.date.split("-");

        return (
            Number(parts[0]) === selectedYear &&
            Number(parts[1]) - 1 === selectedMonth
        );
    });

    if (hasRecords) {

        alert(
            "Не можете да премахнете този месец, " +
            "защото съдържа финансови записи."
        );

        return;
    }

    showConfirm(
        `Премахване на ${MONTHS[selectedMonth]} ${selectedYear}?`,
        () => {

            yearObject.months = yearObject.months.filter(
                month => month !== selectedMonth
            );

            selectedMonth = yearObject.months[0];

            renderAll();
            saveData();
        }
    );
}


/* =====================================================
   ТЪРСЕНЕ НА ФИНАНСОВИ ЗАПИСИ
===================================================== */

let selectedSearchRecordId = null;


function searchRecords() {

    const searchText =
        document.getElementById("recordSearchText")
            .value.trim().toLowerCase();

    const searchType =
        document.getElementById("recordSearchType").value;

    const searchCategory =
        document.getElementById("recordSearchCategory").value;

    const searchStatus =
        document.getElementById("recordSearchStatus").value;

    const dateFrom =
        document.getElementById("recordSearchFrom").value;

    const dateTo =
        document.getElementById("recordSearchTo").value;


    const results = data.records
        .filter(record => {

            // Търсене по текст

            const searchableText = [

                record.description || "",
                record.source || "",
                CATEGORY_NAMES[record.category] || "",
                TYPE_NAMES[record.type] || ""

            ].join(" ").toLowerCase();


            if (
                searchText &&
                !searchableText.includes(searchText)
            ) {
                return false;
            }


            // Вид операция

            if (
                searchType &&
                record.type !== searchType
            ) {
                return false;
            }


            // Категория

            if (
                searchCategory &&
                record.category !== searchCategory
            ) {
                return false;
            }


            // Статус

            if (
                searchStatus === "active" &&
                !record.active
            ) {
                return false;
            }

            if (
                searchStatus === "inactive" &&
                record.active
            ) {
                return false;
            }


            // Начална дата

            if (
                dateFrom &&
                record.date < dateFrom
            ) {
                return false;
            }


            // Крайна дата

            if (
                dateTo &&
                record.date > dateTo
            ) {
                return false;
            }


            return true;

        })
        .sort((a, b) =>
    new Date(a.date) - new Date(b.date)
);


    renderSearchResults(results);
}


function renderSearchResults(records) {
    

    const tbody =
        document.getElementById("recordSearchResults");

    const count =
        document.getElementById("recordSearchCount");

    tbody.innerHTML = "";

    count.textContent =
        `${records.length} ${records.length === 1 ? "запис" : "записа"}`;


    if (records.length === 0) {

        selectedSearchRecordId = null;

        const row = document.createElement("tr");

        row.className = "empty-table-row";

        const cell = document.createElement("td");

        cell.colSpan = 7;

        cell.textContent =
            "Няма намерени записи.";

        row.appendChild(cell);

        tbody.appendChild(row);

        return;
    }


    if (
        !records.some(record =>
            record.id === selectedSearchRecordId
        )
    ) {
        selectedSearchRecordId = null;
    }


    records.forEach(record => {

        const row = document.createElement("tr");

        if (record.id === selectedSearchRecordId) {
            row.classList.add("search-selected");
        }


        // Статус

        const statusCell = document.createElement("td");

        const statusIcon = document.createElement("img");

        statusIcon.className = "record-status";

        statusIcon.src = record.active
            ? "images/icons/check.PNG"
            : "images/icons/cross.PNG";

        statusIcon.alt = record.active
            ? "Активен"
            : "Неактивен";

        statusCell.appendChild(statusIcon);


        // Вид

        const typeCell = document.createElement("td");

        typeCell.textContent =
            TYPE_NAMES[record.type] || record.type;


        // Дата

        const dateCell = document.createElement("td");

        dateCell.textContent =
            formatDate(record.date);


        // Стойност

        const amountCell = document.createElement("td");

        amountCell.textContent =
            formatMoney(record.amount);


        // Категория

        const categoryCell = document.createElement("td");

        categoryCell.textContent =
            CATEGORY_NAMES[record.category] || "-";


        // Източник

        const sourceCell = document.createElement("td");

        sourceCell.textContent =
            record.source || "-";


        // Описание

        const descriptionCell = document.createElement("td");

        descriptionCell.textContent =
            record.description || "-";


        row.append(
            statusCell,
            typeCell,
            dateCell,
            amountCell,
            categoryCell,
            sourceCell,
            descriptionCell
        );


        row.addEventListener("click", () => {

            selectedSearchRecordId = record.id;

            renderSearchResults(records);

        });


        row.addEventListener("dblclick", () => {

            selectedSearchRecordId = record.id;

            openSelectedSearchRecord();

        });


        tbody.appendChild(row);

    });

}


function openSelectedSearchRecord() {

    if (!selectedSearchRecordId) {

        alert("Моля, избери запис от резултатите.");

        return;
    }


    const record = data.records.find(item =>
        item.id === selectedSearchRecordId
    );

    if (!record) return;


    const year = Number(record.date.substring(0, 4));

    const month = Number(record.date.substring(5, 7)) - 1;


    const yearObject = getYearObject(year);


    if (!yearObject) {

        alert("Не е намерена годината на този запис.");

        return;
    }


    if (!yearObject.months.includes(month)) {

        alert("Не е намерен периодът на този запис.");

        return;
    }


    selectedYear = year;

    selectedMonth = month;

    selectedRecordId = record.id;


    renderAll();

    saveData();


    closeDialog("searchDialog");


    setStatus(
        `Намерен запис от ${formatDate(record.date)}.`
    );

}


/* =====================================================
   7. ЗАПИСИ - ТАБЛИЦА
===================================================== */

function renderRecords() {

    const tbody = document.getElementById("recordsTableBody");

    tbody.innerHTML = "";

    let records = getSelectedPeriodRecords().sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
});

    records = records.filter(record => {

        if (
            activeFilters.type &&
            record.type !== activeFilters.type
        ) {
            return false;
        }

        if (activeFilters.account) {

            if (
                record.accountId !== activeFilters.account &&
                record.destinationAccountId !== activeFilters.account
            ) {
                return false;
            }
        }

        if (activeFilters.status === "active" && !record.active) {
            return false;
        }

        if (activeFilters.status === "inactive" && record.active) {
            return false;
        }

        if (
            activeFilters.category &&
            record.category !== activeFilters.category
        ) {
            return false;
        }

        return true;
    });

    document.getElementById("recordCount").textContent =
        records.length;

    if (records.length === 0) {

        const row = document.createElement("tr");

        row.className = "empty-table-row";

        const cell = document.createElement("td");

        cell.colSpan = 8;
        cell.textContent = "Няма налични записи за избрания период.";

        row.appendChild(cell);
        tbody.appendChild(row);

        return;
    }

    records.forEach(record => {

        const row = document.createElement("tr");

        if (record.id === selectedRecordId) {
            row.classList.add("selected-record");
        }

        if (!record.active) {
            row.classList.add("inactive-record");
        }

        const statusCell = document.createElement("td");

        statusCell.style.textAlign = "center";

        const status = document.createElement("img");

        status.className = "record-status";

        if (record.active) {

            status.classList.add("active");
            // status.textContent = "✓";
            status.src = "images/icons/check.png"

        } else {

            status.classList.add("inactive");
            // status.textContent = "✕";
            status.src = "images/icons/cross.png"
        }

        statusCell.appendChild(status);

        const typeCell = document.createElement("td");

        typeCell.textContent = TYPE_NAMES[record.type] || record.type;

        const dateCell = document.createElement("td");

        dateCell.textContent = formatDate(record.date);

        const amountCell = document.createElement("td");

        amountCell.textContent = formatMoney(record.amount);

        const accountCell = document.createElement("td");

        accountCell.textContent = getAccountName(record.accountId);

        if (record.type === "transfer") {

            accountCell.textContent +=
                " → " + getAccountName(record.destinationAccountId);
        }

        const categoryCell = document.createElement("td");

        categoryCell.textContent =
            CATEGORY_NAMES[record.category] || "-";

        const sourceCell = document.createElement("td");

        sourceCell.textContent = record.source || "-";

        const descriptionCell = document.createElement("td");

        descriptionCell.textContent =
            record.type === "fund"
                ? `${getFund(record.fundId)?.name || "Фонд"} – ${record.description || ""}`
                : record.description || "-";

        row.append(
            statusCell,
            typeCell,
            dateCell,
            amountCell,
            accountCell,
            categoryCell,
            sourceCell,
            descriptionCell
        );

        row.addEventListener("click", () => {

            selectedRecordId = record.id;

            renderRecords();
        });

        row.addEventListener("dblclick", () => {

            selectedRecordId = record.id;

            editRecord();
        });

        tbody.appendChild(row);
    });
}


/* =====================================================
   8. ДОБАВЯНЕ И РЕДАКТИРАНЕ НА ЗАПИСИ
===================================================== */

function populateAccountSelect(selectId, selectedId = "") {

    const select = document.getElementById(selectId);

    select.innerHTML = "";

    const defaultOption = document.createElement("option");

    defaultOption.value = "";
    defaultOption.textContent = "Избери сметка...";

    select.appendChild(defaultOption);

    data.accounts.forEach(account => {

        const option = document.createElement("option");

        option.value = account.id;
        option.textContent = `${account.number} - ${account.name}`;

        if (account.id === selectedId) {
            option.selected = true;
        }

        select.appendChild(option);
    });
}


function updateRecordTypeFields() {

    const type = document.getElementById("recordType").value;

    const destinationRow =
        document.getElementById("destinationAccountRow");

    destinationRow.hidden = type !== "transfer";

    document.getElementById("recordAccount").required = true;

    document.getElementById("destinationAccount").required =
        type === "transfer";
}




function updateRecordActiveButton() {

    const checkbox =
        document.getElementById("recordActive");

    const button =
        document.getElementById("recordActiveButton");

    const icon =
        document.getElementById("recordActiveIcon");

    const text =
        document.getElementById("recordActiveText");

    if (!checkbox || !button || !icon || !text) return;

    const active = checkbox.checked;

    if (active) {

        icon.src = "images/icons/check.PNG";
        icon.alt = "Активен";

        text.textContent = "Активен";

        button.setAttribute("aria-label", "Активен запис");
        button.setAttribute("aria-pressed", "true");

        button.title = "Записът е активен";

    } else {

        icon.src = "images/icons/cross.PNG";
        icon.alt = "Неактивен";

        text.textContent = "Неактивен";

        button.setAttribute("aria-label", "Неактивен запис");
        button.setAttribute("aria-pressed", "false");

        button.title = "Записът е неактивен";
    }
}





function addRecord() {

    if (isPeriodArchived(selectedYear, selectedMonth)) {
    alert("Този период е архивиран. Не можеш да добавяш записи в него.");
    return;
}

    if (data.accounts.length === 0) {

        alert(
            "Първо създай поне една сметка, " +
            "за да можеш да добавяш записи."
        );

        openDialog("accountsDialog");
        return;
    }

    document.getElementById("recordForm").reset();

    document.getElementById("recordSourceCatalogId").value = "";

    setRecordSourceLocked(false);

    populateRecordCategorySelect();

document.getElementById("recordSourceType").value =
    getSuggestedSourceType(
        document.getElementById("recordType").value
    );

    document.getElementById("recordId").value = "";

    document.getElementById("recordDialogTitle").textContent =
        "Добавяне на нов запис";

    document.getElementById("recordDate").value = todayString();

    document.getElementById("recordActive").checked = false;
    updateRecordActiveButton();

    populateAccountSelect("recordAccount");
    populateAccountSelect("destinationAccount");

    updateRecordTypeFields();

    openDialog("recordDialog");
}


function editRecord() {

    if (!selectedRecordId) {

        alert("Моля, избери запис от таблицата.");
        return;
    }

    const record = data.records.find(
        item => item.id === selectedRecordId
    );

    if (!record) return;

    const period = getRecordAccountingPeriod(record);

if (isPeriodArchived(period.year, period.month)) {
    alert("Записът принадлежи към архивиран период и не може да бъде редактиран.");
    return;
}

    if (record.type === "fund") {

        alert(
            "Вноските към фондове се управляват чрез прозореца за фондове."
        );

        return;
    }

    document.getElementById("recordForm").reset();

    document.getElementById("recordId").value = record.id;

    document.getElementById("recordDialogTitle").textContent =
        "Редактиране на запис";

    document.getElementById("recordType").value = record.type;

    document.getElementById("recordDate").value = record.date;

    document.getElementById("recordAmount").value = record.amount;

    document.getElementById("recordSource").value =
        record.source || "";

    document.getElementById("recordSourceCatalogId").value =
    record.sourceCatalogId || "";

    setRecordSourceLocked(!!record.sourceCatalogId);

    document.getElementById("recordDescription").value =
        record.description || "";

    populateRecordCategorySelect(record.category || "");

document.getElementById("recordCategory").value =
    record.category || "";

document.getElementById("recordSourceType").value =
    record.sourceType ||
    getSuggestedSourceType(record.type);

    document.getElementById("recordActive").checked =
        record.active;

        updateRecordActiveButton();

    populateAccountSelect("recordAccount", record.accountId);

    populateAccountSelect(
        "destinationAccount",
        record.destinationAccountId
    );

    updateRecordTypeFields();

    openDialog("recordDialog");
}


function saveRecord(event) {

    event.preventDefault();

    const id = document.getElementById("recordId").value;

    const type = document.getElementById("recordType").value;

    const date = document.getElementById("recordDate").value;

    const amount = Number(
        document.getElementById("recordAmount").value
    );

    const accountId =
        document.getElementById("recordAccount").value;

    const destinationAccountId =
        document.getElementById("destinationAccount").value;

    if (!Number.isFinite(amount) || amount <= 0) {

        alert("Въведи валидна сума.");
        return;
    }

    if (!getAccount(accountId)) {

        alert("Избери валидна сметка.");
        return;
    }

    if (!date) {

        alert("Избери дата.");
        return;
    }

    if (type === "fund") {

        alert(
            "За вноска във фонд използвай бутона " +
            "'Добави средства' в менюто Фондове."
        );

        return;
    }

    if (type === "transfer") {

        if (!getAccount(destinationAccountId)) {

            alert("Избери сметка получател.");
            return;
        }

        if (accountId === destinationAccountId) {

            alert("Избери две различни сметки.");
            return;
        }
    }

    const existingRecord = id
        ? data.records.find(record => record.id === id)
        : null;

    const record = {

        id: id || createId("record"),

        type,

        date,

        accountingYear: selectedYear,
        accountingMonth: selectedMonth,

        amount,

        accountId,

        destinationAccountId:
            type === "transfer"
                ? destinationAccountId
                : null,

        category:
            document.getElementById("recordCategory").value,

        source:
    document.getElementById("recordSource").value.trim(),

sourceType:
    document.getElementById("recordSourceType").value ||
    getSuggestedSourceType(type),

sourceCatalogId:
    document.getElementById("recordSourceCatalogId")?.value || null,

description:
    document.getElementById("recordDescription").value.trim(),

active:
    document.getElementById("recordActive").checked,

fundId: null,

createdAt:
    existingRecord?.createdAt || new Date().toISOString(),

updatedAt: new Date().toISOString()
};

    

    /*
       Проверяваме дали сметката ще остане с
       отрицателен баланс след записа.
    */

    const previousRecords = data.records;

    if (existingRecord) {

        data.records = data.records.map(item =>
            item.id === id ? record : item
        );

    } else {

        data.records.push(record);
    }

    const sourceBalance = calculateAccountBalance(accountId);

    const destinationBalance =
        type === "transfer"
            ? calculateAccountBalance(destinationAccountId)
            : 0;

    if (
        record.active &&
        (type === "expense" || type === "fund") &&
        sourceBalance < 0
    ) {

        data.records = previousRecords;

        alert(
            "Недостатъчна наличност по избраната сметка.\n" +
            "Наличност след операцията: " +
            formatMoney(sourceBalance)
        );

        return;
    }

    if (
        record.active &&
        type === "transfer" &&
        (sourceBalance < 0 || destinationBalance < 0)
    ) {

        data.records = previousRecords;

        alert(
            "Прехвърлянето би довело до отрицателна наличност."
        );

        return;
    }

    /*
       Ако редактираме запис, проверката трябва
       да обхваща и старата сметка.
    */

    if (existingRecord && existingRecord.active) {

        const oldBalance = calculateAccountBalance(
            existingRecord.accountId
        );

        if (oldBalance < 0) {

            data.records = previousRecords;

            alert(
                "Редакцията би довела до отрицателна " +
                "наличност по старата сметка."
            );

            return;
        }
    }

    selectedRecordId = record.id;

    closeDialog("recordDialog");

    renderAll();
    saveData();

    setStatus(
        existingRecord
            ? "Записът е редактиран."
            : "Новият запис е добавен."
    );
}


/* =====================================================
   9. АКТИВИРАНЕ И ДЕАКТИВИРАНЕ
===================================================== */

// function changeRecordStatus(active) {

//     if (!selectedRecordId) {

//         alert("Моля, избери запис.");
//         return;
//     }

//     const record = data.records.find(
//         item => item.id === selectedRecordId
//     );

//     if (!record) return;

//     if (record.active === active) {

//         alert(
//             active
//                 ? "Записът вече е активен."
//                 : "Записът вече е неактивен."
//         );

//         return;
//     }

//     record.active = active;

//     renderAll();
//     saveData();

//     setStatus(
//         active
//             ? "Записът е активиран."
//             : "Записът е деактивиран."
//     );
// }


/* =====================================================
   10. ИЗТРИВАНЕ НА ЗАПИС
===================================================== */

function deleteRecord() {

    if (!selectedRecordId) {

        alert("Моля, избери запис.");
        return;
    }

    const record = data.records.find(
        item => item.id === selectedRecordId
    );

    if (!record) return;

    const period = getRecordAccountingPeriod(record);

if (isPeriodArchived(period.year, period.month)) {
    alert("Записът принадлежи към архивиран период и не може да бъде изтрит.");
    return;
}

    showConfirm(
        "Сигурни ли сте, че искате да изтриете избрания запис?",
        () => {

            data.records = data.records.filter(
                item => item.id !== selectedRecordId
            );

            selectedRecordId = null;

            renderAll();
            saveData();

            setStatus("Записът е изтрит.");
        }
    );
}


/* =====================================================
   11. СМЕТКИ
===================================================== */

function generateAccountNumber() {

    const numbers = data.accounts.map(
        account => Number(account.number)
    );

    return String(
        Math.max(0, ...numbers) + 1
    ).padStart(4, "0");
}


function renderAccounts() {

    const tbody = document.getElementById("accountsTableBody");

    tbody.innerHTML = "";

    data.accounts.forEach(account => {

        const row = document.createElement("tr");

        if (account.id === selectedAccountId) {
            row.classList.add("selected-row");
        }

        const values = [
            account.number,
            account.name,
            formatDate(account.createdAt),
            formatDate(account.lastUsed),
            formatMoney(calculateAccountBalance(account.id))
        ];

        values.forEach(value => {

            const cell = document.createElement("td");

            cell.textContent = value || "-";

            row.appendChild(cell);
        });

        row.addEventListener("click", () => {

            selectedAccountId = account.id;

            renderAccounts();
        });

        row.addEventListener("dblclick", () => {

            selectedAccountId = account.id;

            viewAccount();
        });

        tbody.appendChild(row);
    });

    if (data.accounts.length === 0) {

        const row = document.createElement("tr");

        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = "Няма създадени сметки.";
        cell.style.textAlign = "center";

        row.appendChild(cell);
        tbody.appendChild(row);
    }
}


function addAccount() {

    editingAccountId = null;

    document.getElementById("accountForm").reset();

    document.getElementById("accountDialogTitle").textContent =
        "Нова сметка";

    document.getElementById("accountNumber").value =
        generateAccountNumber();

    document.getElementById("accountInitialBalance").value =
        "0.00";

    openDialog("accountFormDialog");
}


function editAccount() {

    if (!selectedAccountId) {

        alert("Избери сметка.");
        return;
    }

    const account = getAccount(selectedAccountId);

    if (!account) return;

    editingAccountId = account.id;

    document.getElementById("accountDialogTitle").textContent =
        "Редактиране на сметка";

    document.getElementById("accountNumber").value =
        account.number;

    document.getElementById("accountName").value =
        account.name;

    document.getElementById("accountDescription").value =
        account.description || "";

    document.getElementById("accountInitialBalance").value =
        account.initialBalance;

    document.getElementById("accountInitialBalance").readOnly = true;

    openDialog("accountFormDialog");
}


function saveAccount(event) {

    event.preventDefault();

    const name = document.getElementById("accountName")
        .value.trim();

    const description = document.getElementById("accountDescription")
        .value.trim();

    const initialBalance = Number(
        document.getElementById("accountInitialBalance").value
    );

    if (!name) {

        alert("Въведи име на сметката.");
        return;
    }

    if (
        !Number.isFinite(initialBalance) ||
        initialBalance < 0
    ) {

        alert("Въведи валидна начална наличност.");
        return;
    }

    if (editingAccountId) {

        const account = getAccount(editingAccountId);

        if (!account) return;

        account.name = name;
        account.description = description;
        account.updatedAt = new Date().toISOString();

    } else {

        const account = {

            id: createId("account"),

            number: generateAccountNumber(),

            name,

            description,

            initialBalance,

            createdAt: todayString(),

            lastUsed: null
        };

        data.accounts.push(account);

        selectedAccountId = account.id;
    }

    document.getElementById("accountInitialBalance").readOnly = false;

    closeDialog("accountFormDialog");

    renderAll();
    saveData();

    setStatus("Сметката е запазена.");
}


function deleteAccount() {

    if (!selectedAccountId) {

        alert("Избери сметка.");
        return;
    }

    const account = getAccount(selectedAccountId);

    if (!account) return;

    const hasTransactions = data.records.some(record =>
        record.accountId === account.id ||
        record.destinationAccountId === account.id
    );

    if (hasTransactions) {

        alert(
            "Не може да изтриете тази сметка, " +
            "защото има свързани финансови записи."
        );

        return;
    }

    if (Math.abs(calculateAccountBalance(account.id)) > 0.001) {

        alert(
            "Не може да изтриете сметка с налични средства."
        );

        return;
    }

    showConfirm(
        `Изтриване на сметка "${account.name}"?`,
        () => {

            data.accounts = data.accounts.filter(
                item => item.id !== selectedAccountId
            );

            selectedAccountId = null;

            renderAll();
            saveData();
        }
    );
}


function viewAccount() {

    if (!selectedAccountId) {

        alert("Избери сметка.");
        return;
    }

    const account = getAccount(selectedAccountId);

    if (!account) return;

    document.getElementById("detailAccountNumber").textContent =
        account.number;

    document.getElementById("detailAccountName").textContent =
        account.name;

    document.getElementById("detailAccountCreated").textContent =
        formatDate(account.createdAt);

    document.getElementById("detailAccountLastUsed").textContent =
        formatDate(account.lastUsed);

    document.getElementById("detailAccountInitial").textContent =
        formatMoney(account.initialBalance);

    document.getElementById("detailAccountBalance").textContent =
        formatMoney(calculateAccountBalance(account.id));

    document.getElementById("detailAccountDescription").textContent =
        account.description || "-";

    openDialog("accountDetailsDialog");
}


/* =====================================================
   12. ФОНДОВЕ
===================================================== */

function generateFundNumber() {

    const numbers = data.funds.map(
        fund => Number(fund.number)
    );

    return String(
        Math.max(0, ...numbers) + 1
    ).padStart(4, "0");
}


function renderFunds() {

    const tbody = document.getElementById("fundsTableBody");

    tbody.innerHTML = "";

    data.funds.forEach(fund => {

        const row = document.createElement("tr");

        if (fund.id === selectedFundId) {
            row.classList.add("selected-row");
        }

        const balance = calculateFundBalance(fund.id);

        const target = Number(fund.target || 0);

        const progress = target > 0
            ? Math.min((balance / target) * 100, 100)
            : 0;

        const values = [
            fund.number,
            fund.name,
            formatMoney(balance),
            formatMoney(target),
            progress.toFixed(1) + "%",
            balance >= target ? "Постигната цел" : "В процес"
        ];

        values.forEach(value => {

            const cell = document.createElement("td");

            cell.textContent = value;

            row.appendChild(cell);
        });

        row.addEventListener("click", () => {

            selectedFundId = fund.id;

            renderFunds();
        });

        row.addEventListener("dblclick", () => {

            selectedFundId = fund.id;

            viewFund();
        });

        tbody.appendChild(row);
    });

    if (data.funds.length === 0) {

        const row = document.createElement("tr");

        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "Няма създадени фондове.";
        cell.style.textAlign = "center";

        row.appendChild(cell);
        tbody.appendChild(row);
    }
}


function addFund() {

    editingFundId = null;

    document.getElementById("fundForm").reset();

    document.getElementById("fundDialogTitle").textContent =
        "Създаване на нов фонд";

    document.getElementById("fundInitialAmount").value = "0.00";

    openDialog("fundFormDialog");
}


function editFund() {

    if (!selectedFundId) {

        alert("Избери фонд.");
        return;
    }

    const fund = getFund(selectedFundId);

    if (!fund) return;

    editingFundId = fund.id;

    document.getElementById("fundDialogTitle").textContent =
        "Редактиране на фонд";

    document.getElementById("fundName").value =
        fund.name;

    document.getElementById("fundDescription").value =
        fund.description || "";

    document.getElementById("fundTarget").value =
        fund.target;

    document.getElementById("fundInitialAmount").value =
        fund.initialAmount;

    document.getElementById("fundInitialAmount").readOnly = true;

    document.getElementById("fundDeadline").value =
        fund.deadline || "";

    openDialog("fundFormDialog");
}


function saveFund(event) {

    event.preventDefault();

    const name = document.getElementById("fundName")
        .value.trim();

    const description = document.getElementById("fundDescription")
        .value.trim();

    const target = Number(
        document.getElementById("fundTarget").value
    );

    const initialAmount = Number(
        document.getElementById("fundInitialAmount").value
    );

    const deadline = document.getElementById("fundDeadline").value;

    if (!name) {

        alert("Въведи име на фонда.");
        return;
    }

    if (
        !Number.isFinite(target) ||
        target <= 0
    ) {

        alert("Въведи валидна целева стойност.");
        return;
    }

    if (
        !Number.isFinite(initialAmount) ||
        initialAmount < 0
    ) {

        alert("Въведи валидна начална сума.");
        return;
    }

    if (editingFundId) {

        const fund = getFund(editingFundId);

        if (!fund) return;

        fund.name = name;
        fund.description = description;
        fund.target = target;
        fund.deadline = deadline;

    } else {

        const fund = {

            id: createId("fund"),

            number: generateFundNumber(),

            name,

            description,

            target,

            initialAmount,

            deadline,

            createdAt: todayString(),

            lastContribution: null
        };

        data.funds.push(fund);

        selectedFundId = fund.id;
    }

    document.getElementById("fundInitialAmount").readOnly = false;

    closeDialog("fundFormDialog");

    renderAll();
    saveData();

    setStatus("Фондът е запазен.");
}


function deleteFund() {

    if (!selectedFundId) {

        alert("Избери фонд.");
        return;
    }

    const fund = getFund(selectedFundId);

    if (!fund) return;

    const hasContributions = data.records.some(record =>
        record.type === "fund" &&
        record.fundId === fund.id
    );

    if (hasContributions) {

        alert(
            "Този фонд има история на вноски. " +
            "Първо трябва да обработиш средствата му."
        );

        return;
    }

    if (calculateFundBalance(fund.id) > 0.001) {

        alert(
            "Фондът все още съдържа средства и не може да бъде изтрит."
        );

        return;
    }

    showConfirm(
        `Изтриване на фонд "${fund.name}"?`,
        () => {

            data.funds = data.funds.filter(
                item => item.id !== selectedFundId
            );

            selectedFundId = null;

            renderAll();
            saveData();
        }
    );
}


function viewFund() {

    if (!selectedFundId) {

        alert("Избери фонд.");
        return;
    }

    const fund = getFund(selectedFundId);

    if (!fund) return;

    const balance = calculateFundBalance(fund.id);

    const remaining = Math.max(0, fund.target - balance);

    const progress = fund.target > 0
        ? Math.min((balance / fund.target) * 100, 100)
        : 0;

    document.getElementById("detailFundNumber").textContent =
        fund.number;

    document.getElementById("detailFundName").textContent =
        fund.name;

    document.getElementById("detailFundDescription").textContent =
        fund.description || "-";

    document.getElementById("detailFundCreated").textContent =
        formatDate(fund.createdAt);

    document.getElementById("detailFundLastContribution").textContent =
        formatDate(fund.lastContribution);

    document.getElementById("detailFundBalance").textContent =
        formatMoney(balance);

    document.getElementById("detailFundTarget").textContent =
        formatMoney(fund.target);

    document.getElementById("detailFundRemaining").textContent =
        formatMoney(remaining);

    document.getElementById("detailFundDeadline").textContent =
        formatDate(fund.deadline);

    document.getElementById("fundProgressFill").style.width =
        progress + "%";

    document.getElementById("fundProgressText").textContent =
        progress.toFixed(1) + "%";

    openDialog("fundDetailsDialog");
}


/* =====================================================
   13. ПРЕХВЪРЛЯНЕ НА СРЕДСТВА КЪМ ФОНД
===================================================== */

function populateFundSelect() {

    const select = document.getElementById("contributionFund");

    select.innerHTML = "";

    const option = document.createElement("option");

    option.value = "";
    option.textContent = "Избери фонд...";

    select.appendChild(option);

    data.funds.forEach(fund => {

        const item = document.createElement("option");

        item.value = fund.id;
        item.textContent = `${fund.number} - ${fund.name}`;

        select.appendChild(item);
    });
}


function addFundContribution() {

    if (data.funds.length === 0) {

        alert("Първо създай фонд.");
        return;
    }

    if (data.accounts.length === 0) {

        alert("Първо създай сметка.");
        return;
    }

    document.getElementById("fundContributionForm").reset();

    populateFundSelect();

    populateAccountSelect("contributionAccount");

    document.getElementById("contributionDate").value =
        todayString();

    openDialog("fundContributionDialog");
}


function saveFundContribution(event) {

    event.preventDefault();

    const fundId =
        document.getElementById("contributionFund").value;

    const accountId =
        document.getElementById("contributionAccount").value;

    const amount = Number(
        document.getElementById("contributionAmount").value
    );

    const date =
        document.getElementById("contributionDate").value;

    const description =
        document.getElementById("contributionDescription")
            .value.trim();

    const fund = getFund(fundId);

    const account = getAccount(accountId);

    if (!fund || !account) {

        alert("Избери валиден фонд и сметка.");
        return;
    }

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert("Въведи валидна сума.");
        return;
    }

    if (!date) {

        alert("Избери дата.");
        return;
    }

    const remaining =
        fund.target - calculateFundBalance(fund.id);

    if (amount > remaining + 0.001) {

        alert(
            "Сумата надвишава оставащата цел на фонда.\n" +
            "Оставаща сума: " + formatMoney(remaining)
        );

        return;
    }

    if (amount > calculateAccountBalance(account.id)) {

        alert(
            "Няма достатъчно средства в избраната сметка.\n" +
            "Наличност: " +
            formatMoney(calculateAccountBalance(account.id))
        );

        return;
    }

    const record = {

        id: createId("record"),

        type: "fund",

        date,

        accountingYear: selectedYear,
        accountingMonth: selectedMonth,

        amount,

        accountId: account.id,

        destinationAccountId: null,

        fundId: fund.id,

        category: "",

        source: fund.name,

        description,

        active: true,

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString()
    };

    data.records.push(record);

    fund.lastContribution = date;

    account.lastUsed = date;

    closeDialog("fundContributionDialog");

    renderAll();
    saveData();

    setStatus("Средствата са прехвърлени към фонда.");
}


/* =====================================================
   14. ПОСЛЕДНО ИЗПОЛЗВАНЕ НА СМЕТКИТЕ
===================================================== */

function updateLastUsedDates() {

    data.accounts.forEach(account => {

        const dates = data.records
            .filter(record =>
                record.active &&
                (
                    record.accountId === account.id ||
                    record.destinationAccountId === account.id
                )
            )
            .map(record => record.date)
            .filter(Boolean)
            .sort();

        account.lastUsed = dates.length
            ? dates[dates.length - 1]
            : null;
    });

    data.funds.forEach(fund => {

        const dates = data.records
            .filter(record =>
                record.active &&
                record.type === "fund" &&
                record.fundId === fund.id
            )
            .map(record => record.date)
            .filter(Boolean)
            .sort();

        fund.lastContribution = dates.length
            ? dates[dates.length - 1]
            : null;
    });
}


/* =====================================================
   15. ФИЛТРИ
===================================================== */

function populateFilterOptions() {

    const accountSelect =
        document.getElementById("filterAccount");

    const categorySelect =
        document.getElementById("filterCategory");

    accountSelect.innerHTML =
        '<option value="">Всички сметки</option>';

    data.accounts.forEach(account => {

        const option = document.createElement("option");

        option.value = account.id;
        option.textContent = account.name;

        accountSelect.appendChild(option);
    });

    categorySelect.innerHTML =
        '<option value="">Всички категории</option>';

    data.catalogs.categories
    .filter(category => category.active)
    .sort((a, b) => a.name.localeCompare(b.name, "bg"))
    .forEach(category => {

        const option = document.createElement("option");

        option.value = category.id;
        option.textContent = category.name;

        categorySelect.appendChild(option);
    });

    document.getElementById("filterType").value =
        activeFilters.type;

    document.getElementById("filterAccount").value =
        activeFilters.account;

    document.getElementById("filterStatus").value =
        activeFilters.status;

    document.getElementById("filterCategory").value =
        activeFilters.category;
}


function applyFilters(event) {

    event.preventDefault();

    activeFilters = {

        type: document.getElementById("filterType").value,

        account: document.getElementById("filterAccount").value,

        status: document.getElementById("filterStatus").value,

        category: document.getElementById("filterCategory").value
    };

    closeDialog("filterDialog");

    selectedRecordId = null;

    renderRecords();
}


function clearFilters() {

    activeFilters = {
        type: "",
        account: "",
        status: "",
        category: ""
    };

    populateFilterOptions();

    renderRecords();

    setStatus("Филтрите са изчистени.");
}


/* =====================================================
   16. ОБОБЩЕНИЕ
===================================================== */

function renderSummary() {

    const summary = calculateMonthSummary();

    document.getElementById("totalIncome").textContent =
        formatMoney(summary.income);

    document.getElementById("totalExpenses").textContent =
        formatMoney(summary.expenses);

    document.getElementById("totalBalance").textContent =
        formatMoney(summary.balance);

    document.getElementById("activeRecords").textContent =
        summary.activeCount;

    document.getElementById("totalBalance").style.color =
        summary.balance < 0 ? "#d00000" : "#159b25";
}


function renderOverview() {

    const summary = calculateMonthSummary();

    document.getElementById("overviewIncome").textContent =
        formatMoney(summary.income);

    document.getElementById("overviewExpenses").textContent =
        formatMoney(summary.expenses);

    document.getElementById("overviewBalance").textContent =
        formatMoney(summary.balance);

    document.getElementById("overviewAccounts").textContent =
        formatMoney(calculateTotalAccounts());

    document.getElementById("overviewFunds").textContent =
        formatMoney(calculateTotalFunds());

    const details = document.getElementById("overviewDetails");

    const categoryTotals = {};

    getSelectedPeriodRecords()
        .filter(record =>
            record.active &&
            record.type === "expense"
        )
        .forEach(record => {

            const category =
                CATEGORY_NAMES[record.category] || "Без категория";

            categoryTotals[category] =
                (categoryTotals[category] || 0) +
                Number(record.amount);
        });

    details.innerHTML = "";

    const heading = document.createElement("p");

    heading.textContent = "Разходи по категории:";

    details.appendChild(heading);

    const list = document.createElement("ul");

    Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, amount]) => {

            const item = document.createElement("li");

            item.textContent =
                `${category}: ${formatMoney(amount)}`;

            list.appendChild(item);
        });

    if (Object.keys(categoryTotals).length === 0) {

        const item = document.createElement("li");

        item.textContent = "Няма отчетени разходи.";

        list.appendChild(item);
    }

    details.appendChild(list);
}


/* =====================================================
   17. ПРИНТИРАНЕ
===================================================== */

function printRecords() {

    const records = [...sortByDate(
    getSelectedPeriodRecords()
    )].reverse();

    if (records.length === 0) {

        alert("Няма записи за принтиране.");
        return;
    }

    const summary = calculateMonthSummary();

    const printWindow = window.open(
        "",
        "_blank",
        "width=1000,height=700"
    );

    if (!printWindow) {

        alert("Браузърът блокира прозореца за принтиране.");
        return;
    }

    const rows = records.map(record => {

        const accountName = getAccountName(record.accountId);

        return `
            <tr>
                <td>${record.active ? "✓" : "✕"}</td>
                <td>${TYPE_NAMES[record.type] || record.type}</td>
                <td>${formatDate(record.date)}</td>
                <td>${formatMoney(record.amount)}</td>
                <td>${escapeHTML(accountName)}</td>
                <td>${escapeHTML(CATEGORY_NAMES[record.category] || "-")}</td>
                <td>${escapeHTML(record.source || "-")}</td>
                <td>${escapeHTML(record.description || "-")}</td>
            </tr>
        `;
    }).join("");

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="bg">
        <head>
            <meta charset="UTF-8">

            <title>Финансов отчет</title>

            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 25px;
                    color: #000;
                }

                h2 {
                    margin-bottom: 5px;
                }

                .summary {
                    margin: 20px 0;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                th, td {
                    border: 1px solid #888;
                    padding: 7px;
                    text-align: left;
                    font-size: 11px;
                }

                th {
                    background: #eee;
                }

                @media print {
                    button {
                        display: none;
                    }
                }
            </style>
        </head>

        <body>

            <h2>Финансов организатор</h2>

            <p>
                Финансов отчет за ${MONTHS[selectedMonth]} ${selectedYear}
            </p>

            <div class="summary">
                <p>Общо приходи: ${formatMoney(summary.income)}</p>
                <p>Общо разходи: ${formatMoney(summary.expenses)}</p>
                <p>Баланс: ${formatMoney(summary.balance)}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Статус</th>
                        <th>Вид</th>
                        <th>Дата</th>
                        <th>Стойност</th>
                        <th>Сметка</th>
                        <th>Категория</th>
                        <th>Източник</th>
                        <th>Описание</th>
                    </tr>
                </thead>

                <tbody>
                    ${rows}
                </tbody>
            </table>

            <br>

            <button onclick="window.print()">Принтирай</button>

        </body>
        </html>
    `);

    printWindow.document.close();

    printWindow.focus();
}


function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, character => {

        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}


/* =====================================================
   18. ЕКСПОРТИРАНЕ В CSV
===================================================== */

function exportRecords() {

    const records = sortByDate(
        getSelectedPeriodRecords()
    );

    if (records.length === 0) {

        alert("Няма записи за експортиране.");
        return;
    }

    const headers = [
        "Статус",
        "Вид",
        "Дата",
        "Стойност EUR",
        "Сметка",
        "Получаваща сметка",
        "Категория",
        "Източник",
        "Описание"
    ];

    const rows = records.map(record => [

        record.active ? "Активен" : "Неактивен",

        TYPE_NAMES[record.type] || record.type,

        record.date,

        Number(record.amount).toFixed(2),

        getAccountName(record.accountId),

        record.destinationAccountId
            ? getAccountName(record.destinationAccountId)
            : "",

        CATEGORY_NAMES[record.category] || "",

        record.source || "",

        record.description || ""

    ]);

    const csv = [headers, ...rows]
        .map(row =>
            row.map(value =>
                '"' + String(value).replace(/"/g, '""') + '"'
            ).join(";")
        )
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
        `Finansov_otchet_${selectedYear}_${String(selectedMonth + 1).padStart(2, "0")}.csv`;

    link.click();

    URL.revokeObjectURL(url);

    setStatus("Отчетът е експортиран.");
}


/* =====================================================
   19. ОБНОВЯВАНЕ НА ЦЯЛОТО ПРИЛОЖЕНИЕ
===================================================== */

function renderAll() {

    updateLastUsedDates();

    renderYearTree();

    renderRecords();

    renderAccounts();

    renderFunds();

    renderSummary();

    populateAccountSelect("recordAccount");

    populateAccountSelect("destinationAccount");

    populateAccountSelect("contributionAccount");

    populateFilterOptions();

    updateRecordTypeFields();

    updateRecordToolbarState();
}


/* =====================================================
   20. ДОПЪЛНИТЕЛЕН БУТОН ЗА ПРЕМАХВАНЕ НА МЕСЕЦ
===================================================== */

function createRemoveMonthButton() {

    const sidebarActions =
        document.querySelector(".sidebar-actions");

    if (!sidebarActions) return;

    if (document.getElementById("removeMonthButton")) return;

    const button = document.createElement("button");

    button.type = "button";

    button.id = "removeMonthButton";

    button.textContent = "M−";

    button.title = "Премахни избрания месец";

    button.addEventListener("click", removeMonth);

    sidebarActions.appendChild(button);
}


/* =====================================================
   21. СВЪРЗВАНЕ НА БУТОНИТЕ И ФОРМИТЕ
===================================================== */

function initializeEvents() {

    // Години и месеци

    document.getElementById("addYearButton")
        .addEventListener("click", addYear);

    document.getElementById("removeYearButton")
        .addEventListener("click", removeYear);


    // Записи

    document.getElementById("addRecordButton")
        .addEventListener("click", addRecord);

    document.getElementById("editRecordButton")
        .addEventListener("click", editRecord);

    document.getElementById("deleteRecordButton")
        .addEventListener("click", deleteRecord);

    document.getElementById("activateRecordButton")
        .addEventListener("click", () =>
            changeRecordStatus(true)
        );

    document.getElementById("deactivateRecordButton")
        .addEventListener("click", () =>
            changeRecordStatus(false)
        );

    document.getElementById("recordForm")
        .addEventListener("submit", saveRecord);

        // Смяна на статуса на записа

document.getElementById("recordActiveButton")
    .addEventListener("click", () => {

        const checkbox =
            document.getElementById("recordActive");

        checkbox.checked = !checkbox.checked;

        updateRecordActiveButton();

    });

    document.getElementById("recordType")
        .addEventListener("change", updateRecordTypeFields);


    // Система за категории, източници и доставчици
    initializeCatalogEvents();
    // Сметки

    document.getElementById("accountsButton")
        .addEventListener("click", () => {

            renderAccounts();
            openDialog("accountsDialog");
        });

    document.getElementById("addAccountButton")
        .addEventListener("click", addAccount);

    document.getElementById("editAccountButton")
        .addEventListener("click", editAccount);

    document.getElementById("deleteAccountButton")
        .addEventListener("click", deleteAccount);

    document.getElementById("viewAccountButton")
        .addEventListener("click", viewAccount);

    document.getElementById("accountForm")
        .addEventListener("submit", saveAccount);


    // Фондове

    document.getElementById("fundsButton")
        .addEventListener("click", () => {

            renderFunds();
            openDialog("fundsDialog");
        });

    document.getElementById("addFundButton")
        .addEventListener("click", addFund);

    document.getElementById("editFundButton")
        .addEventListener("click", editFund);

    document.getElementById("deleteFundButton")
        .addEventListener("click", deleteFund);

    document.getElementById("viewFundButton")
        .addEventListener("click", viewFund);

    document.getElementById("contributeFundButton")
        .addEventListener("click", addFundContribution);

    document.getElementById("fundForm")
        .addEventListener("submit", saveFund);

    document.getElementById("fundContributionForm")
        .addEventListener("submit", saveFundContribution);


    // Филтри

    document.getElementById("filterButton")
        .addEventListener("click", () => {

            populateFilterOptions();
            openDialog("filterDialog");
        });

    document.getElementById("filterForm")
        .addEventListener("submit", applyFilters);

    document.getElementById("clearFiltersButton")
        .addEventListener("click", clearFilters);


    // Обобщение

    document.getElementById("overviewButton")
        .addEventListener("click", () => {

            renderOverview();
            openDialog("overviewDialog");
        });

        // Архив

document.getElementById("archiveButton")
    .addEventListener("click", openArchiveWindow);


// Затваряне на архива

document.getElementById("closeArchiveButton")
    .addEventListener("click", closeArchiveWindow);

document.getElementById("cancelArchiveButton")
    .addEventListener("click", closeArchiveWindow);


// Затваряне при клик извън прозореца

document.getElementById("archiveWindow")
    .addEventListener("click", event => {

        if (event.target.id === "archiveWindow") {
            closeArchiveWindow();
        }

    });


// Затваряне с Escape

document.addEventListener("keydown", event => {

    const archiveWindow =
        document.getElementById("archiveWindow");

    if (
        event.key === "Escape" &&
        archiveWindow.style.display === "flex"
    ) {

        closeArchiveWindow();

    }

});



// ТЪРСЕНЕ НА ЗАПИСИ

const searchButton =
    document.getElementById("searchButton");

if (searchButton) {

    searchButton.addEventListener("click", () => {

        selectedSearchRecordId = null;

        searchRecords();

        openDialog("searchDialog");

        document.getElementById("recordSearchText").focus();

    });

}


// Автоматично търсене при промяна на критериите

[
    "recordSearchText",
    "recordSearchType",
    "recordSearchCategory",
    "recordSearchStatus",
    "recordSearchFrom",
    "recordSearchTo"

].forEach(id => {

    document.getElementById(id)
        .addEventListener("input", searchRecords);

});


// Изчистване на търсенето

document.getElementById("clearRecordSearchButton")
    .addEventListener("click", () => {

        document.getElementById("recordSearchText").value = "";

        document.getElementById("recordSearchType").value = "";

        document.getElementById("recordSearchCategory").value = "";

        document.getElementById("recordSearchStatus").value = "";

        document.getElementById("recordSearchFrom").value = "";

        document.getElementById("recordSearchTo").value = "";

        selectedSearchRecordId = null;

        searchRecords();

    });


// Отваряне на избрания резултат

document.getElementById("openSearchResultButton")
    .addEventListener("click", openSelectedSearchRecord);



    // Други бутони

    document.getElementById("printButton")
        .addEventListener("click", printRecords);

    document.getElementById("exportButton")
        .addEventListener("click", exportRecords);

    document.getElementById("refreshButton")
        .addEventListener("click", () => {

            renderAll();

            setStatus("Информацията е обновена.");
        });


    // Потвърждение

    document.getElementById("confirmYesButton")
        .addEventListener("click", () => {

            const callback = confirmCallback;

            confirmCallback = null;

            closeDialog("confirmDialog");

            if (callback) {
                callback();
            }
        });


    // Всички бутони за затваряне на прозорци

    document.querySelectorAll("[data-close]").forEach(button => {

        button.addEventListener("click", () => {

            closeDialog(button.dataset.close);
        });
    });


    // Затваряне при клик извън прозореца

    document.querySelectorAll("dialog").forEach(dialog => {

        dialog.addEventListener("click", event => {

            if (event.target === dialog) {
                dialog.close();
            }
        });
    });

}


/* =====================================================
   22. СТАРТИРАНЕ НА ПРИЛОЖЕНИЕТО
===================================================== */

// function initializeApplication() {

//     createRemoveMonthButton();

//     initializeEvents();

//     renderAll();

//     saveData();

//     setStatus("Финансов организатор е готов за работа.");
// }




/* =====================================================
   ДОПЪЛНИТЕЛНИ ФУНКЦИИ
   ИНСТРУМЕНТИ, НАРЪЧНИК И СТАТУС ЛЕНТА
===================================================== */


/* =====================================================
   1. ИНФОРМАЦИОННА СТАТУС ЛЕНТА
===================================================== */

function updateUserStatusBar() {

    const userNameElement =
        document.getElementById("currentUserName");

    const dateElement =
        document.getElementById("currentDateDisplay");

    if (userNameElement) {
        userNameElement.textContent =
            currentUser.username || "Потребител";
    }

    if (dateElement) {

        dateElement.textContent =
            new Date().toLocaleDateString("bg-BG", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });

    }

}


/* =====================================================
   2. БЕЗОПАСНО ИЗЧИСЛЯВАНЕ НА МАТЕМАТИЧЕСКИ ИЗРАЗИ
===================================================== */

function evaluateCalculatorExpression(expression) {

    const tokens = expression.match(
        /(?:\d+\.?\d*|\.\d+)|[+\-*/]/g
    );

    if (!tokens || tokens.join("") !== expression.replace(/\s/g, "")) {
        throw new Error("Невалиден израз");
    }

    const output = [];
    const operators = [];

    const precedence = {
        "+": 1,
        "-": 1,
        "*": 2,
        "/": 2
    };

    let expectingNumber = true;

    tokens.forEach(token => {

        if (!isNaN(Number(token))) {

            if (!expectingNumber) {
                throw new Error("Невалиден израз");
            }

            output.push(Number(token));
            expectingNumber = false;

        } else {

            if (expectingNumber) {

                if (token === "-") {
                    output.push(0);
                } else {
                    throw new Error("Невалиден израз");
                }

            }

            while (
                operators.length &&
                precedence[operators[operators.length - 1]] >= precedence[token]
            ) {

                output.push(operators.pop());

            }

            operators.push(token);
            expectingNumber = true;

        }

    });

    if (expectingNumber) {
        throw new Error("Невалиден израз");
    }

    while (operators.length) {
        output.push(operators.pop());
    }

    const stack = [];

    output.forEach(token => {

        if (typeof token === "number") {

            stack.push(token);
            return;

        }

        const b = stack.pop();
        const a = stack.pop();

        if (a === undefined || b === undefined) {
            throw new Error("Невалиден израз");
        }

        let result;

        switch (token) {

            case "+":
                result = a + b;
                break;

            case "-":
                result = a - b;
                break;

            case "*":
                result = a * b;
                break;

            case "/":

                if (b === 0) {
                    throw new Error("Деление на нула");
                }

                result = a / b;
                break;

        }

        stack.push(result);

    });

    if (stack.length !== 1 || !Number.isFinite(stack[0])) {
        throw new Error("Невалиден резултат");
    }

    return stack[0];

}





/* =====================================================
   АВТОМАТИЧНИ ВАЛУТНИ КУРСОВЕ
===================================================== */

const CURRENCY_CACHE_KEY =
    "financialOrganizerCurrencyRates_v1";


async function loadCurrencyRates() {

    const info =
        document.getElementById("currencyRateInfo");

    if (info) {
        info.textContent = "Зареждане на валутните курсове...";
    }

    try {

        const url = new URL(
            "https://api.frankfurter.dev/v2/providers/ecb/rates"
        );

        url.search = new URLSearchParams({
            base: "EUR",
            quotes: "USD,GBP,CHF"
        }).toString();

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Грешка при зареждане на курсовете.");
        }

        const rows = await response.json();

        if (!Array.isArray(rows) || rows.length === 0) {
            throw new Error("Няма налични валутни курсове.");
        }

        const rates = {
            EUR: 1,
            BGN: 1.95583
        };

        rows.forEach(item => {

            rates[item.quote] = Number(item.rate);

        });

        if (
            !rates.USD ||
            !rates.GBP ||
            !rates.CHF
        ) {
            throw new Error("Липсват валутни данни.");
        }

        const currencyData = {
            rates: rates,
            date: rows[0].date,
            updatedAt: Date.now()
        };

        localStorage.setItem(
            CURRENCY_CACHE_KEY,
            JSON.stringify(currencyData)
        );

        if (info) {
            info.textContent =
                "Курсове от ЕЦБ. Дата: " +
                currencyData.date;
        }

        return currencyData;

    } catch (error) {

        console.error("Валутни курсове:", error);

        const savedData = localStorage.getItem(
            CURRENCY_CACHE_KEY
        );

        if (savedData) {

            try {

                const cached = JSON.parse(savedData);

                if (cached.rates) {

                    if (info) {
                        info.textContent =
                            "Офлайн режим. Използват се запазени курсове от: " +
                            cached.date;
                    }

                    return {
                        ...cached,
                        offline: true
                    };

                }

            } catch (cacheError) {

                console.error(
                    "Грешка при прочитане на запазените курсове:",
                    cacheError
                );

            }

        }

        if (info) {
            info.textContent =
                "Неуспешно зареждане. Провери интернет връзката.";
        }

        throw error;

    }

}


/* =====================================================
   ПРЕОБРАЗУВАНЕ НА ВАЛУТИ
===================================================== */

function calculateCurrencyConversion(
    amount,
    from,
    to,
    rates
) {

    if (
        !rates[from] ||
        !rates[to]
    ) {
        throw new Error("Невалидна валута.");
    }

    const converted =
        amount * (rates[to] / rates[from]);

    return {
        result: converted,
        rate: rates[to] / rates[from]
    };

}




/* =====================================================
   3. ИНИЦИАЛИЗИРАНЕ НА ИНСТРУМЕНТИТЕ
===================================================== */

function initializeUtilityTools() {

    const toolButtons =
        document.querySelectorAll(".tool-nav-button");

    const toolPanels =
        document.querySelectorAll(".tool-panel");


    /* ПРЕВКЛЮЧВАНЕ МЕЖДУ КАЛКУЛАТОРИТЕ */

    toolButtons.forEach(button => {

        button.addEventListener("click", () => {

            const targetId = button.dataset.tool;

            toolButtons.forEach(item => {
                item.classList.toggle("active", item === button);
            });

            toolPanels.forEach(panel => {

                const active = panel.id === targetId;

                panel.hidden = !active;
                panel.classList.toggle("active", active);

            });

        });

    });


    /* ОСНОВЕН КАЛКУЛАТОР */

    const display =
        document.getElementById("basicCalcDisplay");

    document.querySelectorAll("[data-calc]").forEach(button => {

        button.addEventListener("click", () => {

            const value = button.dataset.calc;

            if (display.value === "Грешка") {
                display.value = "0";
            }

            if (/^[0-9.]$/.test(value)) {

                if (
                    value === "." &&
                    display.value.split(/[+\-*/]/).pop().includes(".")
                ) {
                    return;
                }

                display.value =
                    display.value === "0" && value !== "."
                        ? value
                        : display.value + value;

            } else {

                if (display.value === "0") {
                    return;
                }

                display.value += value;

            }

        });

    });


    document.getElementById("calcClear")
        .addEventListener("click", () => {

            display.value = "0";

        });


    document.getElementById("calcEquals")
        .addEventListener("click", () => {

            try {

                const result =
                    evaluateCalculatorExpression(display.value);

                display.value =
                    String(Number(result.toFixed(10)));

            } catch (error) {

                display.value = "Грешка";

            }

        });


   
/* =====================================================
   ВАЛУТЕН КОНВЕРТОР
===================================================== */

let currentCurrencyData = null;


/* Зареждане при избор на валутния калкулатор */

async function refreshCurrencyRates() {

    try {

        currentCurrencyData = await loadCurrencyRates();

    } catch (error) {

        currentCurrencyData = null;

    }

}


/* Бутон за ръчно обновяване */

document.getElementById("refreshCurrencyRatesButton")
    .addEventListener("click", async () => {

        await refreshCurrencyRates();

    });


/* Автоматично зареждане при отваряне на калкулатора */

const currencyNavigationButton =
    document.querySelector(
        '.tool-nav-button[data-tool="currencyCalculator"]'
    );

if (currencyNavigationButton) {

    currencyNavigationButton.addEventListener(
        "click",
        refreshCurrencyRates
    );

}


/* Преобразуване */

document.getElementById("convertCurrencyButton")
    .addEventListener("click", async () => {

        const amountInput =
            document.getElementById("currencyAmount");

        const amount = Number(amountInput.value);

        const from =
            document.getElementById("currencyFrom").value;

        const to =
            document.getElementById("currencyTo").value;

        const output =
            document.getElementById("currencyResult");

        if (
            amountInput.value === "" ||
            !Number.isFinite(amount) ||
            amount < 0
        ) {

            output.textContent =
                "Въведи валидна сума.";

            return;

        }

        try {

            if (!currentCurrencyData) {
                await refreshCurrencyRates();
            }

            if (!currentCurrencyData) {
                throw new Error("Няма налични курсове.");
            }

            const conversion =
                calculateCurrencyConversion(
                    amount,
                    from,
                    to,
                    currentCurrencyData.rates
                );

            const formattedResult =
                conversion.result.toLocaleString(
                    "bg-BG",
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4
                    }
                );

            const formattedRate =
                conversion.rate.toLocaleString(
                    "bg-BG",
                    {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 6
                    }
                );

            output.innerHTML = `
                <strong>
                    ${amount.toLocaleString("bg-BG")} ${from}
                    =
                    ${formattedResult} ${to}
                </strong>

                <br>

                <small>
                    1 ${from} = ${formattedRate} ${to}
                </small>
            `;

        } catch (error) {

            output.textContent =
                "Неуспешно преобразуване. " + error.message;

        }

    });

    /* КАЛКУЛАТОР ЗА ПРОЦЕНТИ */

    document.getElementById("calculatePercentButton")
        .addEventListener("click", () => {

            const baseInput =
                document.getElementById("percentBase").value;

            const percentInput =
                document.getElementById("percentValue").value;

            const base = Number(baseInput);
            const percent = Number(percentInput);

            const output =
                document.getElementById("percentResult");

            if (
                baseInput === "" ||
                percentInput === "" ||
                !Number.isFinite(base) ||
                !Number.isFinite(percent)
            ) {

                output.textContent =
                    "Попълни валидна сума и процент.";

                return;

            }

            const result = base * percent / 100;

            output.textContent =
                `${percent}% от ${base} = ` +
                result.toLocaleString("bg-BG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });

        });


    document.getElementById("calculateShareButton")
        .addEventListener("click", () => {

            const baseInput =
                document.getElementById("percentBase").value;

            const partInput =
                document.getElementById("percentPart").value;

            const base = Number(baseInput);
            const part = Number(partInput);

            const output =
                document.getElementById("shareResult");

            if (
                baseInput === "" ||
                partInput === "" ||
                !Number.isFinite(base) ||
                !Number.isFinite(part) ||
                base === 0
            ) {

                output.textContent =
                    "Въведи част и ненулева основна сума.";

                return;

            }

            const result = part / base * 100;

            output.textContent =
                `${part} представлява ` +
                `${result.toLocaleString("bg-BG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}% от ${base}.`;

        });


    /* КАЛКУЛАТОР ЗА СПЕСТЯВАНИЯ */

    document.getElementById("calculateSavingsButton")
        .addEventListener("click", () => {

            const start =
                Number(document.getElementById("savingStart").value);

            const monthly =
                Number(document.getElementById("savingMonthly").value);

            const months =
                Number(document.getElementById("savingMonths").value);

            const output =
                document.getElementById("savingsResult");

            if (
                [start, monthly, months].some(
                    value => !Number.isFinite(value) || value < 0
                ) ||
                !Number.isInteger(months)
            ) {

                output.textContent =
                    "Въведи валидни неотрицателни стойности.";

                return;

            }

            const total = start + monthly * months;

            output.textContent =
                `Очаквана сума: ${total.toLocaleString("bg-BG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })} €`;

        });


    /* БЮДЖЕТЕН КАЛКУЛАТОР */

    document.getElementById("calculateBudgetButton")
        .addEventListener("click", () => {

            const incomeInput =
                document.getElementById("budgetIncome").value;

            const fixedInput =
                document.getElementById("budgetFixed").value;

            const otherInput =
                document.getElementById("budgetOther").value;

            const income = Number(incomeInput);
            const fixed = Number(fixedInput);
            const other = Number(otherInput);

            const output =
                document.getElementById("budgetResult");

            if (
                [incomeInput, fixedInput, otherInput].some(value => value === "") ||
                [income, fixed, other].some(
                    value => !Number.isFinite(value) || value < 0
                )
            ) {

                output.textContent =
                    "Попълни всички полета с валидни стойности.";

                return;

            }

            const remaining = income - fixed - other;

            output.textContent =
                `Оставащи средства: ${remaining.toLocaleString("bg-BG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })} €`;

        });

}


/* =====================================================
   4. СЪДЪРЖАНИЕ НА НАРЪЧНИКА
===================================================== */

function initializeManual() {

    const article =
        document.getElementById("manualArticle");

    if (!article) return;


    const topics = {

        intro: {
            title: "За приложението",
            image: "images/manual/intro.png",
            caption: "Финансов организатор",
            content: `
                <p class="manual-lead">
                    „Финансов организатор“ е локално уеб приложение
                    за управление на лични финанси.
                </p>

                <p>
                    Приложението предоставя възможност за организиране
                    на финансови операции, сметки, фондове и периоди.
                </p>

                <h3>Основни функции</h3>

                <ul>
                    <li>Управление на финансови операции.</li>
                    <li>Организиране на години и месеци.</li>
                    <li>Управление на сметки.</li>
                    <li>Управление на фондове.</li>
                    <li>Преглед на финансово обобщение.</li>
                    <li>Архивиране и резервни копия.</li>
                </ul>
            `
        },

        interface: {
            title: "Начална страница",
            image: "images/manual/interface.png",
            caption: "Основният интерфейс на приложението",
            content: `
                <p class="manual-lead">
                    Началната страница е разделена на няколко основни области.
                </p>

                <h3>Горен хедър</h3>
                <p>
                    Съдържа бутоните за сметки, фондове, обобщение,
                    архив, резервно копие, инструменти, наръчник и изход.
                </p>

                <h3>Лява странична лента</h3>
                <p>
                    Използва се за избор на финансова година и месец.
                </p>

                <h3>Централна работна област</h3>
                <p>
                    Показва финансовото обобщение, лентата с операции
                    и таблицата със записите за избрания период.
                </p>
            `
        },

        profiles: {
            title: "Потребителски профили",
            image: "images/manual/profiles.png",
            caption: "Потребителски профили",
            content: `
                <p class="manual-lead">
                    Всеки профил има отделни финансови данни.
                </p>

                <p>
                    От страницата за вход можеш да създаваш,
                    преименуваш и изтриваш профили.
                </p>

                <h3>Важно</h3>

                <div class="manual-warning">
                    При изтриване на профил се премахват и данните,
                    свързани с него. Увери се, че имаш резервно копие,
                    ако искаш да запазиш информацията.
                </div>
            `
        },

        periods: {
            title: "Години и месеци",
            image: "images/manual/periods.png",
            caption: "Избор на финансов период",
            content: `
                <p class="manual-lead">
                    Финансовите записи се организират по години и месеци.
                </p>

                <ol>
                    <li>Намери желаната година в лявата лента.</li>
                    <li>Разгъни годината.</li>
                    <li>Избери желания месец.</li>
                </ol>

                <p>
                    След избора таблицата показва записите за този период.
                </p>
            `
        },

        records: {
            title: "Финансови операции",
            image: "images/manual/records.png",
            caption: "Таблица с финансови операции",
            content: `
                <p class="manual-lead">
                    Таблицата съдържа финансовите записи за избрания период.
                </p>

                <h3>Работа със записите</h3>

                <ul>
                    <li>Добавяне на нов запис.</li>
                    <li>Редактиране на избран запис.</li>
                    <li>Изтриване на избран запис.</li>
                    <li>Активиране и деактивиране.</li>
                    <li>Филтриране и обновяване.</li>
                    <li>Експортиране и принтиране.</li>
                </ul>

                <h3>Видове операции</h3>

                <p>
                    Приложението поддържа приходи, разходи,
                    прехвърляния, вноски във фонд и възстановени суми.
                </p>
            `
        },

        accounts: {
            title: "Сметки",
            image: "images/manual/accounts.png",
            caption: "Управление на сметки",
            content: `
                <p class="manual-lead">
                    Прозорецът „Сметки“ позволява управление на наличните сметки.
                </p>

                <ul>
                    <li>Добавяне на сметка.</li>
                    <li>Редактиране на сметка.</li>
                    <li>Изтриване на сметка.</li>
                    <li>Преглед на подробна информация.</li>
                </ul>
            `
        },

        funds: {
            title: "Фондове",
            image: "images/manual/funds.png",
            caption: "Управление на фондове",
            content: `
                <p class="manual-lead">
                    Фондовете позволяват да отделяш средства за различни цели.
                </p>

                <ul>
                    <li>Създаване на фонд.</li>
                    <li>Редактиране и изтриване.</li>
                    <li>Преглед на информация за фонда.</li>
                    <li>Добавяне на вноска.</li>
                </ul>
            `
        },

        overview: {
            title: "Финансово обобщение",
            image: "images/manual/overview.png",
            caption: "Финансово обобщение",
            content: `
                <p class="manual-lead">
                    Обобщението показва основните финансови показатели
                    за избрания период.
                </p>

                <p>
                    В основния панел се виждат общите приходи,
                    общите разходи, балансът и броят активни записи.
                </p>

                <p>
                    Чрез бутона „Обобщение“ се отваря отделен прозорец
                    с допълнителна информация.
                </p>
            `
        },

        archives: {
            title: "Архивиране и отчети",
            image: "images/manual/archives.png",
            caption: "Архивиране на периоди",
            content: `
                <p class="manual-lead">
                    Архивът позволява да преглеждаш приключили финансови периоди.
                </p>

                <p>
                    Архивирането има отделен прозорец и потвърждение.
                    Архивираните периоди имат ограничения за редакция.
                </p>

                <p>
                    В архивните отчети се показват обобщени показатели,
                    таблици и сравнения.
                </p>
            `
        },

        backup: {
            title: "Резервни копия",
            image: "images/manual/backup.png",
            caption: "Резервно копие",
            content: `
                <p class="manual-lead">
                    Резервните копия позволяват да запазиш финансовата информация
                    във файл и да я възстановиш при необходимост.
                </p>

                <div class="manual-warning">
                    Преди възстановяване на копие е разумно да запазиш
                    и текущите данни, защото възстановяването може да ги замени.
                </div>
            `
        },

        storage: {
            title: "Съхранение на данните",
            image: "images/manual/storage.png",
            caption: "Локално съхранение",
            content: `
                <p class="manual-lead">
                    Приложението използва LocalStorage за финансовите данни
                    и SessionStorage за текущата потребителска сесия.
                </p>

                <p>
                    Данните се съхраняват в браузъра на текущото устройство.
                </p>

                <div class="manual-warning">
                    Изчистването на данните на сайта или загубата на браузърния
                    профил може да доведе до загуба на информация.
                    Създавай резервни копия редовно.
                </div>
            `
        },

        tools: {
            title: "Инструменти",
            image: "images/manual/tools.png",
            caption: "Допълнителни калкулатори",
            content: `
                <p class="manual-lead">
                    Инструментите предоставят помощни калкулатори,
                    които не променят финансовите записи.
                </p>

                <ul>
                    <li>Основен математически калкулатор.</li>
                    <li>Валутен конвертор с ръчно въведен курс.</li>
                    <li>Калкулатор за проценти.</li>
                    <li>Калкулатор за спестявания.</li>
                    <li>Бюджетен калкулатор.</li>
                </ul>
            `
        },

        status: {
            title: "Статус лента",
            image: "images/manual/status.png",
            caption: "Информационна лента",
            content: `
                <p class="manual-lead">
                    Долните статусни ленти показват информация за текущата работа.
                </p>

                <ul>
                    <li>Системни съобщения.</li>
                    <li>Използвана валута.</li>
                    <li>Версия на приложението.</li>
                    <li>Текущ потребител.</li>
                    <li>Текуща дата.</li>
                    <li>Информация за локалното съхранение.</li>
                </ul>
            `
        }

    };


    /* ПОКАЗВАНЕ НА ТЕМА */

    function showManualTopic(topicId) {

        const topic = topics[topicId];

        if (!topic) return;

        document.querySelectorAll(".manual-topic").forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.topic === topicId
            );

        });

        article.innerHTML = `

            <h2>${topic.title}</h2>

            <figure>

                <img
                    src="${topic.image}"
                    alt="${topic.caption}"
                    onerror="this.style.display='none'">

                <figcaption>${topic.caption}</figcaption>

            </figure>

            ${topic.content}

        `;

        article.scrollTop = 0;

    }


    /* ИЗБОР НА ТЕМА */

    document.querySelectorAll(".manual-topic").forEach(button => {

        button.addEventListener("click", () => {

            showManualTopic(button.dataset.topic);

        });

    });


    /* РАЗГЪВАНЕ И СВИВАНЕ НА ДЪРВОТО */

document.querySelectorAll(".manual-group-toggle").forEach(button => {

    const group =
        button.closest(".manual-tree-group");

    const subtopics =
        group.querySelector(".manual-subtopics");

    const toggleBox =
        button.querySelector(".manual-tree-toggle-box");


    // Начално състояние

    const initiallyExpanded =
        button.getAttribute("aria-expanded") === "true";

    if (toggleBox) {

        toggleBox.textContent =
            initiallyExpanded ? "−" : "+";

    }

    subtopics.classList.toggle(
        "collapsed",
        !initiallyExpanded
    );


    // При натискане

    button.addEventListener("click", () => {

        const expanded =
            button.getAttribute("aria-expanded") === "true";


        button.setAttribute(
            "aria-expanded",
            String(!expanded)
        );


        subtopics.classList.toggle(
            "collapsed",
            expanded
        );


        if (toggleBox) {

            toggleBox.textContent =
                expanded ? "+" : "−";

        }

    });

});


    showManualTopic("intro");

}


/* =====================================================
   5. СВЪРЗВАНЕ НА НОВИТЕ БУТОНИ
===================================================== */

function initializeExtraFeatures() {

    initializeUtilityTools();

    initializeManual();


    document.getElementById("toolsButton")
        .addEventListener("click", () => {

            openDialog("toolsDialog");

        });


    document.getElementById("manualButton")
        .addEventListener("click", () => {

            openDialog("manualDialog");

        });

}




function initializeApplication() {

    createRemoveMonthButton();

    initializeEvents();

    initializeExtraFeatures();

    renderAll();

    saveData();

    updateUserStatusBar();

    setStatus("Финансов организатор е готов за работа.");
}



/* ==========================================
   ИЗЛИЗАНЕ ОТ ПОТРЕБИТЕЛСКИЯ ПРОФИЛ
========================================== */

document.getElementById("logoutButton").addEventListener("click", () => {

    const confirmed = confirm(
        "Сигурни ли сте, че искате да излезете от профила?"
    );

    if (!confirmed) return;

    // Премахваме само активната сесия
    sessionStorage.removeItem("financialOrganizerCurrentUser");

    // Връщаме към страницата за вход
    window.location.replace("login.html");

});




/* ==========================================
   BACKUP SYSTEM
========================================== */

(() => {

    const backupButton = document.getElementById("backupButton");
    const backupWindow = document.getElementById("backupWindow");

    const closeButton = document.getElementById("closeBackupButton");
    const cancelButton = document.getElementById("cancelBackupButton");

    const createButton = document.getElementById("createBackupButton");
    const restoreButton = document.getElementById("restoreBackupButton");

    const fileInput = document.getElementById("backupFileInput");
    const message = document.getElementById("backupMessage");


    // Отваряне на прозореца
    function openBackupWindow() {
        backupWindow.style.display = "flex";
        message.textContent = "";
        closeButton.focus();
    }


    // Затваряне на прозореца
    function closeBackupWindow() {
        backupWindow.style.display = "none";
        fileInput.value = "";
    }


    // Създаване на резервно копие
    function createBackup() {

        try {

            // Запазваме актуалните данни
            if (typeof saveData === "function") {
                saveData();
            }

            const storedData = localStorage.getItem(STORAGE_KEY);

            if (!storedData) {
                throw new Error("Не са открити финансови данни.");
            }

            const data = JSON.parse(storedData);

            const backup = {
                application: "Financial Organizer",
                version: 1,
                createdAt: new Date().toISOString(),
                username: currentUser.username,
                data: data
            };

            const json = JSON.stringify(backup, null, 4);

            const blob = new Blob(
                [json],
                { type: "application/json;charset=utf-8" }
            );

            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");

            const date = new Date().toISOString()
                .replace(/:/g, "-")
                .slice(0, 19);

            link.href = url;
            link.download = `FinancialOrganizer_Backup_${date}.json`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            URL.revokeObjectURL(url);

            message.textContent =
                "Резервното копие е създадено успешно!";

        } catch (error) {

            console.error("Backup error:", error);

            message.textContent =
                "Грешка при създаването на резервното копие.";

        }
    }


    // Избиране на файл за възстановяване
    function selectBackupFile() {
        fileInput.click();
    }


    // Възстановяване на данни
    async function restoreBackup(event) {

        const file = event.target.files[0];

        if (!file) return;

        try {

            const text = await file.text();
            const backup = JSON.parse(text);

            // Проверка на файла
            if (
                backup.application !== "Financial Organizer" ||
                !backup.data ||
                typeof backup.data !== "object" ||
                Array.isArray(backup.data)
            ) {
                throw new Error("Невалиден файл за резервно копие.");
            }

            const data = backup.data;

            // Проверка на основните масиви
            if (
                !Array.isArray(data.years) ||
                !Array.isArray(data.records) ||
                !Array.isArray(data.accounts) ||
                !Array.isArray(data.funds)
            ) {
                throw new Error("Файлът съдържа невалидна структура.");
            }

            const confirmed = confirm(
                "ВНИМАНИЕ!\n\n" +
                "Възстановяването ще замени всички текущи данни " +
                "в профила " + currentUser.username + ".\n\n" +
                "Препоръчително е първо да създадете резервно копие.\n\n" +
                "Желаете ли да продължите?"
            );

            if (!confirmed) {
                fileInput.value = "";
                return;
            }

            // Запазване на възстановените данни
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(data)
            );

            alert(
                "Данните са възстановени успешно!\n" +
                "Програмата ще се презареди."
            );

            window.location.reload();

        } catch (error) {

            console.error("Restore error:", error);

            alert(
                "Неуспешно възстановяване!\n\n" +
                error.message
            );

        }

        fileInput.value = "";
    }


    // Събития
    if (backupButton) {
        backupButton.addEventListener("click", openBackupWindow);
    }

    if (closeButton) {
        closeButton.addEventListener("click", closeBackupWindow);
    }

    if (cancelButton) {
        cancelButton.addEventListener("click", closeBackupWindow);
    }

    if (createButton) {
        createButton.addEventListener("click", createBackup);
    }

    if (restoreButton) {
        restoreButton.addEventListener("click", selectBackupFile);
    }

    if (fileInput) {
        fileInput.addEventListener("change", restoreBackup);
    }

})();







document.addEventListener(
    "DOMContentLoaded",
    initializeApplication
);
