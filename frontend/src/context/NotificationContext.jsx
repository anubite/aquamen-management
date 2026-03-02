import { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
    const [notification, setNotificationState] = useState(null);
    const timerRef = useRef(null);

    const setNotification = useCallback((value) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (value === null) { setNotificationState(null); return; }
        setNotificationState(value);
        timerRef.current = setTimeout(() => setNotificationState(null), 5000);
    }, []);

    return (
        <NotificationContext.Provider value={{ setNotification }}>
            {children}
            <NotificationBar notification={notification} onDismiss={() => setNotification(null)} />
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    return useContext(NotificationContext);
}

function NotificationBar({ notification, onDismiss }) {
    if (!notification) return null;
    const isError = notification.type === 'error';
    return (
        <div
            className={`notification-bar ${isError ? 'notification-error' : 'notification-success'}`}
            onClick={onDismiss}
        >
            {notification.message}
        </div>
    );
}
