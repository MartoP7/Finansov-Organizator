
/* ==========================================
   ФИНАНСОВ ОРГАНИЗАТОР
   LOGIN SYSTEM
========================================== */

"use strict";

const USERS_KEY = "financialOrganizerUsers_v1";
const OLD_STORAGE_KEY = "financialOrganizerData_v1";
const SESSION_KEY = "financialOrganizerCurrentUser";


/* ==========================================
   ЕЛЕМЕНТИ
========================================== */

const userSelect = document.getElementById("userSelect");
const loginForm = document.getElementById("loginForm");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");

const createUserWindow = document.getElementById("createUserWindow");
const createUserForm = document.getElementById("createUserForm");

const showCreateUserButton = document.getElementById("showCreateUser");
const closeCreateUserButton = document.getElementById("closeCreateUser");
const cancelCreateUserButton = document.getElementById("cancelCreateUser");

const createMessage = document.getElementById("createMessage");


/* ==========================================
   ПОТРЕБИТЕЛИ
========================================== */

function loadUsers() {

    try {

        const saved = localStorage.getItem(USERS_KEY);

        if (!saved) return [];

        const users = JSON.parse(saved);

        return Array.isArray(users) ? users : [];

    } catch (error) {

        console.error("Грешка при зареждане на потребителите:", error);

        return [];
    }
}


function saveUsers(users) {

    localStorage.setItem(
        USERS_KEY,
        JSON.stringify(users)
    );
}


function createUserId() {

    return "user_" +
        Date.now().toString(36) + "_" +
        Math.random().toString(36).substring(2, 8);
}


/* ==========================================
   ПЪРВОНАЧАЛНА НАСТРОЙКА
========================================== */

function initializeUsers() {

    let users = loadUsers();

    // Проверяваме дали вече съществува потребител Мартин

    let martin = users.find(user =>
        user.username.trim().toLowerCase() === "мартин"
    );


    // Ако липсва, създаваме го

    if (!martin) {

        martin = {
            id: "user_martin",
            username: "Мартин",
            password: "223",
            createdAt: new Date().toISOString()
        };

        users.push(martin);

        saveUsers(users);
    }


    // Прехвърляме старите финансови данни към Мартин

    const martinStorageKey =
        "financialOrganizerData_v1_" + martin.id;

    const oldData = localStorage.getItem(OLD_STORAGE_KEY);

    const martinData = localStorage.getItem(martinStorageKey);

    if (oldData && !martinData) {

        localStorage.setItem(
            martinStorageKey,
            oldData
        );
    }

    return users;
}


/* ==========================================
   ЗАРЕЖДАНЕ НА СПИСЪКА
========================================== */

function renderUsers() {

    const users = loadUsers();

    userSelect.innerHTML = "";

    const defaultOption = document.createElement("option");

    defaultOption.value = "";
    defaultOption.textContent = "Изберете потребител...";

    userSelect.appendChild(defaultOption);


    users.forEach(user => {

        const option = document.createElement("option");

        option.value = user.id;
        option.textContent = user.username;

        userSelect.appendChild(option);
    });

}


/* ==========================================
   СЪОБЩЕНИЯ
========================================== */

function showMessage(element, message, type) {

    element.textContent = message;

    element.className = "message";

    if (type) {
        element.classList.add(type);
    }
}


/* ==========================================
   ВХОД
========================================== */

loginForm.addEventListener("submit", event => {

    event.preventDefault();

    const userId = userSelect.value;
    const password = loginPassword.value;

    if (!userId || !password) {

        showMessage(
            loginMessage,
            "Моля, попълнете всички полета.",
            "error"
        );

        return;
    }


    const users = loadUsers();

    const user = users.find(item =>
        item.id === userId
    );


    if (!user || user.password !== password) {

        showMessage(
            loginMessage,
            "Грешно потребителско име или парола.",
            "error"
        );

        loginPassword.value = "";
        loginPassword.focus();

        return;
    }


    // Запазваме активния потребител за текущата сесия

    sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
            id: user.id,
            username: user.username
        })
    );


    showMessage(
        loginMessage,
        "Успешен вход! Зареждане...",
        "success"
    );


    // Отваряме главната страница

    window.location.href = "index.html";

});


/* ==========================================
   ПОКАЗВАНЕ НА ПРОЗОРЕЦА ЗА СЪЗДАВАНЕ
========================================== */

function openCreateUserWindow() {

    createUserWindow.classList.remove("hidden");

    createMessage.textContent = "";

    document.getElementById("newUsername").focus();
}


function closeCreateUserWindow() {

    createUserWindow.classList.add("hidden");

    createUserForm.reset();

    createMessage.textContent = "";
}


showCreateUserButton.addEventListener(
    "click",
    openCreateUserWindow
);

closeCreateUserButton.addEventListener(
    "click",
    closeCreateUserWindow
);

cancelCreateUserButton.addEventListener(
    "click",
    closeCreateUserWindow
);


/* ==========================================
   СЪЗДАВАНЕ НА НОВ ПОТРЕБИТЕЛ
========================================== */

createUserForm.addEventListener("submit", event => {

    event.preventDefault();

    const username = document
        .getElementById("newUsername")
        .value.trim();

    const password = document
        .getElementById("newPassword")
        .value;

    const confirmPassword = document
        .getElementById("confirmPassword")
        .value;


    if (!username || !password || !confirmPassword) {

        showMessage(
            createMessage,
            "Моля, попълнете всички полета.",
            "error"
        );

        return;
    }


    if (password.length < 1) {

        showMessage(
            createMessage,
            "Паролата не може да бъде празна.",
            "error"
        );

        return;
    }


    if (password !== confirmPassword) {

        showMessage(
            createMessage,
            "Паролите не съвпадат.",
            "error"
        );

        return;
    }


    const users = loadUsers();

    const alreadyExists = users.some(user =>
        user.username.trim().toLowerCase() ===
        username.toLowerCase()
    );


    if (alreadyExists) {

        showMessage(
            createMessage,
            "Вече съществува потребител с това име.",
            "error"
        );

        return;
    }


    const newUser = {

        id: createUserId(),

        username: username,

        password: password,

        createdAt: new Date().toISOString()

    };


    users.push(newUser);

    try {

        saveUsers(users);

    } catch (error) {

        showMessage(
            createMessage,
            "Грешка при запазване на потребителя.",
            "error"
        );

        return;
    }


    // Създаваме отделно празно хранилище за новия потребител

    const newStorageKey =
        "financialOrganizerData_v1_" + newUser.id;


    const initialData = {

        version: 1,

        selectedYear: new Date().getFullYear(),

        selectedMonth: new Date().getMonth(),

        years: [
            {
                year: new Date().getFullYear(),
                months: [...Array(12).keys()]
            }
        ],

        records: [],

        accounts: [],

        funds: []

    };


    localStorage.setItem(
        newStorageKey,
        JSON.stringify(initialData)
    );


    renderUsers();

    userSelect.value = newUser.id;

    loginPassword.value = "";

    closeCreateUserWindow();

    showMessage(
        loginMessage,
        "Потребителят е създаден успешно. Можете да влезете.",
        "success"
    );

});


/* ==========================================
   ИЗЧИСТВАНЕ НА ВХОДА
========================================== */

document.getElementById("clearLogin").addEventListener(
    "click",
    () => {

        loginMessage.textContent = "";

    }
);


/* ==========================================
   СТАРТИРАНЕ
========================================== */

// initializeUsers();

renderUsers();
