
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
   УПРАВЛЕНИЕ НА ПОТРЕБИТЕЛИ
========================================== */

const userManagementWindow =
    document.getElementById("userManagementWindow");

const manageUserSelect =
    document.getElementById("manageUserSelect");

const managedUsername =
    document.getElementById("managedUsername");

const managementMessage =
    document.getElementById("managementMessage");

const deleteUserConfirm =
    document.getElementById("deleteUserConfirm");

let pendingDeleteUserId = null;


/* ПОКАЗВАНЕ НА ПРОФИЛИТЕ */

function renderUserManagement() {

    const users = loadUsers();

    const previousSelection = manageUserSelect.value;

    manageUserSelect.innerHTML = "";

    const defaultOption = document.createElement("option");

    defaultOption.value = "";
    defaultOption.textContent = "Изберете потребител...";

    manageUserSelect.appendChild(defaultOption);

    users.forEach(user => {

        const option = document.createElement("option");

        option.value = user.id;
        option.textContent = user.username;

        manageUserSelect.appendChild(option);

    });

    if (users.some(user => user.id === previousSelection)) {

        manageUserSelect.value = previousSelection;

    }

    updateManagedUsername();
    updateProfileInformation();

}


/* ОБНОВЯВАНЕ НА ИМЕТО */

function updateManagedUsername() {

    const userId = manageUserSelect.value;

    const user = loadUsers().find(item =>
        item.id === userId
    );

    managedUsername.value = user ? user.username : "";

    updateProfileInformation();
}



/* ==========================================
   ИНФОРМАЦИЯ ЗА ПОТРЕБИТЕЛСКИЯ ПРОФИЛ
========================================== */

function updateProfileInformation() {

    const userId = manageUserSelect.value;

    const users = loadUsers();

    const user = users.find(item =>
        item.id === userId
    );

    const createdAtElement =
        document.getElementById("profileCreatedAt");

    const recordCountElement =
        document.getElementById("profileRecordCount");

    const accountCountElement =
        document.getElementById("profileAccountCount");

    const fundCountElement =
        document.getElementById("profileFundCount");

    const totalCountElement =
        document.getElementById("profileTotalCount");


    if (!user) {

        createdAtElement.textContent = "-";
        recordCountElement.textContent = "0";
        accountCountElement.textContent = "0";
        fundCountElement.textContent = "0";
        totalCountElement.textContent = "0";

        return;
    }


    // Дата на създаване

    if (user.createdAt) {

        const createdDate = new Date(user.createdAt);

        createdAtElement.textContent =
            !isNaN(createdDate.getTime())
                ? createdDate.toLocaleDateString("bg-BG")
                : "Неизвестна";

    } else {

        createdAtElement.textContent = "Неизвестна";

    }


    // Зареждане на финансовите данни на профила

    const storageKey =
        "financialOrganizerData_v1_" + user.id;

    let financialData = {};

    try {

        const savedData = localStorage.getItem(storageKey);

        financialData = savedData
            ? JSON.parse(savedData)
            : {};

    } catch (error) {

        console.error(
            "Грешка при зареждане на информацията за профила:",
            error
        );

        financialData = {};

    }


    // Брой записи, сметки и фондове

    const records = Array.isArray(financialData.records)
        ? financialData.records
        : [];

    const accounts = Array.isArray(financialData.accounts)
        ? financialData.accounts
        : [];

    const funds = Array.isArray(financialData.funds)
        ? financialData.funds
        : [];


    recordCountElement.textContent = records.length;

    accountCountElement.textContent = accounts.length;

    fundCountElement.textContent = funds.length;

    totalCountElement.textContent =
        records.length + accounts.length + funds.length;

}



/* ОТВАРЯНЕ НА ПРОЗОРЕЦА */

function openUserManagementWindow() {

    renderUserManagement();

    managementMessage.textContent = "";

    deleteUserConfirm.classList.add("hidden");

    pendingDeleteUserId = null;

    userManagementWindow.classList.remove("hidden");

    manageUserSelect.focus();

}


/* ЗАТВАРЯНЕ НА ПРОЗОРЕЦА */

function closeUserManagementWindow() {

    userManagementWindow.classList.add("hidden");

    managedUsername.value = "";

    managementMessage.textContent = "";

    deleteUserConfirm.classList.add("hidden");

    pendingDeleteUserId = null;

}


/* ИЗБОР НА ПОТРЕБИТЕЛ */

manageUserSelect.addEventListener("change", () => {

    updateManagedUsername();

    managementMessage.textContent = "";

    deleteUserConfirm.classList.add("hidden");

    pendingDeleteUserId = null;

});


/* ПРЕИМЕНУВАНЕ НА ПОТРЕБИТЕЛ */

