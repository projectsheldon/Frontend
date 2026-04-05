// Notification system
// Usage: window.Notify(message, type, duration)
// Types: 'success', 'error', 'info', 'warning'
// Default duration: 4000ms

(function() {
    const containerId = 'notify-container';
    let container = null;

    function getContainer() {
        if (!container) {
            container = document.getElementById(containerId);
            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    max-width: 360px;
                `;
                document.body.appendChild(container);
            }
        }
        return container;
    }

    function createNotification(message, type = 'info', duration = 4000) {
        const colors = {
            success: { accent: '#22c55e', text: 'Success' },
            error: { accent: '#dc2626', text: 'Error' },
            warning: { accent: '#c7b18f', text: 'Warning' },
            info: { accent: '#c7b18f', text: 'Info' }
        };

        const style = colors[type] || colors.info;

        const notification = document.createElement('div');
        notification.style.cssText = `
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-left: 3px solid ${style.accent};
            border-radius: 12px;
            padding: 14px 18px;
            color: rgba(255, 255, 255, 0.9);
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: notifySlideUp 0.3s ease;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;

        const icons = {
            success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
            warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c7b18f" stroke-width="2.5"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
            info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c7b18f" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
        };

        notification.innerHTML = `
            <span style="flex-shrink: 0;">${icons[type] || icons.info}</span>
            <span style="flex: 1;">${message}</span>
        `;

        notification.addEventListener('click', () => {
            removeNotification(notification);
        });

        notification.addEventListener('mouseenter', () => {
            notification.style.background = 'rgba(255, 255, 255, 0.04)';
            notification.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        });

        notification.addEventListener('mouseleave', () => {
            notification.style.background = 'rgba(255, 255, 255, 0.02)';
            notification.style.borderColor = 'rgba(255, 255, 255, 0.05)';
        });

        if (duration > 0) {
            setTimeout(() => {
                removeNotification(notification);
            }, duration);
        }

        getContainer().appendChild(notification);
        return notification;
    }

    function removeNotification(notification) {
        if (notification && notification.parentElement) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(10px)';
            setTimeout(() => {
                notification.remove();
            }, 200);
        }
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes notifySlideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);

    window.Notify = function(message, type = 'info', duration = 4000) {
        if (typeof message === 'object' && message !== null) {
            return createNotification(message.message, message.type, message.duration);
        }
        return createNotification(message, type, duration);
    };

    window.NotifySuccess = (message, duration) => window.Notify(message, 'success', duration);
    window.NotifyError = (message, duration) => window.Notify(message, 'error', duration);
    window.NotifyWarning = (message, duration) => window.Notify(message, 'warning', duration);
    window.NotifyInfo = (message, duration) => window.Notify(message, 'info', duration);
})();
