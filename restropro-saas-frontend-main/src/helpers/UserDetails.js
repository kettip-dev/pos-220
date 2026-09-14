const KEY = 'restroprosaas_user'
export function saveUserDetailsInLocalStorage(user) {
    localStorage.setItem(KEY, JSON.stringify(user));
}

export function getUserDetailsInLocalStorage() {
    const userStr = localStorage.getItem(KEY);
    if (!userStr || userStr === "undefined") return null;

    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}


export function clearUserDetailsInLocalStorage() {
    localStorage.removeItem(KEY);
}