document.getElementById("renameManagedUser").addEventListener(
    "click",
    () => {

        const userId = manageUserSelect.value;

        const newUsername = managedUsername.value.trim();

        if (!userId || !newUsername) {

            showMessage(
                managementMessage,
                "Изберете потребител и въведете ново име.",
                "error"
            );

            return;
        }

        const users = loadUsers();

        const user = users.find(item =>
            item.id === userId
        );

        if (!user) {

            showMessage(
                managementMessage,
                "Избраният потребител не съществува.",
                "error"
            );

            renderUserManagement();

            return;
        }

        const alreadyExists = users.some(item =>
            item.id !== userId &&
            item.username.trim().toLowerCase() ===
            newUsername.toLowerCase()
        );

        if (alreadyExists) {

            showMessage(
                managementMessage,
                "Вече съществува потребител с това име.",
                "error"
            );

            return;
        }

        const oldUsername = user.username;

        user.username = newUsername;

        try {

            saveUsers(users);

            // Обновяваме информацията в текущата сесия,
            // ако преименуваният потребител е активен.

            const session = sessionStorage.getItem(SESSION_KEY);

            if (session) {

                const currentSession = JSON.parse(session);

                if (currentSession.id === userId) {

                    currentSession.username = newUsername;

                    sessionStorage.setItem(
                        SESSION_KEY,
                        JSON.stringify(currentSession)
                    );

                }

            }

            renderUsers();

            userSelect.value = userId;

            renderUserManagement();

            manageUserSelect.value = userId;

            showMessage(
                managementMessage,
                `Потребителят "${oldUsername}" е преименуван успешно.`,
                "success"
            );

        } catch (error) {

            user.username = oldUsername;

            showMessage(
                managementMessage,
                "Грешка при запазване на промените.",
                "error"
            );

        }

    }
);


/* ИЗТРИВАНЕ - ПОКАЗВАНЕ НА ПОТВЪРЖДЕНИЕ */

document.getElementById("deleteManagedUser").addEventListener(
    "click",
    () => {

        const userId = manageUserSelect.value;

        const users = loadUsers();

        const user = users.find(item =>
            item.id === userId
        );

        if (!user) {

            showMessage(
                managementMessage,
                "Първо изберете потребител.",
                "error"
            );

            return;
        }

        if (users.length <= 1) {

            showMessage(
                managementMessage,
                "Не можете да изтриете последния потребител.",
                "error"
            );

            return;
        }

        pendingDeleteUserId = userId;

        document.getElementById("deleteUserConfirmText").textContent =
            `Сигурни ли сте, че искате да изтриете профила "${user.username}"? Всички негови финансови данни също ще бъдат изтрити.`;

        deleteUserConfirm.classList.remove("hidden");

        managementMessage.textContent = "";

    }
);


/* ПОТВЪРЖДАВАНЕ НА ИЗТРИВАНЕТО */

document.getElementById("confirmDeleteUser").addEventListener(
    "click",
    () => {

        if (!pendingDeleteUserId) {
            return;
        }

        const users = loadUsers();

        const user = users.find(item =>
            item.id === pendingDeleteUserId
        );

        if (!user) {

            showMessage(
                managementMessage,
                "Потребителят вече не съществува.",
                "error"
            );

            renderUserManagement();

            return;
        }

        if (users.length <= 1) {

            showMessage(
                managementMessage,
                "Не можете да изтриете последния потребител.",
                "error"
            );

            deleteUserConfirm.classList.add("hidden");

            return;
        }

        const deletedUserId = user.id;

        try {

            // Премахваме потребителя от списъка.

            const updatedUsers = users.filter(item =>
                item.id !== deletedUserId
            );

            saveUsers(updatedUsers);

            // Изтриваме отделното финансово хранилище
            // на съответния потребител.

            localStorage.removeItem(
                "financialOrganizerData_v1_" + deletedUserId
            );

            // Ако потребителят е бил избран за вход,
            // изчистваме избора.

            if (userSelect.value === deletedUserId) {

                userSelect.value = "";

                loginPassword.value = "";

            }

            // Ако има активна сесия за този профил,
            // премахваме я.

            const session = sessionStorage.getItem(SESSION_KEY);

            if (session) {

                const currentSession = JSON.parse(session);

                if (currentSession.id === deletedUserId) {

                    sessionStorage.removeItem(SESSION_KEY);

                }

            }

            pendingDeleteUserId = null;

            deleteUserConfirm.classList.add("hidden");

            renderUsers();

            renderUserManagement();

            showMessage(
                managementMessage,
                "Потребителят и неговите финансови данни са изтрити.",
                "success"
            );

        } catch (error) {

            console.error("Грешка при изтриване на потребител:", error);

            showMessage(
                managementMessage,
                "Възникна грешка при изтриването.",
                "error"
            );

        }

    }
);


