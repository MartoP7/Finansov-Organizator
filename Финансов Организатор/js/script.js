
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


/* =====================================================
   2. НАЧАЛНИ ДАННИ
===================================================== */

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
        funds: []
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
            ...parsed
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
                <p>Подробен финансов отчет на архивирания период</p>
            </div>

            <div class="archive-detail-actions">

                <button type="button" id="archiveExportCSV">
                    Експорт CSV
                </button>

                <button type="button" id="archiveExportPDF">
                    Експорт PDF
                </button>

                <button type="button" id="archiveRestoreButton">
                    Възстановяване
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
                    Сравни
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

    document.getElementById("recordId").value = "";

    document.getElementById("recordDialogTitle").textContent =
        "Добавяне на нов запис";

    document.getElementById("recordDate").value = todayString();

    document.getElementById("recordActive").checked = false;

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

    document.getElementById("recordDescription").value =
        record.description || "";

    document.getElementById("recordCategory").value =
        record.category || "";

    document.getElementById("recordActive").checked =
        record.active;

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

    Object.entries(CATEGORY_NAMES).forEach(([key, name]) => {

        const option = document.createElement("option");

        option.value = key;
        option.textContent = name;

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

    document.getElementById("recordType")
        .addEventListener("change", updateRecordTypeFields);


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

function initializeApplication() {

    createRemoveMonthButton();

    initializeEvents();

    renderAll();

    saveData();

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
