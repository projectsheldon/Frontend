window.selectCoin = function(element, coin) {
    document.querySelectorAll('.crypto-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    window.selectedCurrency = coin;
};

window.switchPaymentTab = function(tab) {
    document.querySelectorAll('.payment-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.payment-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`.payment-tab[onclick="switchPaymentTab('${tab}')"]`)?.classList.add('active');
    document.getElementById(`payment-${tab}`)?.classList.add('active');
};

function clampQuantity(val) {
    const v = parseInt(val) || 1;
    return Math.max(1, Math.min(20, v));
}

const qtyMinus = document.getElementById('qty-minus');
const qtyPlus = document.getElementById('qty-plus');
const qtyValue = document.getElementById('qty-value');

function updateQuantityUI() {
    if (qtyValue) {
        qtyValue.value = window.quantity;
        qtyValue.setAttribute('aria-valuenow', window.quantity);
    }
    window.fetchPriceFromApi();
}

if (qtyMinus) {
    qtyMinus.addEventListener('click', () => {
        const next = clampQuantity(window.quantity - 1);
        if (next !== window.quantity) {
            window.quantity = next;
            qtyMinus.style.transform = 'scale(0.9)';
            setTimeout(() => qtyMinus.style.transform = '', 100);
            updateQuantityUI();
        }
    });
}

if (qtyPlus) {
    qtyPlus.addEventListener('click', () => {
        const next = clampQuantity(window.quantity + 1);
        if (next !== window.quantity) {
            window.quantity = next;
            qtyPlus.style.transform = 'scale(0.9)';
            setTimeout(() => qtyPlus.style.transform = '', 100);
            updateQuantityUI();
        }
    });
}

if (qtyValue) {
    qtyValue.setAttribute('role', 'spinbutton');
    qtyValue.setAttribute('aria-valuemin', '1');
    qtyValue.setAttribute('aria-valuemax', '20');
    qtyValue.setAttribute('aria-valuenow', window.quantity);
    qtyValue.setAttribute('aria-label', 'Quantity');
    qtyValue.setAttribute('inputmode', 'numeric');

    qtyValue.addEventListener('change', (e) => {
        let val = parseInt(e.target.value) || 1;
        val = clampQuantity(val);
        window.quantity = val;
        e.target.value = window.quantity;
        e.target.setAttribute('aria-valuenow', window.quantity);
        window.fetchPriceFromApi();
    });

    qtyValue.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === '+') {
            e.preventDefault();
            const next = clampQuantity(window.quantity + 1);
            if (next !== window.quantity) {
                window.quantity = next;
                updateQuantityUI();
            }
        } else if (e.key === 'ArrowDown' || e.key === '-') {
            e.preventDefault();
            const next = clampQuantity(window.quantity - 1);
            if (next !== window.quantity) {
                window.quantity = next;
                updateQuantityUI();
            }
        }
    });
}