/* ОТКАЗ ОТ ИЗТРИВАНЕ */

document.getElementById("cancelDeleteUser").addEventListener(
    "click",
    () => {

        pendingDeleteUserId = null;

        deleteUserConfirm.classList.add("hidden");

    }
);


/* СВЪРЗВАНЕ НА БУТОНИТЕ */

document.getElementById("showUserManager").addEventListener(
    "click",
    openUserManagementWindow
);

document.getElementById("closeUserManager").addEventListener(
    "click",
    closeUserManagementWindow
);

document.getElementById("closeUserManagerFooter").addEventListener(
    "click",
    closeUserManagementWindow
);


/* ==========================================
   СМЯНА НА ПАРОЛА
========================================== */

const passwordChangeWindow =
    document.getElementById("passwordChangeWindow");

const passwordChangeForm =
    document.getElementById("passwordChangeForm");

const passwordChangeMessage =
    document.getElementById("passwordChangeMessage");


/* ОТВАРЯНЕ НА ПРОЗОРЕЦА */

function openPasswordChangeWindow() {

    const userId = userSelect.value;

    if (!userId) {

        showMessage(
            loginMessage,
            "Първо изберете потребител, чиято парола искате да промените.",
            "error"
        );

        userSelect.focus();

        return;
    }

    const user = loadUsers().find(item =>
        item.id === userId
    );

    if (!user) {

        showMessage(
            loginMessage,
            "Избраният потребител не съществува.",
            "error"
        );

        renderUsers();

        return;
    }

    document.getElementById("passwordTargetUser").textContent =
        user.username;

    passwordChangeMessage.textContent = "";

    passwordChangeForm.reset();

    passwordChangeWindow.classList.remove("hidden");

    document.getElementById("currentPassword").focus();

}


/* ЗАТВАРЯНЕ НА ПРОЗОРЕЦА */

function closePasswordChangeWindow() {

    passwordChangeWindow.classList.add("hidden");

    passwordChangeForm.reset();

    passwordChangeMessage.textContent = "";

}


/* ЗАПАЗВАНЕ НА НОВАТА ПАРОЛА */

passwordChangeForm.addEventListener("submit", event => {

    event.preventDefault();

    const userId = userSelect.value;

    const currentPassword =
        document.getElementById("currentPassword").value;

    const newPassword =
        document.getElementById("replacementPassword").value;

    const confirmNewPassword =
        document.getElementById("confirmReplacementPassword").value;


    const users = loadUsers();

    const user = users.find(item =>
        item.id === userId
    );


    if (!user) {

        showMessage(
            passwordChangeMessage,
            "Избраният потребител не съществува.",
            "error"
        );

        return;
    }


    // Проверка на старата парола.

    if (user.password !== currentPassword) {

        showMessage(
            passwordChangeMessage,
            "Старата парола е неправилна.",
            "error"
        );

        document.getElementById("currentPassword").value = "";

        document.getElementById("currentPassword").focus();

        return;
    }


    if (!newPassword.trim()) {

        showMessage(
            passwordChangeMessage,
            "Новата парола не може да бъде празна.",
            "error"
        );

        return;
    }


    if (newPassword !== confirmNewPassword) {

        showMessage(
            passwordChangeMessage,
            "Новите пароли не съвпадат.",
            "error"
        );

        document.getElementById("confirmReplacementPassword").value = "";

        document.getElementById("confirmReplacementPassword").focus();

        return;
    }


    try {

        user.password = newPassword;

        saveUsers(users);

        showMessage(
            passwordChangeMessage,
            "Паролата е променена успешно!",
            "success"
        );

        passwordChangeForm.reset();

        // Затваряме прозореца след кратък момент,
        // за да може потребителят да види съобщението.

        setTimeout(() => {

            closePasswordChangeWindow();

        }, 1200);

    } catch (error) {

        showMessage(
            passwordChangeMessage,
            "Грешка при запазване на новата парола.",
            "error"
        );

    }

});


/* СВЪРЗВАНЕ НА БУТОНИТЕ ЗА ПАРОЛАТА */

document.getElementById("showPasswordChange").addEventListener(
    "click",
    openPasswordChangeWindow
);

document.getElementById("closePasswordChange").addEventListener(
    "click",
    closePasswordChangeWindow
);

document.getElementById("cancelPasswordChange").addEventListener(
    "click",
    closePasswordChangeWindow
);





/* ==========================================
   СТАРТИРАНЕ
========================================== */

// initializeUsers();

renderUsers();
